import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db/supabase'
import { requireAuth } from '@/lib/auth'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

interface HistoryRow {
  spotify_id: string
  artist_name: string | null
}

export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request)
    if ('response' in auth) return auth.response
    const userId = auth.claims.userId

    const { searchParams } = new URL(request.url)
    const rawLimit = Number.parseInt(searchParams.get('limit') ?? '', 10)
    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(rawLimit, 1), MAX_LIMIT)
      : DEFAULT_LIMIT

    const { data: rawHistory, error } = await supabaseAdmin
      .from('positions')
      .select('id, spotify_id, artist_name, position_type, contracts, entry_price, current_price, total_cost, unrealized_pnl, opened_at, closed_at, status')
      .in('status', ['closed', 'liquidated'])
      .eq('user_id', userId)
      .order('closed_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching trade history:', error)
      return NextResponse.json({ error: 'Failed to fetch trade history' }, { status: 500 })
    }

    const history = ((rawHistory || []) as HistoryRow[]).map(p => ({
      ...p,
      artist_name: p.artist_name ?? p.spotify_id,
    }))

    return NextResponse.json({ history })
  } catch (error) {
    console.error('Error in trade history route:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
