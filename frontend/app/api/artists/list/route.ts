import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getClaimsFromRequest } from '@/lib/auth'
import { rateLimit } from '@/lib/rateLimit'
import { callerIp } from '@/lib/rate-limits'
import { getSpotifyArtist, isSpotifyConfigured } from '@/lib/spotify'
import { fetchMonthlyListeners, seedIndexFromListeners } from '@/lib/spotify-listeners'
import { fetchFastContent } from '@/lib/artist-enrich'

export const dynamic = 'force-dynamic'

const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/

/**
 * List a Spotify artist as a tradeable market on demand.
 *
 * Search can surface any artist in Spotify's catalog; this is what turns one
 * into something you can actually trade. The new market opens at an index
 * derived from the artist's current monthly listeners (same scale as the
 * existing catalog), with a single data point at "now" — so its chart starts
 * from the moment of listing rather than pretending to have history. The
 * scraper picks it up automatically on its next run.
 *
 * Idempotent: listing an already-listed artist just returns it.
 *
 * Anonymous callers are allowed but throttled hard per IP (fail-closed):
 * tapping an unlisted search result must open the artist like any other —
 * bouncing a logged-out visitor to sign-up killed the search-to-first-artist
 * funnel. The abuse concern that used to justify requiring auth (enumerating
 * Spotify IDs to grow the tradeable-market table without bound) is handled by
 * the per-IP budget instead: 3 listings/hour/IP caps table growth at crawl
 * speed while a human exploring search never hits it.
 */
export async function POST(request: NextRequest) {
  const claims = getClaimsFromRequest(request)

  try {
    const { spotify_id: spotifyId } = (await request.json()) as { spotify_id?: string }
    if (!spotifyId || !SPOTIFY_ID.test(spotifyId)) {
      return NextResponse.json({ error: 'Valid spotify_id is required' }, { status: 400 })
    }

    const rl = claims
      ? await rateLimit(`list-artist:${claims.userId}`, 5, 3600)
      : await rateLimit(`list-artist:ip:${callerIp(request.headers)}`, 3, 3600)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Listing limit reached. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(rl.resetInSeconds) } },
      )
    }

    const supabase = createAdminClient()

    // Already listed? Return it — listing is idempotent, and two users racing
    // to list the same artist must not create a duplicate market.
    const { data: existing } = await supabase
      .from('artists_with_history')
      .select('spotify_id, artist_name, current_index_value')
      .eq('spotify_id', spotifyId)
      .maybeSingle<{ spotify_id: string; artist_name: string; current_index_value: number | null }>()
    if (existing) {
      return NextResponse.json({ artist: existing, created: false })
    }

    if (!isSpotifyConfigured()) {
      return NextResponse.json(
        { error: 'Artist listing is not configured on this server' },
        { status: 503 },
      )
    }

    // Identity from the official API; listeners from the meta-tag route (the
    // official API does not expose monthly listeners).
    const artist = await getSpotifyArtist(spotifyId)
    if (!artist) return NextResponse.json({ error: 'Artist not found on Spotify' }, { status: 404 })

    const listeners = await fetchMonthlyListeners(spotifyId)
    if (listeners == null) {
      return NextResponse.json(
        { error: 'Could not read this artist’s listener count — try again shortly' },
        { status: 502 },
      )
    }

    const index = seedIndexFromListeners(listeners)
    const now = new Date().toISOString()

    // Only the FAST half here (~1.5s of free Spotify calls: artwork +
    // releases). Biography / top cities / top tracks come from Apify and take
    // ~5s, which would make tapping a search result feel broken — the profile
    // page fires /api/artists/refresh on mount, which fills those in and
    // reveals them in place. See lib/use-artist-refresh.ts.
    const content = await fetchFastContent(spotifyId)

    // current_index_value must be written EXPLICITLY. An earlier comment here
    // claimed it's a generated column derived from data_points[last].index —
    // verified false against the live schema (direct writes succeed, and rows
    // seeded without it stayed null). A null here makes place_order_tx raise
    // 55000 "price unavailable", so the freshly listed artist charts a price
    // but can't be traded.
    const { error } = await supabase.from('artists_with_history').insert({
      spotify_id: spotifyId,
      artist_name: artist.name,
      spotify_img: artist.image_url,
      current_index_value: index,
      monthly_listeners: listeners,
      followers: content?.followers ?? artist.followers,
      data_points: [{ index, timestamp: now }],
      last_updated: now,
      volume: 0,
      biography: content?.biography ?? null,
      top_cities: content?.top_cities ?? [],
      top_tracks: content?.top_tracks ?? [],
      releases: content?.releases ?? [],
      // Fall back to the official API's artist image so the gallery is never
      // completely empty.
      gallery: content?.gallery?.length ? content.gallery : (artist.image_url ? [artist.image_url] : []),
    })
    if (error) {
      // 23505 = unique violation: someone listed it a moment ago. Treat the
      // race as success rather than surfacing a confusing error.
      if (error.code === '23505') {
        return NextResponse.json({ artist: { spotify_id: spotifyId, artist_name: artist.name }, created: false })
      }
      console.error('[artists/list] insert failed', error.message)
      return NextResponse.json({ error: 'Could not list this artist' }, { status: 500 })
    }

    return NextResponse.json({
      artist: {
        spotify_id: spotifyId,
        artist_name: artist.name,
        image_url: artist.image_url,
        current_index_value: index,
        monthly_listeners: listeners,
      },
      created: true,
    })
  } catch (err) {
    console.error('[artists/list] error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
