'use client'

import { createClient } from '@/lib/supabase/client'

/**
 * Single shared `artists_with_history` realtime subscription per market.
 *
 * `useLivePriceHistory` and `useLiveMarketStats` both need UPDATEs on the same
 * row. Opening one channel each meant 2+ subscriptions per viewer per artist
 * page (1000 concurrent viewers = 2000+ server-side subscriptions). This
 * multiplexes them onto one channel, ref-counted by listener.
 */

export interface ArtistRowUpdate {
  spotify_id?: string
  current_index_value?: number | string | null
  change_1h?: number | null
  change_1d?: number | null
  change_1w?: number | null
  volume?: number | null
}

type Listener = (row: ArtistRowUpdate) => void

interface Entry {
  listeners: Set<Listener>
  close: () => void
  pendingClose: ReturnType<typeof setTimeout> | null
}

const entries = new Map<string, Entry>()

function open(profileId: string, ticker: string): Entry {
  const listeners = new Set<Listener>()
  const supabase = createClient()
  // Random suffix: supabase-js throws `cannot add postgres_changes callbacks
  // after subscribe()` when two channels share a topic across module
  // instances or HMR boundaries.
  const suffix = Math.random().toString(36).slice(2, 8)
  const channel = supabase.channel(`artist-row:${profileId}:${suffix}`)
  channel
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'artists_with_history',
        filter: `spotify_id=eq.${ticker}`,
      },
      (payload) => {
        const row = payload.new as ArtistRowUpdate
        for (const listener of [...listeners]) listener(row)
      }
    )
    .subscribe()

  return {
    listeners,
    close: () => { supabase.removeChannel(channel) },
    pendingClose: null,
  }
}

/**
 * Subscribe to UPDATEs on one artist row. Returns an unsubscribe function;
 * the underlying channel is torn down once the last listener leaves.
 */
export function subscribeToArtistRow(
  profileId: string,
  ticker: string,
  listener: Listener,
): () => void {
  const key = `${profileId}::${ticker}`
  let entry = entries.get(key)
  if (!entry) {
    entry = open(profileId, ticker)
    entries.set(key, entry)
  } else if (entry.pendingClose) {
    clearTimeout(entry.pendingClose)
    entry.pendingClose = null
  }
  entry.listeners.add(listener)

  return () => {
    const e = entries.get(key)
    if (!e) return
    e.listeners.delete(listener)
    if (e.listeners.size > 0 || e.pendingClose) return
    // Deferred teardown: a StrictMode/HMR remount unsubscribes and
    // resubscribes synchronously, and tearing the channel down in between
    // would churn a websocket join/leave pair on every mount.
    e.pendingClose = setTimeout(() => {
      if (e.listeners.size > 0) { e.pendingClose = null; return }
      entries.delete(key)
      e.close()
    }, 0)
  }
}
