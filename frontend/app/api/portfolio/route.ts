import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db/supabase'
import { requireAuth } from '@/lib/auth'

// PostgREST puts `in.(...)` in the URL, so an unbounded id list eventually
// exceeds the request-line limit and 414s.
const IN_CHUNK_SIZE = 100
const MAX_OPEN_POSITIONS = 500

interface OpenPositionRow {
  id: string
  spotify_id: string
  position_type: string
  contracts: number
  entry_price: string
  total_cost: string
  opened_at: string
}

export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    if ('response' in auth) return auth.response
    const userId = auth.claims.userId

    const [{ data: user }, { data: positions }] = await Promise.all([
      supabaseAdmin.from('users').select('balance, username').eq('id', userId).single(),
      supabaseAdmin
        .from('positions')
        .select('id, spotify_id, position_type, contracts, entry_price, total_cost, opened_at')
        .eq('user_id', userId)
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(MAX_OPEN_POSITIONS),
    ])

    const openPositions: OpenPositionRow[] = positions || []
    const spotifyIds = [...new Set(openPositions.map(p => p.spotify_id))]
    const indexPriceMap: Record<string, number> = {}
    const artistNameMap: Record<string, string> = {}

    for (let i = 0; i < spotifyIds.length; i += IN_CHUNK_SIZE) {
      const { data: artistRows } = await supabaseAdmin
        .from('artists_with_history')
        .select('spotify_id, artist_name, current_index_value')
        .in('spotify_id', spotifyIds.slice(i, i + IN_CHUNK_SIZE))

      for (const row of artistRows || []) {
        artistNameMap[row.spotify_id] = row.artist_name
        if (row.current_index_value != null) {
          indexPriceMap[row.spotify_id] = parseFloat(row.current_index_value) || 0
        }
      }
    }

    const enrichedPositions = openPositions.map(p => {
      const entryPrice    = parseFloat(p.entry_price)
      const totalCost     = parseFloat(p.total_cost)
      const currentPrice  = indexPriceMap[p.spotify_id] ?? entryPrice
      const marketValue   = p.contracts * currentPrice
      const unrealizedPnl = p.position_type === 'long'
        ? (currentPrice - entryPrice) * p.contracts
        : (entryPrice - currentPrice) * p.contracts

      return {
        id:             p.id,
        spotify_id:     p.spotify_id,
        artist_name:    artistNameMap[p.spotify_id] ?? p.spotify_id,
        position_type:  p.position_type,
        contracts:      p.contracts,
        entry_price:    entryPrice,
        current_price:  currentPrice,
        total_cost:     totalCost,
        market_value:   marketValue,
        unrealized_pnl: unrealizedPnl,
        opened_at:      p.opened_at,
      }
    })

    const totalUnrealizedPnl = enrichedPositions.reduce((s, p) => s + p.unrealized_pnl, 0)
    const totalMarketValue   = enrichedPositions.reduce((s, p) => s + p.market_value, 0)
    const balance            = parseFloat(user?.balance) || 0

    return NextResponse.json({
      balance,
      username:             user?.username || '',
      total_market_value:   totalMarketValue,
      total_unrealized_pnl: totalUnrealizedPnl,
      positions:            enrichedPositions,
      open_orders:          [],
      order_history:        [],
    })
  } catch (error) {
    console.error('Portfolio error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
