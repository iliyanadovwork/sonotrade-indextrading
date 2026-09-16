import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

function parseJsonish(raw: unknown): unknown {
  if (!raw) return []
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return []
    }
  }
  return raw
}

function buildBody(data: Record<string, unknown>, slim: boolean) {
  const dataPoints =
    (data.data_points as { index: number; timestamp: string }[] | null) || []
  const latestIndex =
    data.current_index_value ??
    (dataPoints.length > 0 ? dataPoints[dataPoints.length - 1].index : null)

  return {
    artist: {
      name: data.artist_name,
      spotify_id: data.spotify_id,
      index_price: latestIndex,
      mark_price: latestIndex,
      change_1h: data.change_1h ?? null,
      change_1d: data.change_1d ?? null,
      change_1w: data.change_1w ?? null,
      last_updated: data.last_updated ?? null,
      data_points: dataPoints,
      image_url: data.spotify_img ?? null,
      ...(!slim && {
        gallery: parseJsonish(data.gallery),
        biography: data.biography ?? null,
        events: parseJsonish(data.events),
        top_tracks: parseJsonish(data.top_tracks),
        top_cities: parseJsonish(data.top_cities),
        releases: parseJsonish(data.releases),
        followers: data.followers ?? null,
        monthly_listeners: data.monthly_listeners ?? null,
        facebook: data.facebook ?? null,
        instagram: data.instagram ?? null,
        twitter: data.twitter ?? null,
        tiktok: data.tiktok ?? null,
        related: parseJsonish(data.related),
      }),
    },
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ spotify_id: string }> }
) {
  try {
    const { spotify_id } = await params
    const spotifyId = decodeURIComponent(spotify_id)
    const slim = request.nextUrl.searchParams.get('slim') === 'true'

    const { data, error } = await supabase
      .from('artists_with_history')
      .select(
        slim
          ? 'artist_name, spotify_id, spotify_img, change_1h, change_1d, change_1w, change_1m, change_1y, volume, current_index_value, data_points, last_updated'
          : '*'
      )
      .eq('spotify_id', spotifyId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Artist not found' }, { status: 404 })
      }
      console.error('[artist] supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Artist not found' }, { status: 404 })
    }

    return NextResponse.json(buildBody(data as unknown as Record<string, unknown>, slim))
  } catch (error) {
    console.error('[artist] server error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
