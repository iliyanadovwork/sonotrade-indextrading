import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase';
import { requireAuth } from '@/lib/auth';
import { rateLimit } from '@/lib/rateLimit';
import { internalError } from '@/lib/api/error-response';

const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * Postgres error codes raised by place_order_tx, mapped to HTTP status.
 * Anything not listed is an unexpected fault and must be sanitised.
 */
const PG_STATUS: Record<string, number> = {
  '22023': 400, // invalid input
  '23514': 400, // insufficient funds / would go negative
  'P0002': 404, // user or artist not found
  '55000': 503, // price unavailable
  '40001': 409, // concurrent state change
};

interface PlaceOrderResult {
  success: boolean;
  action: string;
  position_id: string;
  filled_quantity: number | string;
  price: number | string;
  cash_delta: number | string;
  realized_pnl: number | string;
  balance: number | string;
  replayed?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireAuth(request);
    if ('response' in auth) return auth.response;
    const userId = auth.claims.userId;

    // 20 orders per user per minute. Fails CLOSED when Redis is down — an
    // unavailable limiter must not become an unlimited one on a money path.
    const rl = await rateLimit(`order:${userId}`, 20, 60)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many orders. Please slow down.' },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } }
      )
    }

    const body = await request.json();
    const { spotify_id, side, quantity, notional, expected_price } = body;

    if (!spotify_id || !side) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (!['buy', 'sell'].includes(side)) {
      return NextResponse.json({ error: 'Invalid side' }, { status: 400 });
    }

    // Two ways to size an order. `quantity` is the original contract count and
    // stays the default so existing clients are untouched. `notional` sizes in
    // dollars, which is the safer unit: a mispriced market can then only
    // produce an odd fractional quantity, never an unbounded position.
    const hasQty = quantity !== undefined && quantity !== null;
    const hasNotional = notional !== undefined && notional !== null;
    if (hasQty === hasNotional) {
      return NextResponse.json(
        { error: 'Send exactly one of quantity or notional' },
        { status: 400 },
      );
    }

    const size = Number(hasQty ? quantity : notional);
    if (!Number.isFinite(size) || size <= 0) {
      return NextResponse.json(
        { error: `${hasQty ? 'Quantity' : 'Notional'} must be a positive number` },
        { status: 400 },
      );
    }

    // Optional slippage band. When the client sends the price it rendered, the
    // order is rejected if the live price has moved more than 1% from it,
    // rather than filling at a number the user never saw.
    let expectedPrice: number | null = null;
    if (expected_price !== undefined && expected_price !== null) {
      expectedPrice = Number(expected_price);
      if (!Number.isFinite(expectedPrice) || expectedPrice <= 0) {
        return NextResponse.json({ error: 'Invalid expected_price' }, { status: 400 });
      }
    }

    const idempotencyKey = request.headers.get('idempotency-key');
    if (idempotencyKey !== null && !IDEMPOTENCY_KEY_RE.test(idempotencyKey)) {
      return NextResponse.json({ error: 'Invalid Idempotency-Key' }, { status: 400 });
    }

    // Serialisation, funds check, position math, balance write, volume and the
    // ledger row all happen inside this one transaction. No Redis lock: the
    // per-user advisory lock inside place_order_tx is not optional
    // infrastructure and cannot leak on an early return.
    // place_order_v2 validates tradeability and slippage, converts a dollar
    // amount to contracts, then delegates to place_order_tx — so the advisory
    // lock, the FOR UPDATE reads, the ledger row and the sqlstate error
    // contract are all still the same audited code path.
    const { data, error } = await supabaseAdmin.rpc('place_order_v2', {
      p_user_id: userId,
      p_spotify_id: spotify_id,
      p_side: side,
      p_quantity: hasQty ? size : null,
      p_notional: hasNotional ? size : null,
      p_expected_price: expectedPrice,
      p_idempotency_key: idempotencyKey,
    });

    if (error) {
      const status = PG_STATUS[error.code ?? ''];
      if (status) {
        return NextResponse.json({ error: error.message }, { status });
      }
      return internalError({ routeName: 'orders.place', err: error });
    }

    const result = data as PlaceOrderResult;

    return NextResponse.json({
      success: true,
      order: {
        id: result.position_id,
        status: 'filled',
        filled_quantity: Number(result.filled_quantity),
        remaining_quantity: 0,
        price: Number(result.price),
        trades: 1,
      },
    });
  } catch (error) {
    return internalError({ routeName: 'orders.place', err: error });
  }
}
