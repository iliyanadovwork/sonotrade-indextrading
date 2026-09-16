'use client'

import { useEffect, useState } from 'react'
import type { MarketStatsLive } from '@/lib/data'
import { subscribeToArtistRow, type ArtistRowUpdate } from './artistRowSubscription'

// Re-export under the historical name so callers don't need to update.
export type LiveMarketStats = MarketStatsLive

function num(value: number | string | null | undefined): number | null {
  if (value == null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Map an `artists_with_history` UPDATE payload onto the stats shape, using the
 * same column→field mapping as `getMarketStats`. `holders` / `market_cap`
 * aren't in the row — carry the previous values.
 *
 * `row.volume` is the LIFETIME accumulator (`total_forecasts`), not the 24h
 * figure, so it is never copied into `volume_24h`. Every increase in it is a
 * fill that happened just now, which by definition falls inside the rolling
 * 24h window — so the delta since the last known accumulator value is added
 * to `volume_24h`. Closes don't touch the accumulator; see the
 * `tradeComplete` refetch below for the viewer's own closes.
 */
function applyRow(prev: LiveMarketStats, row: ArtistRowUpdate): LiveMarketStats {
  const price = num(row.current_index_value)
  const change_1h = num(row.change_1h)
  const change_24h = num(row.change_1d)
  const change_7d = num(row.change_1w)
  const lifetimeVolume = num(row.volume)
  const volumeDelta = lifetimeVolume == null ? 0 : lifetimeVolume - prev.total_forecasts
  const next: LiveMarketStats = {
    ...prev,
    ...(price != null ? { price } : {}),
    ...(change_1h != null ? { change_1h } : {}),
    ...(change_24h != null ? { change_24h } : {}),
    ...(change_7d != null ? { change_7d } : {}),
    ...(lifetimeVolume != null ? { total_forecasts: lifetimeVolume } : {}),
    ...(volumeDelta > 0 ? { volume_24h: round2(prev.volume_24h + volumeDelta) } : {}),
  }
  const unchanged =
    next.price === prev.price &&
    next.change_1h === prev.change_1h &&
    next.change_24h === prev.change_24h &&
    next.change_7d === prev.change_7d &&
    next.volume_24h === prev.volume_24h &&
    next.total_forecasts === prev.total_forecasts
  return unchanged ? prev : next
}

export function useLiveMarketStats(
  ticker: string,
  profileId: string | null,
  initial: LiveMarketStats,
  livePrice?: number,
): LiveMarketStats {
  const [stats, setStats] = useState<LiveMarketStats>(initial)

  // Reset when the caller navigates to a different artist. React's documented
  // adjust-state-during-render pattern uses state, not a ref: a ref read or
  // written during render is not tracked, so the reset can be missed.
  const [trackedTicker, setTrackedTicker] = useState(ticker)
  if (ticker !== trackedTicker) {
    setTrackedTicker(ticker)
    setStats(initial)
  }

  // Keep price in sync with the chart's live feed without a refetch
  useEffect(() => {
    if (livePrice == null) return
    setStats(prev => prev.price === livePrice ? prev : { ...prev, price: livePrice })
  }, [livePrice])

  useEffect(() => {
    if (!profileId || !ticker) return
    return subscribeToArtistRow(profileId, ticker, (row) => {
      if (row.spotify_id && row.spotify_id !== ticker) return
      setStats(prev => applyRow(prev, row))
    })
  }, [profileId, ticker])

  // The viewer's own fills fire `tradeComplete` (SXTradingPanel and
  // useClosePosition). Closes never update the artist row, so the realtime
  // delta above can't see them; pull the server-computed 24h figure instead.
  // Both the accumulator and the 24h value come back, so a realtime UPDATE
  // that lands afterwards sees a zero delta and doesn't double count.
  useEffect(() => {
    if (!ticker) return
    let cancelled = false
    const onTrade = async () => {
      try {
        const res = await fetch(`/api/markets/${encodeURIComponent(ticker)}/stats`, { cache: 'no-store' })
        if (!res.ok) return
        const body = (await res.json()) as { stats?: Partial<LiveMarketStats> }
        const volume_24h = num(body.stats?.volume_24h)
        const total_forecasts = num(body.stats?.total_forecasts)
        if (cancelled || volume_24h == null || total_forecasts == null) return
        setStats(prev =>
          prev.volume_24h === volume_24h && prev.total_forecasts === total_forecasts
            ? prev
            : { ...prev, volume_24h, total_forecasts },
        )
      } catch {
        // Keep the delta-derived figure; the next page load is authoritative.
      }
    }
    window.addEventListener('tradeComplete', onTrade)
    return () => {
      cancelled = true
      window.removeEventListener('tradeComplete', onTrade)
    }
  }, [ticker])

  return stats
}
