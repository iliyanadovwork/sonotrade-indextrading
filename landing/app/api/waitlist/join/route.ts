import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'
import { sendOtpEmail } from '@/lib/email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = typeof body?.email === 'string' ? body.email : ''

    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Reject if already verified.
    const { data: existing, error: lookupError } = await supabaseAdmin
      .from('waitlist')
      .select('verified')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (lookupError) {
      console.error('[waitlist/join] lookup error:', lookupError)
      return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
    }

    if (existing?.verified) {
      return NextResponse.json({ error: "You're already on the waitlist" }, { status: 409 })
    }

    // Generate a 6-digit code and hash it.
    const code = String(crypto.randomInt(100000, 1000000))
    const otpHash = await bcrypt.hash(code, 10)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    const { error: upsertError } = await supabaseAdmin
      .from('waitlist')
      .upsert(
        { email: normalizedEmail, otp_hash: otpHash, otp_expires_at: expiresAt },
        { onConflict: 'email' }
      )

    if (upsertError) {
      console.error('[waitlist/join] upsert error:', upsertError)
      return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
    }

    await sendOtpEmail(normalizedEmail, code)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[waitlist/join] error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
