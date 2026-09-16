import { NextRequest, NextResponse } from 'next/server'
import { SUPABASE_ANON_KEY } from "@/lib/supabase/env"

export const dynamic = 'force-dynamic'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

// REWIRED to sonotrade artists_with_history (was pauv market_overview RPC).
type ArtistRow = {
  spotify_id: string; artist_name: string; spotify_img: string | null
  current_index_value: number | null; change_1h: number | null; change_1d: number | null
  change_1m: number | null; volume: number | null
}

// Sort pushed down to PostgREST (previously: fetch 2000 rows, sort in JS).
// `index_price` is an alias several callers send (SXTopArtistsList,
// SXTopProfilesList, HowItWorksMobile). `spotify_id.asc` is the pagination
// tiebreaker for heavily-tied change columns.
// Keep in sync with /api/trade's SORT_COLUMNS — a key missing here makes that
// sort silently no-op on one endpoint while working on the other.
const SORT_COLUMNS: Record<string, string> = {
  current_index_value: 'current_index_value',
  index_price: 'current_index_value',
  artist_name: 'artist_name',
  volume: 'volume',
  change_1h: 'change_1h',
  change_1d: 'change_1d',
  change_1w: 'change_1w',
  change_1m: 'change_1m',
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const limitRaw  = parseInt(searchParams.get('limit')  ?? '100', 10)
  const limit     = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 100
  const offsetRaw = parseInt(searchParams.get('offset') ?? '0', 10)
  const offset    = Number.isFinite(offsetRaw) && offsetRaw > 0 ? offsetRaw : 0
  const sortByRaw = searchParams.get('sort_by') ?? 'current_index_value'
  const sortAsc   = searchParams.get('sort_dir') === 'asc'
  const cols = 'spotify_id,artist_name,spotify_img,current_index_value,change_1h,change_1d,change_1m,volume'

  // Virtual |change_1m| sort for Most Stable / Most Volatile — PostgREST
  // cannot order on an expression, so rank a catalog-wide (cached) fetch in
  // JS. Keep in sync with /api/trade's implementation.
  let rows: ArtistRow[]
  if (sortByRaw === 'abs_change_1m') {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/artists_with_history?select=${cols}&order=spotify_id.asc&limit=5000&offset=0`,
      {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        next: { revalidate: 30 },
      },
    )
    if (!res.ok) return NextResponse.json({ error: 'Failed to fetch markets' }, { status: 500 })
    const all: ArtistRow[] = await res.json()
    all.sort((a, b) => {
      const an = a.change_1m == null
      const bn = b.change_1m == null
      if (an || bn) return an === bn ? a.spotify_id.localeCompare(b.spotify_id) : an ? 1 : -1
      const av = Math.abs(a.change_1m!)
      const bv = Math.abs(b.change_1m!)
      if (av !== bv) return sortAsc ? av - bv : bv - av
      const vol = (b.volume ?? 0) - (a.volume ?? 0)
      if (vol !== 0) return vol
      return a.spotify_id.localeCompare(b.spotify_id)
    })
    rows = all.slice(offset, offset + limit)
  } else {
    const col = SORT_COLUMNS[sortByRaw]
    const order = col
      ? `${col}.${sortAsc ? 'asc' : 'desc'}.nullslast,spotify_id.asc`
      : 'volume.desc.nullslast,spotify_id.asc'
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/artists_with_history?select=${cols}&order=${order}&limit=${limit}&offset=${offset}`,
      {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        next: { revalidate: 30 },
      },
    )
    if (!res.ok) return NextResponse.json({ error: 'Failed to fetch markets' }, { status: 500 })
    rows = await res.json()
  }
  const artists = rows.map(r => ({
    id: r.spotify_id, name: r.artist_name, image_url: r.spotify_img ?? '', industry: '',
    index_price: r.current_index_value ?? 0, holders: 0, change_1h: r.change_1h ?? 0,
    change_1d: r.change_1d ?? 0, change_1m: r.change_1m ?? 0, volume: r.volume ?? 0,
  }))
  return NextResponse.json({ artists }, { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } })
}
