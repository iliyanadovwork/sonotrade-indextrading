import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/db/supabase'
import bcrypt from 'bcrypt'
import crypto from 'crypto'
import { sendOtpEmail } from '@/lib/email'
import { rateLimit } from '@/lib/rateLimit'
import { internalError } from '@/lib/api/error-response'

// Cost 10 is below current guidance for bcrypt; 12 is the floor we target.
const BCRYPT_COST = 12

// Identical for "sent", "no such account" and "account disabled": any
// difference makes this endpoint an unauthenticated oracle for which emails
// have accounts here.
const GENERIC_OK = {
  success: true,
  message: 'If an account exists, a code has been sent',
}

export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // email is stored case-sensitively; normalise once so the lookup and the
    // rate-limit key agree on the identity being throttled.
    const normalizedEmail = String(email).toLowerCase().trim()

    // 5 OTP requests per email per 10 minutes
    const rl = await rateLimit(`otp:${normalizedEmail}`, 5, 600)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many code requests. Please wait before trying again.' },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      )
    }

    const { data: user } = await supabase
      .from('users')
      .select('id, email, is_active, reset_password_expires')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (!user || !user.is_active) {
      return NextResponse.json(GENERIC_OK)
    }

    // Max 1 OTP per 60 seconds. Silently skip the send rather than reporting
    // it — the previously issued code is still valid for its full window.
    if (user.reset_password_expires) {
      const expiry = new Date(user.reset_password_expires)
      const secondsSinceSent = (expiry.getTime() - 10 * 60 * 1000 - Date.now()) / 1000
      if (secondsSinceSent > -60) {
        return NextResponse.json(GENERIC_OK)
      }
    }

    const code = crypto.randomInt(100000, 999999).toString()
    const hashedCode = await bcrypt.hash(code, BCRYPT_COST)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    await supabase
      .from('users')
      .update({
        verification_token: hashedCode,
        reset_password_expires: expiresAt,
        // Durable failed-attempt counter for verify-otp; a fresh code starts
        // from zero.
        reset_password_token: null,
      })
      .eq('id', user.id)

    await sendOtpEmail(normalizedEmail, code)

    return NextResponse.json(GENERIC_OK)
  } catch (error) {
    return internalError({
      routeName: 'auth.send-otp',
      err: error,
      code: 'send_otp_failed',
    })
  }
}
