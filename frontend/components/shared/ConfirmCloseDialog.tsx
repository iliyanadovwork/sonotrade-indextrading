'use client'

import { useEffect, useState } from 'react'
import { CSXText } from '@/components/sx/core/CSXText'

/**
 * Confirmation step before closing a position — one mis-tap used to be enough
 * to close a trade. Users who opt out via "Don't ask again" skip it from then
 * on (per browser).
 */
const SKIP_KEY = 'sonotrade:skip-close-confirm'

export function shouldSkipCloseConfirm(): boolean {
  try { return localStorage.getItem(SKIP_KEY) === '1' } catch { return false }
}

export function ConfirmCloseDialog({
  open,
  artistName,
  positionCount,
  side,
  contracts,
  estPnl,
  busy = false,
  zIndex = 1100,
  onConfirm,
  onCancel,
}: {
  open: boolean
  /** Omitted on surfaces already scoped to one artist (mobile drawer). */
  artistName?: string
  positionCount: number
  side: 'long' | 'short'
  contracts: number
  /** Unrealized P&L to preview, when the caller has a live price. */
  estPnl?: number | null
  busy?: boolean
  /** Must clear the caller's own overlay (mobile BottomSheet sits at 10000). */
  zIndex?: number
  onConfirm: () => void
  onCancel: () => void
}) {
  const [dontAskAgain, setDontAskAgain] = useState(false)

  useEffect(() => {
    if (!open) return
    setDontAskAgain(false)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  const confirm = () => {
    if (dontAskAgain) {
      try { localStorage.setItem(SKIP_KEY, '1') } catch { /* private mode — asks again next session */ }
    }
    onConfirm()
  }

  const pnlText = estPnl == null
    ? null
    : `${estPnl >= 0 ? '+' : '-'}$${Math.abs(estPnl).toFixed(2)}`

  return (
    <div className="fixed inset-0 flex items-center justify-center px-4" style={{ zIndex }} role="dialog" aria-modal="true">
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }} onClick={onCancel} />
      <div className="relative w-full max-w-[22.5rem] rounded-xl border border-st-border bg-st-black p-6 shadow-2xl flex flex-col gap-4">
        <CSXText variant="title" color="STWhite">
          {positionCount > 1 ? `Close ${positionCount} positions?` : 'Close position?'}
        </CSXText>
        <div className="flex flex-col gap-1">
          <CSXText variant="body1" color="STSecondary">
            <span className={side === 'long' ? 'text-st-chart-positive' : 'text-st-chart-negative'}>
              {side.toUpperCase()}
            </span>
            {artistName ? ` ${artistName}` : ''} · {contracts} {contracts === 1 ? 'contract' : 'contracts'}
            {pnlText && (
              <>
                {' · '}
                <span className={estPnl! >= 0 ? 'text-st-chart-positive' : 'text-st-chart-negative'}>
                  {pnlText}
                </span>
              </>
            )}
          </CSXText>
          <CSXText variant="body2" color="STMuted">
            The P&L settles into your balance at the current index price.
          </CSXText>
        </div>

        <label className="flex cursor-pointer select-none items-center gap-2">
          <input
            type="checkbox"
            checked={dontAskAgain}
            onChange={e => setDontAskAgain(e.target.checked)}
            className="h-3.5 w-3.5 accent-white"
          />
          <CSXText variant="body2" color="STSecondary">Don&apos;t ask again</CSXText>
        </label>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 rounded-full border border-st-border-strong py-2.5 text-sm text-white transition-all duration-75 hover:bg-white/5 active:scale-[0.98] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={busy}
            className="flex-1 rounded-full bg-white py-2.5 text-sm font-semibold text-black transition-all duration-75 hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
          >
            {busy ? 'Closing…' : 'Close position'}
          </button>
        </div>
      </div>
    </div>
  )
}
