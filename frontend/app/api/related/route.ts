import { NextRequest, NextResponse } from 'next/server'
import { SUPABASE_ANON_KEY } from "@/lib/supabase/env"

export const dynamic = 'force-dynamic'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

function sbFetch(url: string) {
  return fetch(url, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }, cache: 'no-store' })
}

// REWIRED to sonotrade: ids === spotify_ids.
export async function GET(request: NextRequest) {
  const ids = (request.nextUrl.searchParams.get('ids') ?? '').split(',').map(s => s.trim()).filter(Boolean)
  if (!ids.length) return NextResponse.json({ artists: [] })
  const url = new URL(`${SUPABASE_URL}/rest/v1/artists_with_history`)
  url.searchParams.set('select', 'spotify_id,artist_name,spotify_img,current_index_value,change_1m,volume')
  url.searchParams.set('spotify_id', `in.(${ids.join(',')})`)
  const res = await sbFetch(url.toString())
  if (!res.ok) return NextResponse.json({ artists: [] }, { status: 500 })
  const rows: { spotify_id: string; artist_name: string; spotify_img: string | null; current_index_value: number | null; change_1m: number | null; volume: number | null }[] = await res.json()
  const artists = rows.map(r => ({
    id: r.spotify_id, name: r.artist_name, image_url: r.spotify_img ?? null,
    index_price: r.current_index_value ?? 0, holders: 0, volume: r.volume ?? 0, change_1m: r.change_1m ?? null,
  }))
  // Same list for every viewer; changes only when the catalog does.
  return NextResponse.json(
    { artists },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900' } },
  )
}
