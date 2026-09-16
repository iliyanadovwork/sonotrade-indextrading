'use client'

import { useAuthedResource } from './useAuthedResource'
import type { Position } from './usePortfolio'

/** /api/trades/my-positions returns each row with a `position` alias for
 *  position_type, on top of the portfolio shape. */
export interface MyPosition extends Position {
  position: 'long' | 'short'
}

/**
 * The signed-in user's open positions, optionally for one artist.
 *
 * Four components fetched /api/trades/my-positions with their own effect and
 * state: the desktop and mobile open-position widgets, the trading panel and
 * the trade picker. On an artist page the widget and the trading panel ask for
 * the same artist at the same time, so that pair really was a duplicate
 * request; now they share a cache entry.
 *
 * @param spotifyId  scope to one artist; omit for every open position.
 * @param enabled    false for a surface that mounts before it is visible.
 */
export function useMyPositions(spotifyId?: string | null, enabled = true) {
  const url = !enabled
    ? null
    : spotifyId
      ? `/api/trades/my-positions?spotify_id=${encodeURIComponent(spotifyId)}`
      : '/api/trades/my-positions'
  // The route returns { trades: [...] }, not { positions: [...] } — every
  // caller unwrapped `data.trades` by hand. Normalised here once.
  const { data, ...rest } = useAuthedResource<{ trades: MyPosition[] }>(url)
  return { ...rest, positions: data?.trades ?? [] }
}
