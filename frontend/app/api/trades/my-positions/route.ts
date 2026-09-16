import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db/supabase'
import { requireAuth } from '@/lib/auth'

// PostgREST puts `in.(...)` in the URL, so an unbounded id list eventually
// exceeds the request-line limit and 414s.
const IN_CHUNK_SIZE = 100
const MAX_OPEN_POSITIONS = 500

interface OpenPositionRow {
  id: string
  user_id: string
  spotify_id: string
  position_type: string
  contracts: number
  entry_price: string
  total_cost: string
}

export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    if ('response' in auth) return auth.response
    const userId = auth.claims.userId

    const { searchParams } = new URL(request.url)
    const spotifyId = searchParams.get('spotify_id')

    let query = supabaseAdmin
      .from('positions')
      .select('id, user_id, spotify_id, position_type, contracts, entry_price, total_cost')
      .eq('user_id', userId)
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(MAX_OPEN_POSITIONS)

    if (spotifyId) {
      query = query.eq('spotify_id', spotifyId)
    }

    const { data: positions, error } = await query

    if (error) {
      console.error('Error fetching positions:', error)
      return NextResponse.json({ error: 'Failed to fetch positions' }, { status: 500 })
    }

    // Batch-fetch artist names for display
    const openPositions: OpenPositionRow[] = positions || []
    const spotifyIds = [...new Set(openPositions.map(p => p.spotify_id))]
    const artistNameMap: Record<string, string> = {}
    for (let i = 0; i < spotifyIds.length; i += IN_CHUNK_SIZE) {
      const { data: artistRows } = await supabaseAdmin
        .from('artists_with_history')
        .select('spotify_id, artist_name')
        .in('spotify_id', spotifyIds.slice(i, i + IN_CHUNK_SIZE))
      for (const row of artistRows || []) {
        artistNameMap[row.spotify_id] = row.artist_name
      }
    }

    const trades = openPositions.map(p => ({
      ...p,
      position: p.position_type,
      artist_name: artistNameMap[p.spotify_id] ?? p.spotify_id,
      entry_price: parseFloat(p.entry_price),
      total_cost: parseFloat(p.total_cost),
    }))

    return NextResponse.json({ trades })
  } catch (error) {
    console.error('Error in my-positions route:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
