import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db/supabase'
import { SUPABASE_ANON_KEY } from "@/lib/supabase/env"

export const dynamic = 'force-dynamic'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

// REWIRED to sonotrade artists_with_history (was pauv market_overview RPC).
type ArtistRow = {
  spotify_id: string; artist_name: string; spotify_img: string | null
  current_index_value: number | null; change_1h: number | null; change_1d: number | null
  change_1w: number | null; change_1m: number | null; volume: number | null; last_updated: string | null
}

// Sort is pushed down to PostgREST — the previous version fetched all 2000
// rows and sorted in JS on every cache miss. `spotify_id.asc` is a required
// tiebreaker: the change_* columns are heavily tied (many exact zeros), and
// without a deterministic order, offset pagination skips/duplicates rows.
// `holders` has no backing column; the old JS sort used a constant key, which
// (stable sort) preserved the base volume-desc fetch order — kept identical.
const SORT_COLUMNS: Record<string, string> = {
  current_index_value: 'current_index_value',
  artist_name: 'artist_name',
  volume: 'volume',
  change_1h: 'change_1h',
  change_1d: 'change_1d',
  change_1w: 'change_1w',
  change_1m: 'change_1m',
}

// Rank by |change_1m| ("Most Stable" asc / "Most Volatile" desc) — PostgREST
// cannot order on an expression, so pull the catalog's light columns in one
// cached call and rank here. Ties (a wall of exact 0.00s) break by volume so
// actively traded artists surface first; nulls always sink.
function absChangeSort(rows: ArtistRow[], asc: boolean): ArtistRow[] {
  return [...rows].sort((a, b) => {
    const an = a.change_1m == null
    const bn = b.change_1m == null
    if (an || bn) return an === bn ? a.spotify_id.localeCompare(b.spotify_id) : an ? 1 : -1
    const av = Math.abs(a.change_1m!)
    const bv = Math.abs(b.change_1m!)
    if (av !== bv) return asc ? av - bv : bv - av
    const vol = (b.volume ?? 0) - (a.volume ?? 0)
    if (vol !== 0) return vol
    return a.spotify_id.localeCompare(b.spotify_id)
  })
}

const ABS_SORT_WINDOW = 5000

async function fetchArtists(
  sortByRaw: string,
  sortAsc: boolean,
  limit: number,
  offset: number,
): Promise<{ rows: ArtistRow[]; total: number } | null> {
  const cols = 'spotify_id,artist_name,spotify_img,current_index_value,change_1h,change_1d,change_1w,change_1m,volume,last_updated'

  if (sortByRaw === 'abs_change_1m') {
    const url = `${SUPABASE_URL}/rest/v1/artists_with_history?select=${cols}&order=spotify_id.asc&limit=${ABS_SORT_WINDOW}&offset=0`
    const res = await fetch(url, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      next: { revalidate: 30 },
    })
    if (!res.ok) return null
    const all: ArtistRow[] = await res.json()
    if (all.length === ABS_SORT_WINDOW) {
      console.warn(`[api/trade] abs_change_1m window clipped at ${ABS_SORT_WINDOW} rows — catalog outgrew it`)
    }
    const sorted = absChangeSort(all, sortAsc)
    return { rows: sorted.slice(offset, offset + limit), total: sorted.length }
  }

  const col = SORT_COLUMNS[sortByRaw]
  const order = col
    ? `${col}.${sortAsc ? 'asc' : 'desc'}.nullslast,spotify_id.asc`
    : 'volume.desc.nullslast,spotify_id.asc'
  const url = `${SUPABASE_URL}/rest/v1/artists_with_history?select=${cols}&order=${order}&limit=${limit}&offset=${offset}`
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Prefer: 'count=exact',
    },
    next: { revalidate: 30 },
  })
  if (!res.ok) return null
  const rows: ArtistRow[] = await res.json()
  // content-range: "0-99/2493" — total after the slash.
  const range = res.headers.get('content-range')
  const total = range?.includes('/') ? parseInt(range.split('/')[1] ?? '', 10) : NaN
  return { rows, total: Number.isFinite(total) ? total : offset + rows.length }
}

/**
 * Distinct holders per artist = users with an open position.
 *
 * `holders` was hardcoded to 0 here and in /api/discover, so every surface that
 * displayed it showed nothing useful. There is no denormalised counter column,
 * so it is aggregated per request — cheap while this is paper trading, but it
 * reads one row per open position for the listed artists. If open positions
 * grow large, move this to a grouped SQL view or a counter maintained by
 * place_order_tx / close_position_tx.
 */
async function fetchHolderCounts(spotifyIds: string[]): Promise<Record<string, number>> {
  if (spotifyIds.length === 0) return {}
  const { data, error } = await supabaseAdmin
    .from('positions')
    .select('spotify_id, user_id')
    .eq('status', 'open')
    .in('spotify_id', spotifyIds)
  if (error) {
    console.error('[trade] holder count failed:', error.message)
    return {}
  }
  const byArtist: Record<string, Set<string>> = {}
  for (const row of (data ?? []) as { spotify_id: string; user_id: string }[]) {
    (byArtist[row.spotify_id] ??= new Set()).add(row.user_id)
  }
  const counts: Record<string, number> = {}
  for (const [id, users] of Object.entries(byArtist)) counts[id] = users.size
  return counts
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const limitRaw  = parseInt(searchParams.get('limit')  ?? '100', 10)
  const limit     = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 100
  const offsetRaw = parseInt(searchParams.get('offset') ?? '0', 10)
  const offset    = Number.isFinite(offsetRaw) && offsetRaw > 0 ? offsetRaw : 0
  const sortByRaw = searchParams.get('sort_by')  ?? 'current_index_value'
  const sortAsc   = searchParams.get('sort_dir') === 'asc'
  try {
    const result = await fetchArtists(sortByRaw, sortAsc, limit, offset)
    if (result === null) return NextResponse.json({ error: 'Failed to fetch markets' }, { status: 500 })
    const holderCounts = await fetchHolderCounts(result.rows.map(r => r.spotify_id))
    const artists = result.rows.map(r => ({
      id: r.spotify_id, name: r.artist_name, image_url: r.spotify_img ?? '', industry: '', info_subcategory: null,
      index_price: r.current_index_value ?? 0, change_1h: r.change_1h ?? 0, change_1d: r.change_1d ?? 0,
      change_1w: r.change_1w ?? 0, change_1m: r.change_1m ?? 0, volume: r.volume ?? 0, market_cap: 0, holders: holderCounts[r.spotify_id] ?? 0,
      listed_at: r.last_updated ?? null, data_points: [] as { value: number; price: number; timestamp: number }[],
    }))
    return NextResponse.json({ artists, total: result.total },
      { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } })
  } catch (err) {
    console.error('Trade API error:', err)
    return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 })
  }
}
