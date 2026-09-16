import { NextResponse } from 'next/server'
import { SUPABASE_ANON_KEY } from '@/lib/supabase/env'

export const dynamic = 'force-dynamic'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

// Featured Spotify artist IDs whose latest release seeds the album slideshow.
const FEATURED_ARTIST_IDS = [
  '0du5cEVh5yTK9QJze8zA0C', // Bruno Mars
  '06HL4z0CvFAxyc27GXpf02', // Taylor Swift
  '3TVXtAsR1Inumwj472S9r4', // Drake
  '1Xyo4u8uXC1ZmMpatF05PJ', // The Weeknd
  '66CXWjxzNUsdJxJ2JdwvnR', // Ariana Grande
  '6eUKZXaKkcviH0Ku9w2n3V', // Ed Sheeran
  '1uNFoZAHBGtllmzznpCI3s', // Justin Bieber
  '6qqNVTkY8uBg9cP3Jd7DAH', // Billie Eilish
  '4q3ewBCX7sLwd24euuV69X', // Bad Bunny
  '7dGJo4pcD2V6oG8kP0tJRR', // Eminem
]

interface Release { id?: string; name?: string; image?: string; date?: string; url?: string }

export async function GET() {
  try {
    const url = new URL(`${SUPABASE_URL}/rest/v1/artists_with_history`)
    url.searchParams.set('select', 'artist_name,spotify_id,releases')
    url.searchParams.set('spotify_id', `in.(${FEATURED_ARTIST_IDS.join(',')})`)
    const res = await fetch(url.toString(), {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      next: { revalidate: 300 },
    })
    if (!res.ok) return NextResponse.json({ albums: [], count: 0 }, { status: 500 })
    const rows: { artist_name: string; spotify_id: string; releases: unknown }[] = await res.json()

    const albums = rows
      .map(artist => {
        let releases: Release[] = []
        if (artist.releases) {
          releases = typeof artist.releases === 'string'
            ? (() => { try { return JSON.parse(artist.releases as string) } catch { return [] } })()
            : (artist.releases as Release[])
        }
        if (releases.length > 0) {
          const r = releases[0]
          return { id: r.id, name: r.name, image: r.image, artist: artist.artist_name, date: r.date, url: r.url }
        }
        return null
      })
      .filter(Boolean)

    return NextResponse.json(
      { albums, count: albums.length },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
    )
  } catch {
    return NextResponse.json({ albums: [], count: 0 }, { status: 500 })
  }
}
