import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/db/supabase'
import bcrypt from 'bcrypt'
import { AUTH_COOKIE, signToken } from '@/lib/auth'
import { rateLimit } from '@/lib/rateLimit'
import { internalError } from '@/lib/api/error-response'

// Never select('*') here: the row carries password_hash and the OTP /
// reset-token columns, and everything selected is one spread away from the
// response body.
const USER_COLUMNS =
  'id, email, username, first_name, last_name, avatar_url, balance, total_pnl, total_volume, created_at, updated_at, last_login, is_active, is_verified, verification_token, reset_password_expires, reset_password_token'

const MAX_OTP_ATTEMPTS = 5

/**
 * Durable failed-attempt counter.
 *
 * The Redis limiter is the first line of defence, but it fails open for a
 * *missing* counter in the sense that a sweep of a 6-digit code only needs the
 * limiter to be unavailable once. `users.reset_password_token` is unused by any
 * flow in this app (the OTP hash lives in `verification_token` and its expiry
 * in `reset_password_expires`), so it carries the count in the same row as the
 * code it protects — no schema change, and it survives Redis being down.
 *
 * The prefix keeps the value self-describing so a future password-reset flow
 * cannot mistake a count for a token.
 */
const ATTEMPT_PREFIX = 'otp_attempts:'

function readAttempts(raw: unknown): number {
  if (typeof raw !== 'string' || !raw.startsWith(ATTEMPT_PREFIX)) return 0
  const n = Number.parseInt(raw.slice(ATTEMPT_PREFIX.length), 10)
  return Number.isFinite(n) && n > 0 ? n : 0
}

export async function POST(request: Request) {
  try {
    const { email, code } = await request.json()

    if (!email || !code) {
      return NextResponse.json({ error: 'Email and code are required' }, { status: 400 })
    }

    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Invalid code format' }, { status: 400 })
    }

    // email is stored case-sensitively; normalise once so the lookup and the
    // rate-limit key agree on the identity being throttled.
    const normalizedEmail = String(email).toLowerCase().trim()

    // 5 attempts per email per 10 minutes
    const rl = await rateLimit(`verify-otp:${normalizedEmail}`, 5, 600)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many attempts. Please request a new code.' },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      )
    }

    const { data: user } = await supabase
      .from('users')
      .select(USER_COLUMNS)
      .eq('email', normalizedEmail)
      .maybeSingle()

    // A disabled account gets the same answer as a missing code: this endpoint
    // mints a session, so it must not confirm that the account exists either.
    if (!user || !user.is_active || !user.verification_token || !user.reset_password_expires) {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 })
    }

    if (new Date() > new Date(user.reset_password_expires)) {
      return NextResponse.json({ error: 'Code has expired' }, { status: 400 })
    }

    const match = await bcrypt.compare(code, user.verification_token)
    if (!match) {
      const attempts = readAttempts(user.reset_password_token) + 1
      const exhausted = attempts >= MAX_OTP_ATTEMPTS

      await supabase
        .from('users')
        .update(
          exhausted
            ? {
                verification_token: null,
                reset_password_expires: null,
                reset_password_token: null,
              }
            : { reset_password_token: `${ATTEMPT_PREFIX}${attempts}` }
        )
        .eq('id', user.id)

      return NextResponse.json(
        exhausted
          ? { error: 'Too many attempts. Please request a new code.' }
          : { error: 'Incorrect code' },
        { status: 400 }
      )
    }

    // Clear OTP fields and mark verified
    await supabase
      .from('users')
      .update({
        verification_token: null,
        reset_password_expires: null,
        reset_password_token: null,
        is_verified: true,
        last_login: new Date().toISOString(),
      })
      .eq('id', user.id)

    const token = signToken({
      userId: user.id,
      email: user.email,
      username: user.username,
    })

    const {
      verification_token: _verificationToken,
      reset_password_expires: _resetPasswordExpires,
      reset_password_token: _resetPasswordToken,
      ...userData
    } = user

    const res = NextResponse.json({ success: true, token, user: userData })
    res.cookies.set(AUTH_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })
    return res
  } catch (error) {
    return internalError({ routeName: 'auth.verify-otp', err: error })
  }
}
