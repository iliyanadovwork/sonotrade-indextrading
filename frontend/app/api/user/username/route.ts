import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { rateLimit } from '@/lib/rateLimit'
import { internalError } from '@/lib/api/error-response'
import { supabaseAdmin } from '@/lib/db/supabase'
import { USERNAME_RE, USERNAME_RULES, isReservedUsername, escapeLike } from '@/lib/username'

export const dynamic = 'force-dynamic'

/**
 * Change the signed-in user's username.
 *
 * Same rules as signup (lib/username.ts): 3-20 lowercase [a-z0-9_], stored
 * lowercase, unique case-insensitively, reserved handles refused. Throttled —
 * a handle is public identity, and free rapid cycling makes impersonation and
 * mention-breaking trivially easy.
 */
export async function PATCH(request: NextRequest) {
  const auth = requireAuth(request)
  if ('response' in auth) return auth.response
  const userId = auth.claims.userId

  const rl = await rateLimit(`username-change:${userId}`, 5, 3600)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many username changes. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } },
    )
  }

  try {
    const body = (await request.json()) as { username?: unknown }
    const username = String(body.username ?? '').toLowerCase().trim()

    if (!USERNAME_RE.test(username)) {
      return NextResponse.json({ error: USERNAME_RULES }, { status: 400 })
    }
    if (isReservedUsername(username)) {
      return NextResponse.json({ error: 'This username is not available' }, { status: 400 })
    }

    // Escaped ilike: `_` is a LIKE wildcard and a legal username character.
    const { data: owner } = await supabaseAdmin
      .from('users')
      .select('id')
      .ilike('username', escapeLike(username))
      .limit(1)
      .maybeSingle<{ id: string }>()

    if (owner && String(owner.id) !== String(userId)) {
      return NextResponse.json({ error: 'This username is already taken' }, { status: 409 })
    }

    const { error } = await supabaseAdmin
      .from('users')
      .update({ username, updated_at: new Date().toISOString() })
      .eq('id', userId)

    if (error) {
      // 23505: lost the race against a concurrent claim of the same handle.
      if (error.code === '23505') {
        return NextResponse.json({ error: 'This username is already taken' }, { status: 409 })
      }
      return internalError({ routeName: 'user.username', err: error, code: 'username_update_failed' })
    }

    return NextResponse.json({ username })
  } catch (err) {
    return internalError({ routeName: 'user.username', err, code: 'username_update_failed' })
  }
}
