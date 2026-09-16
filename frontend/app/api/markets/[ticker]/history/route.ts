import { NextRequest, NextResponse } from 'next/server'
import { SUPABASE_ANON_KEY } from "@/lib/supabase/env"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
interface PricePoint { price: number; timestamp: string }

const CACHE_HEADERS = { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' }

const SB_HEADERS = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }

// Preferred path: the artist_history RPC (sql/20260724_artist_history_rpc.sql)
// windows + downsamples inside Postgres, so only ≤~240 points cross the wire
// instead of the artist's entire data_points jsonb (~76KB).
async function fetchViaRpc(ticker: string, window: string): Promise<PricePoint[] | null> {
  const url = `${SUPABASE_URL}/rest/v1/rpc/artist_history?p_spotify_id=${encodeURIComponent(ticker)}&p_window=${encodeURIComponent(window)}`
  const res = await fetch(url, { headers: SB_HEADERS, next: { revalidate: 30 } })
  if (!res.ok) return null // RPC missing/erroring — caller degrades to empty
  const body = await res.json()
  return Array.isArray(body) ? body as PricePoint[] : []
}

// The RPC is the only supported path. It used to fall back to pulling the
// entire data_points jsonb (~76KB, TOASTed) and windowing in JS — meaning a
// missing RPC silently turned every chart load into the most expensive query
// in the system. A missing RPC is a deploy fault: fail loudly to the log and
// serve an empty chart.
function fetchViaTable(ticker: string, window: string): PricePoint[] {
  console.error(
    `[markets/history] artist_history RPC unavailable — serving empty series (ticker=${ticker}, window=${window}). Apply sql/20260724_artist_history_rpc.sql.`,
  )
  return []
}

// REWIRED to sonotrade: history from the artist_history RPC; ticker === spotify_id.
export async function GET(request: NextRequest, { params }: { params: Promise<{ ticker: string }> }) {
  const { ticker: rawTicker } = await params
  const ticker = decodeURIComponent(rawTicker)
  const window = request.nextUrl.searchParams.get('window') ?? 'all'
  try {
    const points = (await fetchViaRpc(ticker, window)) ?? fetchViaTable(ticker, window)
    return NextResponse.json(points, { headers: CACHE_HEADERS })
  } catch (err) { console.error('History API error:', err); return NextResponse.json([]) }
}
