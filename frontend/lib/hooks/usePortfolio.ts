'use client'

import { useAuthedResource } from './useAuthedResource'

/** Shapes lifted verbatim from what /api/portfolio and /api/trades/history
 *  actually return — previously redeclared in three components. */
export interface Position {
  id: string
  spotify_id?: string | null
  artist_name: string
  position_type: 'long' | 'short'
  contracts: number
  entry_price: number
  current_price: number
  total_cost: number
  market_value: number
  unrealized_pnl: number
  opened_at: string
}

export interface ClosedPosition extends Omit<Position, 'market_value'> {
  closed_at: string
  status: 'closed' | 'liquidated'
}

export interface PortfolioData {
  balance: number
  username: string
  total_market_value: number
  total_unrealized_pnl: number
  positions: Position[]
  open_orders: unknown[]
  order_history: unknown[]
}

/**
 * The signed-in user's portfolio.
 *
 * The portfolio page, the mobile portfolio panel and the profile page each
 * fetched /api/portfolio with their own effect, state, loading flag and a
 * locally redeclared copy of these three interfaces. They now share one cache
 * entry, and any trade revalidates it for all of them.
 *
 * Pass enabled=false for a surface that mounts before it is visible — the
 * mobile panel renders ahead of being opened.
 */
export function usePortfolio(enabled = true) {
  return useAuthedResource<PortfolioData>(enabled ? '/api/portfolio' : null)
}
