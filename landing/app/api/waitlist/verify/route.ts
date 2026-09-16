import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CODE_RE = /^\d{6}$/

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = typeof body?.email === 'string' ? body.email : ''
    const code = typeof body?.code === 'string' ? body.code : ''

    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
    }
    if (!code || !CODE_RE.test(code)) {
      return NextResponse.json({ error: 'Please enter the 6-digit code' }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()

    const { data: row, error: lookupError } = await supabaseAdmin
      .from('waitlist')
      .select('otp_hash, otp_expires_at')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (lookupError) {
      console.error('[waitlist/verify] lookup error:', lookupError)
      return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
    }

    if (!row || !row.otp_hash || !row.otp_expires_at) {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 })
    }

    if (new Date(row.otp_expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'Code has expired. Please request a new one' }, { status: 400 })
    }

    const valid = await bcrypt.compare(code, row.otp_hash)
    if (!valid) {
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
    }

    const { error: updateError } = await supabaseAdmin
      .from('waitlist')
      .update({ verified: true, otp_hash: null, otp_expires_at: null })
      .eq('email', normalizedEmail)

    if (updateError) {
      console.error('[waitlist/verify] update error:', updateError)
      return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[waitlist/verify] error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
