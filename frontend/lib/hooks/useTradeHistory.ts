'use client'

import { useAuthedResource } from './useAuthedResource'
import type { ClosedPosition } from './usePortfolio'

/** Closed positions for the signed-in user. Same cache and revalidation as
 *  usePortfolio, so closing a position updates both lists together. */
export function useTradeHistory(enabled = true) {
  const { data, ...rest } = useAuthedResource<{ history: ClosedPosition[] }>(
    enabled ? '/api/trades/history' : null,
  )
  return { ...rest, history: data?.history ?? [] }
}
