import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/db/supabase'
import bcrypt from 'bcrypt'
import crypto from 'crypto'
import { sendOtpEmail } from '@/lib/email'
import { rateLimit } from '@/lib/rateLimit'
import { callerIp } from '@/lib/rate-limits'
import { internalError } from '@/lib/api/error-response'
import { USERNAME_RE, USERNAME_RULES, isReservedUsername, escapeLike } from '@/lib/username'

// Cost 10 is below current guidance for bcrypt; 12 is the floor we target.
const BCRYPT_COST = 12

/**
 * Handle for an account that signed up without picking one: sonotrader +
 * random number, retried until free. Random rather than sequential so handles
 * don't leak signup order and can't be enumerated.
 */
async function generateUsername(): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate = `sonotrader${crypto.randomInt(100000, 2147483647)}`
    const { data } = await supabase
      .from('users')
      .select('id')
      .ilike('username', escapeLike(candidate))
      .limit(1)
      .maybeSingle()
    if (!data) return candidate
  }
  // Six random collisions in a 2-billion space means something is broken;
  // surface it rather than looping forever.
  throw new Error('could not generate a free username')
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, username, password, firstName, lastName } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    // Normalise BEFORE the uniqueness check and the insert, so the row that
    // gets written is the same identity that was checked.
    const normalizedEmail = String(email).toLowerCase().trim()
    // Username is optional — accounts that skip it get a generated
    // sonotrader{n} handle (after the email uniqueness check below).
    const chosenUsername = username ? String(username).toLowerCase().trim() : ''

    if (chosenUsername) {
      if (!USERNAME_RE.test(chosenUsername)) {
        return NextResponse.json({ error: USERNAME_RULES }, { status: 400 })
      }
      if (isReservedUsername(chosenUsername)) {
        return NextResponse.json({ error: 'This username is not available' }, { status: 400 })
      }
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      )
    }

    // Rate limit before any expensive work: this handler does two bcrypt
    // hashes, sends an email, and mints an account with a starting balance.
    // Fail closed — an unavailable limiter must not become an unlimited one.
    const ip = callerIp(request.headers)
    const ipRl = await rateLimit(`signup:ip:${ip}`, 3, 3600)
    if (!ipRl.allowed) {
      return NextResponse.json(
        { error: 'Too many signup attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(ipRl.resetInSeconds) } }
      )
    }
    const emailRl = await rateLimit(`signup:email:${normalizedEmail}`, 3, 3600)
    if (!emailRl.allowed) {
      return NextResponse.json(
        { error: 'Too many signup attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(emailRl.resetInSeconds) } }
      )
    }

    // Two parameterised lookups instead of one `.or(...)` filter string:
    // interpolating request values into PostgREST filter syntax lets a caller
    // inject predicates and read the 409/201 as a boolean oracle over any
    // column of `users`.
    const taken = { error: 'User with this email or username already exists' }

    const { data: emailOwner } = await supabase
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (emailOwner) {
      return NextResponse.json(taken, { status: 409 })
    }

    // `_` is a single-character LIKE wildcard and usernames may contain it, so
    // escape it — otherwise `a_c` collides with `abc`.
    if (chosenUsername) {
      const { data: usernameOwner } = await supabase
        .from('users')
        .select('id')
        .ilike('username', escapeLike(chosenUsername))
        .limit(1)
        .maybeSingle()

      if (usernameOwner) {
        return NextResponse.json(taken, { status: 409 })
      }
    }

    const normalizedUsername = chosenUsername || (await generateUsername())

    const passwordHash = await bcrypt.hash(password, BCRYPT_COST)

    // Generate OTP upfront
    const code = crypto.randomInt(100000, 999999).toString()
    const hashedCode = await bcrypt.hash(code, BCRYPT_COST)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    const { error } = await supabase
      .from('users')
      .insert({
        email: normalizedEmail,
        username: normalizedUsername,
        password_hash: passwordHash,
        first_name: firstName || null,
        last_name: lastName || null,
        balance: 1000.00,
        is_active: true,
        is_verified: false,
        verification_token: hashedCode,
        reset_password_expires: expiresAt,
      })

    if (error) {
      // 23505: lost the race against a concurrent signup for the same
      // email/username — the same answer as the pre-check above.
      if (error.code === '23505') {
        return NextResponse.json(taken, { status: 409 })
      }
      return internalError({ routeName: 'auth.signup', err: error, code: 'signup_failed' })
    }

    await sendOtpEmail(normalizedEmail, code)

    return NextResponse.json(
      { success: true, requiresOtp: true, email: normalizedEmail },
      { status: 201 }
    )
  } catch (error) {
    return internalError({ routeName: 'auth.signup', err: error })
  }
}
