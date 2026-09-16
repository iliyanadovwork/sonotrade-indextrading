import { NextRequest, NextResponse } from 'next/server'
import { SUPABASE_ANON_KEY } from "@/lib/supabase/env"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
interface PricePoint { price: number; timestamp: string }

const CACHE_HEADERS = { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' }
const SB_HEADERS = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }

// Preferred path: artist_history_batch RPC (sql/20260724_artist_history_rpc.sql)
// windows + downsamples in Postgres — the previous implementation pulled the
// FULL data_points jsonb for up to 200 artists (~15MB per 200) on every call.
async function fetchViaRpc(slugs: string[], window: string): Promise<Record<string, PricePoint[]> | null> {
  // PostgREST array literal: {id1,id2}. Spotify IDs are base62 — no quoting needed.
  const ids = encodeURIComponent(`{${slugs.join(',')}}`)
  const url = `${SUPABASE_URL}/rest/v1/rpc/artist_history_batch?p_spotify_ids=${ids}&p_window=${encodeURIComponent(window)}`
  // Sparklines don't need 30s freshness — 5min upstream cache means the
  // ~2s cold RPC aggregation is paid once per 5min across all visitors.
  const res = await fetch(url, { headers: SB_HEADERS, next: { revalidate: 300 } })
  if (!res.ok) return null // RPC missing/erroring — caller degrades to empty
  const rows: { spotify_id: string; points: PricePoint[] | null }[] = await res.json()
  const result: Record<string, PricePoint[]> = {}
  for (const row of rows) {
    // Empty arrays are omitted, matching the legacy key-omission behavior.
    if (Array.isArray(row.points) && row.points.length > 0) result[row.spotify_id] = row.points
  }
  return result
}

// The RPC is the only supported path. The old fallback selected the full
// data_points jsonb for up to 200 artists — ~15MB in a single response, all of
// it detoasted server-side — so a missing RPC was worse than no endpoint at
// all. A missing RPC is a deploy fault: log it and serve empty sparklines.
function fetchViaTable(slugs: string[], window: string): Record<string, PricePoint[]> {
  console.error(
    `[markets/batch-history] artist_history_batch RPC unavailable — serving empty series (${slugs.length} ids, window=${window}). Apply sql/20260724_artist_history_rpc.sql.`,
  )
  return {}
}

// Uniform-stride thinning for consumers that can't resolve the full series —
// a 96×32 sparkline can't show 240 points. Always keeps the last point.
function thin(points: PricePoint[], target: number): PricePoint[] {
  if (points.length <= target) return points
  const out: PricePoint[] = []
  const step = (points.length - 1) / (target - 1)
  for (let i = 0; i < target - 1; i++) out.push(points[Math.round(i * step)]!)
  out.push(points[points.length - 1]!)
  return out
}

// REWIRED to sonotrade: slugs === spotify_ids; histories from the artist_history_batch RPC.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const slugs = (searchParams.get('slugs') ?? '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 200)
  const window = searchParams.get('window') ?? '30d'
  // Optional per-series point cap (e.g. sparklines request 48). Clamped 10–240.
  const pointsRaw = parseInt(searchParams.get('points') ?? '', 10)
  const maxPoints = Number.isFinite(pointsRaw) ? Math.min(Math.max(pointsRaw, 10), 240) : null
  if (!slugs.length) return NextResponse.json({})
  try {
    const result = (await fetchViaRpc(slugs, window)) ?? fetchViaTable(slugs, window)
    if (maxPoints != null) {
      for (const key of Object.keys(result)) result[key] = thin(result[key]!, maxPoints)
    }
    return NextResponse.json(result, { headers: CACHE_HEADERS })
  } catch (err) { console.error('Batch history API error:', err); return NextResponse.json({}) }
}
