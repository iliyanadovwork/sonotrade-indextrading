'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Lazy refresh for an artist's index and About content, fired when a profile
 * opens.
 *
 * Two jobs:
 *  - Price: the daily scraper only covers the hot tier (traded artists), so
 *    everyone else would otherwise go stale indefinitely. The endpoint no-ops
 *    if the price is under 6h old, so repeat views cost nothing.
 *  - Content: a just-listed artist arrives with artwork and releases only —
 *    biography / top cities / top tracks take ~5s to fetch, so listing doesn't
 *    block on them. When they land, `router.refresh()` re-renders the server
 *    component in place and the About section fills in without a reload.
 *
 * The refresh is deliberately scoped to CONTENT arriving. A price that shifts
 * under someone mid-trade is worse than one that's a few hours stale, so the
 * endpoint reports whether it actually wrote new content and we only re-render
 * for that.
 */
export function useArtistRefresh(spotifyId: string | null | undefined) {
  const router = useRouter()

  useEffect(() => {
    if (!spotifyId) return
    // The endpoint requires a session: it writes the price series every
    // position's P&L derives from, and it spends money upstream. Signed-out
    // visitors would just collect 401s, so don't ask. Their view still counts —
    // the next signed-in viewer, or the daily scraper, does the refresh.
    if (typeof window !== 'undefined' && !localStorage.getItem('auth_token')) return

    const controller = new AbortController()
    let cancelled = false

    fetch('/api/artists/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spotify_id: spotifyId }),
      signal: controller.signal,
    })
      .then(res => (res.ok ? res.json() : null))
      .then((data: { enriched?: boolean } | null) => {
        // Only re-render when About content was actually added — otherwise a
        // routine price refresh would repaint the page for no visible reason.
        if (!cancelled && data?.enriched) router.refresh()
      })
      .catch(() => {
        // Advisory only — a failed refresh leaves the existing data in place.
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [spotifyId, router])
}
