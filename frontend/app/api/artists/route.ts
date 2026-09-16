import { NextRequest, NextResponse } from 'next/server'
import { SUPABASE_ANON_KEY } from '@/lib/supabase/env'

export const dynamic = 'force-dynamic'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

// Powers the gallery slideshow (`?gallery=true`) — returns artists that have
// gallery images, plus a basic listing fallback otherwise.
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const limit = Math.min(parseInt(sp.get('limit') ?? '10', 10) || 10, 50)
  const withGallery = sp.get('gallery') === 'true'

  // Pagination + sort, matching the contract the Expo app's trade screen used
  // against the old Railway API (?limit&offset&sort_by&sort_dir). Ignoring
  // `offset` made every infinite-scroll page identical — duplicate React keys
  // on the phone and a list that never advanced. Sort columns are whitelisted;
  // anything else falls back to the previous default (volume desc).
  const offset = Math.max(parseInt(sp.get('offset') ?? '0', 10) || 0, 0)
  const SORTABLE = new Set(['volume', 'change_1m', 'current_index_value'])
  const sortBy = SORTABLE.has(sp.get('sort_by') ?? '') ? sp.get('sort_by')! : 'volume'
  const sortDir = sp.get('sort_dir') === 'asc' ? 'asc' : 'desc'

  const cols = withGallery
    ? 'artist_name,spotify_id,spotify_img,change_1m,gallery,biography,current_index_value,volume'
    : 'artist_name,spotify_id,spotify_img,change_1m,current_index_value,volume'

  const url = new URL(`${SUPABASE_URL}/rest/v1/artists_with_history`)
  url.searchParams.set('select', cols)
  url.searchParams.set('order', `${sortBy}.${sortDir}.nullslast`)
  url.searchParams.set('limit', String(withGallery ? 60 : limit))
  if (!withGallery && offset > 0) url.searchParams.set('offset', String(offset))

  const res = await fetch(url.toString(), {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    next: { revalidate: 60 },
  })
  if (!res.ok) return NextResponse.json({ artists: [], count: 0 }, { status: 500 })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = await res.json()

  if (withGallery) {
    const artists = rows
      .map(row => {
        const gallery: string[] = Array.isArray(row.gallery)
          ? row.gallery
          : typeof row.gallery === 'string'
            ? (() => { try { return JSON.parse(row.gallery) } catch { return [] } })()
            : []
        return {
          id: row.spotify_id ?? row.artist_name,
          spotify_id: row.spotify_id ?? null,
          name: row.artist_name,
          image_url: row.spotify_img ?? null,
          gallery,
          biography: row.biography ?? null,
          change_1m: row.change_1m ?? null,
          index_price: row.current_index_value ?? null,
          volume: row.volume ?? null,
        }
      })
      .filter(a => a.gallery.length > 0)
      .slice(0, limit)
    return NextResponse.json(
      { artists, count: artists.length },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } },
    )
  }

  const artists = rows.map(row => ({
    id: row.spotify_id ?? row.artist_name,
    spotify_id: row.spotify_id ?? null,
    name: row.artist_name,
    index_price: row.current_index_value ?? null,
    volume: row.volume ?? null,
    change_1m: row.change_1m ?? null,
    image_url: row.spotify_img ?? null,
  }))
  return NextResponse.json(
    { artists, count: artists.length },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } },
  )
}
