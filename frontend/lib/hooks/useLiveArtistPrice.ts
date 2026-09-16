'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Live artist index price via Supabase Realtime (replaces the old 10s polling).
 *
 * Subscribes to UPDATE events on `artists_with_history` for one spotify_id and
 * tracks `current_index_value`. Seeded from the SSR value so there's no fetch on
 * mount. The index only moves when the daily stream sync runs, so this channel
 * is usually idle — far cheaper than a 10s poll per open artist page.
 *
 * Requires Realtime to be enabled on the `artists_with_history` table
 * (added to the `supabase_realtime` publication — see the Phase 2 migration).
 */
export function useLiveArtistPrice(
  spotifyId: string | null,
  initialPrice: number | null
): number | null {
  const [price, setPrice] = useState<number | null>(initialPrice)

  // Keep in sync if the SSR seed changes (e.g. client-side nav to another artist)
  const seedRef = useRef(initialPrice)
  useEffect(() => {
    if (seedRef.current !== initialPrice) {
      seedRef.current = initialPrice
      setPrice(initialPrice)
    }
  }, [initialPrice])

  useEffect(() => {
    if (!spotifyId) return
    const supabase = createClient()
    const suffix = Math.random().toString(36).slice(2, 8)
    const channel = supabase
      .channel(`artist-price:${spotifyId}:${suffix}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'artists_with_history',
          filter: `spotify_id=eq.${spotifyId}`,
        },
        (payload) => {
          const row = payload.new as { current_index_value?: number | null }
          const next = row?.current_index_value
          if (next != null && Number.isFinite(Number(next))) setPrice(Number(next))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [spotifyId])

  return price
}
