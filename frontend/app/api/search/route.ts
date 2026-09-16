import { NextRequest, NextResponse } from 'next/server'
import { SUPABASE_ANON_KEY } from "@/lib/supabase/env"
import { searchSpotifyArtists, isSpotifyConfigured } from '@/lib/spotify'

export const dynamic = 'force-dynamic'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

function sbFetch(url: string) {
  return fetch(url, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }, cache: 'no-store' })
}

interface Result {
  id: string
  name: string
  image_url: string
  index_price: number
  holders: number
  change_1m: number
  volume: number
  /** false = exists on Spotify but has no market yet; POST /api/artists/list to create one. */
  listed: boolean
}

// Searches listed markets first, then fills the tail with unlisted Spotify
// artists so ANY artist is findable — clicking an unlisted one lists it and
// starts tracking from that moment.
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim()
  if (!q) return NextResponse.json({ results: [] })

  const url = new URL(`${SUPABASE_URL}/rest/v1/artists_with_history`)
  url.searchParams.set('select', 'spotify_id,artist_name,spotify_img,current_index_value,change_1m,volume')
  url.searchParams.set('artist_name', `ilike.*${q}*`)
  url.searchParams.set('limit', '20')

  const res = await sbFetch(url.toString())
  const rows: {
    spotify_id: string; artist_name: string; spotify_img: string | null
    current_index_value: number | null; change_1m: number | null; volume: number | null
  }[] = res.ok ? await res.json() : []

  const listed: Result[] = rows.map(r => ({
    id: r.spotify_id, name: r.artist_name, image_url: r.spotify_img ?? '',
    index_price: r.current_index_value ?? 0, holders: 0,
    change_1m: r.change_1m ?? 0, volume: r.volume ?? 0, listed: true,
  })).sort((a, b) => b.index_price - a.index_price)

  // Spotify fill-in is best-effort: if it's unconfigured or erroring, search
  // still works against our own catalog.
  // Fill the remaining slots (capped at Spotify's max of 10 per request) with
  // catalog artists that have no market yet.
  let unlisted: Result[] = []
  const slots = Math.min(20 - listed.length, 10)
  if (isSpotifyConfigured() && slots > 0) {
    try {
      const known = new Set(listed.map(r => r.id))
      const needle = q.toLowerCase()
      unlisted = (await searchSpotifyArtists(q, slots))
        .filter(a => !known.has(a.id))
        // Spotify's relevance ranking is loose — a search for "drake" also
        // returns Michael Jackson and Ariana Grande. Keep only genuine name
        // matches so the unlisted tail doesn't read as random noise.
        .filter(a => a.name.toLowerCase().includes(needle))
        .map(a => ({
          id: a.id, name: a.name, image_url: a.image_url ?? '',
          index_price: 0, holders: 0, change_1m: 0, volume: 0, listed: false,
        }))
    } catch (err) {
      console.error('[search] spotify lookup failed', err)
    }
  }

  return NextResponse.json(
    { results: [...listed, ...unlisted] },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } },
  )
}
