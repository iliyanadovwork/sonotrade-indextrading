'use client'

import { useCallback, useRef, useState } from 'react'
import { createIdempotencyHolder } from '@/lib/idempotency'

/**
 * The one way to close a position.
 *
 * There were four hand-copied implementations of this — portfolio/page,
 * SXOpenPosition, MobilePortfolioPanel, MobileOpenPosition — each ~39 lines of
 * the same fetch with a different spelling. The cost was not maintenance in the
 * abstract: adding idempotency keys meant editing five separate call sites, and
 * getting four right would have left the fifth silently on the old behaviour.
 *
 * Two real bugs were folded in while unifying:
 *
 *   1. The two portfolio handlers dispatched NO events, so closing from the
 *      portfolio left SXOpenPosition, MobileOpenPosition and SXTradingPanel
 *      showing stale positions and a stale balance until something else
 *      happened to refetch. Both events now fire on every close; the listeners
 *      are plain refetches, so firing them more often is only ever more correct.
 *   2. The same two swallowed failures entirely (`if (res.ok) refetch()` with
 *      no else), so a close that failed just stopped spinning. The result is
 *      now a value the caller has to look at.
 *
 * Presentation is deliberately NOT unified. SXOpenPosition alerts, the mobile
 * sheet renders inline error text, the portfolio rows show a per-row spinner —
 * those are real differences, so the hook returns a result and owns none of it.
 */

export type ClosePositionResult =
  | { ok: true; totalProfitLoss: number | null; newBalance: number | null }
  | { ok: false; error: string }

export function useClosePosition() {
  const idempotency = useRef(createIdempotencyHolder()).current
  // Holds whatever the caller wants to key its spinner on: a position id for
  // per-row spinners, a spotify id for whole-widget ones.
  const [closingId, setClosingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const close = useCallback(
    async (spotifyId: string, trackingId?: string): Promise<ClosePositionResult> => {
      const token = localStorage.getItem('auth_token')
      if (!token) {
        const failure = { ok: false as const, error: 'Please log in to close positions' }
        setError(failure.error)
        return failure
      }

      setClosingId(trackingId ?? spotifyId)
      setError(null)
      try {
        const res = await fetch('/api/trades/close', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotency.take(),
          },
          body: JSON.stringify({ spotify_id: spotifyId }),
        })
        // The server answered, so this intent is settled — the next close is a
        // new one. Only a request that never got a reply keeps the key alive.
        idempotency.settle()

        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          const message = (data as { error?: string }).error ?? 'Failed to close. Try again.'
          setError(message)
          return { ok: false, error: message }
        }

        // Every open-position widget and the trading panel listen for these.
        window.dispatchEvent(new Event('tradeComplete'))
        window.dispatchEvent(new Event('storage'))

        const body = data as { total_profit_loss?: number; new_balance?: number }
        return {
          ok: true,
          totalProfitLoss: body.total_profit_loss ?? null,
          newBalance: body.new_balance ?? null,
        }
      } catch {
        const message = 'Network error. Please try again.'
        setError(message)
        return { ok: false, error: message }
      } finally {
        setClosingId(null)
      }
    },
    [idempotency],
  )

  return {
    close,
    closingId,
    isClosing: closingId !== null,
    error,
    clearError: useCallback(() => setError(null), []),
  }
}
