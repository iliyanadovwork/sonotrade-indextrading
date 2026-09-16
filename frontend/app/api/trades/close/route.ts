import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db/supabase'
import { requireAuth } from '@/lib/auth'
import { rateLimit } from '@/lib/rateLimit'
import { internalError } from '@/lib/api/error-response'

const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9_-]{8,64}$/

/**
 * Postgres error codes raised by close_position_tx, mapped to HTTP status.
 * Anything not listed is an unexpected fault and must be sanitised.
 */
const PG_STATUS: Record<string, number> = {
  '22023': 400, // invalid input
  '23514': 400, // would make the balance negative
  'P0002': 404, // no open position
  '55000': 503, // price unavailable
  '40001': 409, // already closed by a concurrent request
}

interface ClosePositionResult {
  success: boolean
  position_id: string
  contracts: number | string
  price: number | string
  proceeds: number | string
  realized_pnl: number | string
  balance: number | string
  replayed?: boolean
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    if ('response' in auth) return auth.response
    const userId = auth.claims.userId

    const rl = await rateLimit(`close:${userId}`, 20, 60)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many close requests. Please slow down.' },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      )
    }

    const { spotify_id } = await request.json()

    if (!spotify_id || typeof spotify_id !== 'string') {
      return NextResponse.json({ error: 'spotify_id is required' }, { status: 400 })
    }

    const idempotencyKey = request.headers.get('idempotency-key')
    if (idempotencyKey !== null && !IDEMPOTENCY_KEY_RE.test(idempotencyKey)) {
      return NextResponse.json({ error: 'Invalid Idempotency-Key' }, { status: 400 })
    }

    // The row is taken FOR UPDATE and the status='open' predicate re-asserted
    // in the same transaction as the balance credit, so a concurrent
    // double-close credits once and the loser gets 409.
    const { data, error } = await supabaseAdmin.rpc('close_position_tx', {
      p_user_id: userId,
      p_spotify_id: spotify_id,
      p_idempotency_key: idempotencyKey,
    })

    if (error) {
      const status = PG_STATUS[error.code ?? '']
      if (status) {
        return NextResponse.json({ error: error.message }, { status })
      }
      return internalError({ routeName: 'trades.close', err: error })
    }

    const result = data as ClosePositionResult

    return NextResponse.json({
      message: 'Position closed successfully',
      filled: Number(result.contracts),
      remaining: 0,
      new_balance: Number(result.balance),
      total_profit_loss: Number(result.realized_pnl),
    })
  } catch (error) {
    return internalError({ routeName: 'trades.close', err: error })
  }
}
