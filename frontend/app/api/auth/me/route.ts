import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/db/supabase'
import { requireAuth } from '@/lib/auth'
import { internalError } from '@/lib/api/error-response'

export const dynamic = 'force-dynamic'

/** Session identity must never be served from any cache — a cached 200 keeps
    the header in its logged-in state after the session is gone. */
const NO_STORE = { 'Cache-Control': 'no-store' }

export async function GET(request: Request) {
  try {
    const auth = requireAuth(request)
    if ('response' in auth) return auth.response
    const userId = auth.claims.userId

    // Get user from database
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, username, first_name, last_name, avatar_url, balance, total_volume, created_at, last_login, is_active, is_verified')
      .eq('id', userId)
      .single()

    if (error || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404, headers: NO_STORE }
      )
    }

    if (!user.is_active) {
      return NextResponse.json(
        { error: 'Account is disabled' },
        { status: 403, headers: NO_STORE }
      )
    }

    return NextResponse.json({ user }, { status: 200, headers: NO_STORE })

  } catch (error) {
    return internalError({ routeName: 'auth.me', err: error })
  }
}
