import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const ALLOWED_SORT = new Set([
  'current_index_value',
  'change_1h',
  'change_1d',
  'change_1w',
  'change_1m',
  'change_1y',
  'volume',
  'artist_name',
])

const SLIM_COLUMNS =
  'artist_name, spotify_id, spotify_img, change_1m, current_index_value, volume'

/**
 * Slim feed for discover/sidebar/ticker callers. Reads `artists_with_history`
 * directly via Supabase, skipping heavy columns (data_points, biography, ...).
 * Response: { artists, count } with fields the SX/discover widgets consume
 * (id, spotify_id, name, index_price, current_index_value, change_1m, image_url).
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const limit = Math.min(parseInt(sp.get('limit') || '50', 10) || 50, 200)
    const offset = parseInt(sp.get('offset') || '0', 10) || 0
    let sortBy = sp.get('sort_by') || 'current_index_value'
    // Callers may pass sort_by=index_price; map it to the real column.
    if (sortBy === 'index_price') sortBy = 'current_index_value'
    const ascending = sp.get('sort_dir') === 'asc'
    const includeGallery = sp.get('gallery') === 'true'

    const sortColumn = ALLOWED_SORT.has(sortBy) ? sortBy : 'current_index_value'
    const cols = includeGallery ? `${SLIM_COLUMNS}, gallery, biography` : SLIM_COLUMNS

    const { data, error } = await supabase
      .from('artists_with_history')
      .select(cols)
      .order(sortColumn, { ascending, nullsFirst: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('[discover] supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const artists = (data as any[] | null)?.map((row) => {
      const base = {
        id: row.spotify_id ?? row.artist_name,
        spotify_id: row.spotify_id ?? null,
        name: row.artist_name,
        index_price: row.current_index_value ?? null,
        current_index_value: row.current_index_value ?? null,
        volume: row.volume ?? null,
        change_1m: row.change_1m ?? null,
        image_url: row.spotify_img ?? null,
      }
      if (includeGallery) {
        const gallery: string[] = Array.isArray(row.gallery)
          ? row.gallery
          : typeof row.gallery === 'string'
            ? (() => {
                try {
                  return JSON.parse(row.gallery)
                } catch {
                  return []
                }
              })()
            : []
        return { ...base, gallery, biography: row.biography ?? null }
      }
      return base
    }) || []

    return NextResponse.json(
      { artists, count: artists.length },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } }
    )
  } catch (error) {
    console.error('[discover] server error:', error)
    return NextResponse.json({ error: 'Failed to load discover data' }, { status: 500 })
  }
}
