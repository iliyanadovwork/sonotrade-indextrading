import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db/supabase'

export const dynamic = 'force-dynamic'

// GET /api/leaderboard?limit=50&offset=0&sort=pnl|volume
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)
    const sort = searchParams.get('sort') === 'volume' ? 'total_volume' : 'total_pnl'

    const { data, error, count } = await supabaseAdmin
      .from('user_leaderboard')
      .select('id, username, avatar_url, total_pnl, total_volume, total_trades, open_positions, winning_trades', { count: 'exact' })
      .order(sort, { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Leaderboard error:', error)
      return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 })
    }

    return NextResponse.json(
      {
        success: true,
        leaderboard: data || [],
        total: count || 0,
        hasMore: offset + limit < (count || 0),
      },
      // Aggregate over all users and identical for every viewer, so it is
      // safe at the shared cache. Ranks move on trades, not continuously.
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
    )
  } catch (error) {
    console.error('Leaderboard route error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
