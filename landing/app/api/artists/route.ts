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

/**
 * Full artist feed. Reads `artists_with_history` directly via Supabase.
 * Response: { artists, count } where each artist matches the shape the
 * frontend /api/artists route returns (id, spotify_id, name, current_index_value,
 * change_*, data_points, image_url, ...).
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const limit = parseInt(sp.get('limit') || '100', 10) || 100
    const offset = parseInt(sp.get('offset') || '0', 10) || 0
    const search = sp.get('search') || ''
    const sortBy = sp.get('sort_by') || 'current_index_value'
    const sortDir = sp.get('sort_dir') === 'asc' ? 'asc' : 'desc'
    const includeDataPoints = sp.get('include_data_points') !== 'false'

    const sortColumn = ALLOWED_SORT.has(sortBy) ? sortBy : 'current_index_value'
    const ascending = sortDir === 'asc'

    const selectColumns =
      search || !includeDataPoints
        ? 'artist_name, spotify_id, spotify_img, change_1m, current_index_value, volume, data_points'
        : '*'

    let query = supabase
      .from('artists_with_history')
      .select(selectColumns)
      .order(sortColumn, { ascending, nullsFirst: false })
      .range(offset, offset + limit - 1)

    if (search) {
      query = query.ilike('artist_name', `%${search}%`)
    }

    const { data, error } = await query

    if (error) {
      console.error('[artists] supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const artists = (data as any[] | null)?.map((row) => {
      if (search || !includeDataPoints) {
        const pts: { index: number }[] = row.data_points || []
        const lastIdx = pts.length > 0 ? pts[pts.length - 1].index : null
        return {
          id: row.spotify_id ?? row.artist_name,
          spotify_id: row.spotify_id ?? null,
          name: row.artist_name,
          index_price: row.current_index_value ?? lastIdx ?? null,
          current_index_value: row.current_index_value ?? lastIdx ?? null,
          volume: row.volume ?? pts.length ?? null,
          change_1m: row.change_1m ?? null,
          image_url: row.spotify_img ?? null,
        }
      }

      const dataPoints: { index: number; timestamp: string }[] = row.data_points || []
      return {
        id: row.spotify_id ?? row.artist_name,
        spotify_id: row.spotify_id ?? null,
        name: row.artist_name,
        current_index_value:
          row.current_index_value ??
          (dataPoints.length > 0 ? dataPoints[dataPoints.length - 1].index : 0),
        volume: row.volume ?? dataPoints.length,
        change_1h: row.change_1h ?? null,
        change_1d: row.change_1d ?? null,
        change_1w: row.change_1w ?? null,
        change_1m: row.change_1m ?? null,
        change_1y: row.change_1y ?? null,
        volatility: row.change_1d ?? null,
        data_points: dataPoints,
        image_url: row.spotify_img ?? null,
      }
    }) || []

    return NextResponse.json({ artists, count: artists.length })
  } catch (error) {
    console.error('[artists] server error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
