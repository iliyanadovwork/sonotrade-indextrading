import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth'
import { rateLimit, acquireLock, releaseLock } from '@/lib/rateLimit'
import { fetchMonthlyListeners, MIN_INDEX_VALUE } from '@/lib/spotify-listeners'
import { fetchArtistContent } from '@/lib/artist-enrich'
import { isUsableBio } from '@/lib/wikipedia-bio'

export const dynamic = 'force-dynamic'

const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/
/** Don't re-scrape an artist more often than this, however many people view them. */
const STALE_AFTER_MS = 6 * 60 * 60 * 1000
/**
 * Mirrors the scraper's clamp (scraper/src/index-math.ts): one bad parse must
 * not be able to wreck a price series.
 */
const MAX_MOVE = 0.25

/**
 * Lazily refresh one artist's index when their profile is opened.
 *
 * The daily scraper only covers the "hot" tier (artists with open positions +
 * top volume) because paying to scrape thousands of untouched artists is
 * waste. Everyone else updates here, on demand, using the free listener
 * source — so an artist is current whenever someone actually looks at them.
 *
 * Fire-and-forget from the client: the response is advisory, and a failure
 * just leaves the previous price in place.
 *
 * AUTH IS REQUIRED even though this reads like a cache-warm. It writes to the
 * price series every position's P&L is computed from, and monthly-listener
 * counts are public — so an anonymous caller could read the pending move,
 * observe its sign, open a position, trigger the refresh, and close for a
 * near-risk-free gain. It also spends money upstream (Apify).
 */
export async function POST(request: NextRequest) {
  const auth = requireAuth(request)
  if ('response' in auth) return auth.response
  const userId = auth.claims.userId

  let lockKey: string | null = null
  try {
    const { spotify_id: spotifyId } = (await request.json()) as { spotify_id?: string }
    if (!spotifyId || !SPOTIFY_ID.test(spotifyId)) {
      return NextResponse.json({ error: 'Valid spotify_id is required' }, { status: 400 })
    }

    const rl = await rateLimit(`refresh:${userId}`, 30, 600)
    if (!rl.allowed) {
      return NextResponse.json({ refreshed: false, reason: 'rate_limited' }, { status: 429 })
    }

    const supabase = createAdminClient()
    const { data: artist } = await supabase
      .from('artists_with_history')
      .select('spotify_id, artist_name, current_index_value, monthly_listeners, last_updated, biography, gallery')
      .eq('spotify_id', spotifyId)
      .maybeSingle<{
        spotify_id: string; artist_name: string
        current_index_value: number | null; monthly_listeners: number | null
        last_updated: string | null
        biography: string | null; gallery: string[] | null
      }>()

    if (!artist) return NextResponse.json({ error: 'Not listed' }, { status: 404 })

    // Claim the refresh atomically BEFORE doing any upstream work. The old
    // code read last_updated, then scraped, then wrote — a read-then-write race
    // with no lock, so 100 simultaneous viewers of one stale artist triggered
    // 100 concurrent paid scrapes. Stamping last_updated as part of the
    // condition means exactly one caller wins.
    const claim = await supabase
      .from('artists_with_history')
      .update({ last_updated: new Date().toISOString() })
      .eq('spotify_id', spotifyId)
      .lt('last_updated', new Date(Date.now() - STALE_AFTER_MS).toISOString())
      .select('spotify_id')
    const claimed = (claim.data?.length ?? 0) > 0

    if (!claimed) {
      return NextResponse.json({ refreshed: false, reason: 'fresh', enriched: false })
    }

    // Second layer: acquireLock fails CLOSED (false when Redis is unavailable),
    // and for a billed scrape "skip" is the safe outcome.
    lockKey = `refresh:${spotifyId}`
    if (!(await acquireLock(lockKey, 60))) {
      lockKey = null
      return NextResponse.json({ refreshed: false, reason: 'in_progress', enriched: false })
    }

    // Self-heal missing About content. Catches artists listed before
    // enrichment existed, ones whose enrichment failed, and the ~212 originals
    // that never had a biography. Now gated behind the staleness claim above —
    // previously it ran on EVERY request, so any artist with a thin bio meant
    // an Apify/Spotify call per anonymous page view.
    let enriched = false
    if (!isUsableBio(artist.biography) || !(artist.gallery?.length)) {
      const content = await fetchArtistContent(spotifyId, artist.artist_name)
      if (content) {
        const upd = await supabase
          .from('artists_with_history')
          .update({
            biography: content.biography ?? artist.biography,
            top_cities: content.top_cities?.length ? content.top_cities : undefined,
            top_tracks: content.top_tracks?.length ? content.top_tracks : undefined,
            releases: content.releases?.length ? content.releases : undefined,
            gallery: content.gallery?.length ? content.gallery : undefined,
            followers: content.followers ?? undefined,
            instagram: content.instagram ?? undefined,
            twitter: content.twitter ?? undefined,
            tiktok: content.tiktok ?? undefined,
            facebook: content.facebook ?? undefined,
          })
          .eq('spotify_id', spotifyId)
        if (upd.error) console.error('[refresh] content update failed', upd.error.message)
        // Signals the client to re-render so the new About content appears
        // without a manual reload.
        else enriched = Boolean(content.biography || content.gallery?.length)
      }
    }

    const listeners = await fetchMonthlyListeners(spotifyId)
    if (listeners == null) return NextResponse.json({ refreshed: false, reason: 'unavailable', enriched })

    // Same relative-change model as the scraper: continue the existing index
    // from the listener delta, so on-demand and scheduled updates produce an
    // identical, continuous series.
    const prevIndex = artist.current_index_value ?? 0
    const prevListeners = artist.monthly_listeners
    let index = prevIndex
    if (prevListeners && prevListeners > 0 && prevIndex > 0) {
      const raw = (listeners - prevListeners) / prevListeners
      const pct = Math.abs(raw) > MAX_MOVE ? Math.sign(raw) * MAX_MOVE : raw
      index = Math.max(MIN_INDEX_VALUE, Math.round(prevIndex * (1 + pct) * 1e6) / 1e6)
    }

    const { error } = await supabase.rpc('scraper_ingest', {
      p_spotify_id: spotifyId,
      p_artist_name: artist.artist_name,
      p_monthly_listeners: listeners,
      p_index: index,
    })
    if (error) {
      console.error('[artists/refresh] ingest failed', error.message)
      return NextResponse.json({ refreshed: false, reason: 'write_failed', enriched })
    }

    return NextResponse.json({ refreshed: true, index, monthly_listeners: listeners, enriched })
  } catch (err) {
    console.error('[artists/refresh] error', err)
    return NextResponse.json({ refreshed: false, reason: 'error' })
  } finally {
    if (lockKey) await releaseLock(lockKey)
  }
}
