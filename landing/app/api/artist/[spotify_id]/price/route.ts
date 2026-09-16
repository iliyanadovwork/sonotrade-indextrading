import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ spotify_id: string }> }
) {
  try {
    const { spotify_id } = await params
    const spotifyId = decodeURIComponent(spotify_id)

    const { data, error } = await supabase
      .from('artists_with_history')
      .select('current_index_value, last_updated')
      .eq('spotify_id', spotifyId)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Price not found' }, { status: 404 })
    }

    return NextResponse.json(
      {
        index: Number(data.current_index_value),
        timestamp: data.last_updated,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    )
  } catch (error) {
    console.error('[artist/price] server error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
