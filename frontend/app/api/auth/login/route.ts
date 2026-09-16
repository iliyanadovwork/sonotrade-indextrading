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
  'id, email, username, first_name, last_name, avatar_url, balance, total_pnl, total_volume, created_at, updated_at, last_login, is_active, is_verified, password_hash'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // email is stored case-sensitively; normalise once so the lookup and the
    // rate-limit key agree on the identity being throttled.
    const normalizedEmail = String(email).toLowerCase().trim()

    // 10 login attempts per email per 15 minutes
    const rl = await rateLimit(`login:${normalizedEmail}`, 10, 900)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      )
    }

    const { data: user, error } = await supabase
      .from('users')
      .select(USER_COLUMNS)
      .eq('email', normalizedEmail)
      .single()

    // PGRST116 is "no rows matched" — a genuine unknown email, answered with
    // the same 401 as a bad password so this stays a non-oracle. Any other
    // error means the lookup itself failed (unregistered API key, revoked
    // grant, database down); answering 401 there tells someone their password
    // is wrong when it was never checked, which is a miserable thing to debug.
    if (error && error.code !== 'PGRST116') {
      return internalError({ routeName: 'auth.login', err: error, code: 'login_unavailable' })
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash)
    // is_active is checked only after the password, and returns the same
    // message: a distinct "Account is disabled" reply is an unauthenticated
    // oracle for which emails have accounts.
    if (!passwordMatch || !user.is_active) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Update last login
    await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id)

    const token = signToken({
      userId: user.id,
      email: user.email,
      username: user.username,
    })

    const { password_hash: _passwordHash, ...userData } = user

    const res = NextResponse.json({
      message: 'Login successful',
      token,
      user: userData,
    }, { status: 200 })
    // Also set the token as an httpOnly cookie so Server Components can read it.
    res.cookies.set(AUTH_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })
    return res

  } catch (error) {
    return internalError({ routeName: 'auth.login', err: error })
  }
}
