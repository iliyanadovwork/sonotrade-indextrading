import { NextRequest, NextResponse } from 'next/server'
import { SUPABASE_ANON_KEY } from '@/lib/supabase/env'

export const dynamic = 'force-dynamic'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

// History no longer comes from the artists_with_history.data_points jsonb.
// That column is an unbounded, TOASTed array (~76KB/artist) and selecting it
// was orders of magnitude more expensive than every other column combined.
// `?history=true` now calls the artist_history RPC, which windows and
// downsamples inside Postgres against artist_index_history — the same path the
// real charts use since 20260809_history_rpcs_read_table.sql.
const BASE_COLUMNS = 'spotify_id,artist_name,spotify_img,current_index_value,change_1d,change_1m,volume'
/** Enough to draw any chart we render; the client downsamples further. */
const MAX_HISTORY_POINTS = 240

interface DataPoint { index: number | string; timestamp: string }


/**
 * Resolve an artist's name + live index value by spotify_id — used by the
 * trade/position embed (BetSlipCard), which renders one card per trade and
 * needs only `name` and `index_price`.
 *
 * `?history=true` additionally returns the last 240 price points as
 * `data_points`. `?slim=true` (the default shape) never does. Callers that
 * want a full windowed/downsampled series should use
 * /api/markets/[ticker]/history instead — it aggregates in Postgres.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ spotify_id: string }> }) {
  const { spotify_id } = await params
  const id = decodeURIComponent(spotify_id)
  const sp = request.nextUrl.searchParams
  // `slim` wins over `history`: a caller that asks for the slim shape must
  // never be handed the jsonb, whatever else it passed.
  const wantHistory = sp.get('history') === 'true' && sp.get('slim') !== 'true'

  const url = new URL(`${SUPABASE_URL}/rest/v1/artists_with_history`)
  url.searchParams.set('select', BASE_COLUMNS)
  url.searchParams.set('spotify_id', `eq.${id}`)
  url.searchParams.set('limit', '1')
  const res = await fetch(url.toString(), {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    next: { revalidate: 30 },
  })
  if (!res.ok) return NextResponse.json({ artist: null }, { status: 500 })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = await res.json()
  const r = rows[0]
  if (!r) return NextResponse.json({ artist: null })

  // The RPC returns {price, timestamp}; this endpoint's published shape is
  // {index, timestamp}, which the how-it-works charts read. Map rather than
  // change the contract.
  let dataPoints: DataPoint[] = []
  if (wantHistory) {
    const hres = await fetch(`${SUPABASE_URL}/rest/v1/rpc/artist_history`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_spotify_id: id, p_window: 'all' }),
      next: { revalidate: 30 },
    })
    if (hres.ok) {
      const pts = (await hres.json()) as { price: number; timestamp: string }[] | null
      dataPoints = (Array.isArray(pts) ? pts : [])
        .map(p => ({ index: p.price, timestamp: p.timestamp }))
        .slice(-MAX_HISTORY_POINTS)
    } else {
      console.error(`[artist] artist_history RPC failed for ${id}: ${hres.status}`)
    }
  }
  return NextResponse.json(
    {
      artist: {
        name: r.artist_name,
        spotify_id: r.spotify_id,
        index_price: r.current_index_value ?? null,
        mark_price: r.current_index_value ?? null,
        image_url: r.spotify_img ?? null,
        change_1d: r.change_1d ?? null,
        change_1m: r.change_1m ?? null,
        data_points: dataPoints,
      },
    },
    { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } },
  )
}
