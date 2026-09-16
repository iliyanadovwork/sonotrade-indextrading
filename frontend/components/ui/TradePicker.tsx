'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { OverlayCard } from '@/components/ui/OverlayCard'
import { CSXPositionSideChip } from '@/components/sx/core/CSXInfoChip'
import { CSXText } from '@/components/sx/core/CSXText'
import type { TradeEmbed } from '@/components/comments/BetSlipCard'
import { fetchAuthedResource } from '@/lib/hooks/useAuthedResource'
import { fmtIndexPrice } from '@/lib/format'

/**
 * Shared trade / position picker for the comment and feed forms.
 *
 * Previously duplicated in five components (CommentForm, Comment's ReplyForm,
 * FeedForm, FeedCommentItem's FeedReplyForm, FeedCommentDialog), each carrying
 * its own fetch, loading state, and row markup — so the row styling and even
 * the embed payload (`n` was missing in one copy) had drifted. Owning the
 * fetch here means call sites only say "open" and "what to do with the chosen
 * embed", the same contract as GifPicker.
 *
 * `mode` selects the surface: `'trades'` lists closed trades from
 * /api/trades/history (fetched once and reused while non-empty — closed trades
 * don't change under you); `'positions'` lists open positions from
 * /api/trades/my-positions (refetched on every open, because they do).
 */

type TradePickerMode = 'trades' | 'positions'

interface TradeRow {
  id: string
  spotify_id: string
  artist_name: string
  position_type: 'long' | 'short'
  contracts: number
  entry_price: number
  current_price: number | null
  total_cost: number | null
  unrealized_pnl: number | null
}

interface TradePickerProps {
  open: boolean
  mode: TradePickerMode
  onClose: () => void
  /**
   * Receives the ready-to-embed trade. Closing the picker is the caller's job
   * (same contract as GifPicker's onSelect).
   */
  onSelect: (trade: TradeEmbed) => void
  /**
   * Spotify id (or artist name) whose trades sort to the top — the artist
   * page passes its own id so "share a trade" leads with that artist.
   */
  prioritizeArtist?: string
}

const COPY: Record<TradePickerMode, {
  title: string
  loading: string
  empty: string
  failed: string
}> = {
  trades: {
    title: 'Share a Closed Trade',
    loading: 'Loading trades...',
    empty: 'No closed trades found.',
    failed: "Couldn't load trades. Close and try again.",
  },
  positions: {
    title: 'Share an Open Position',
    loading: 'Loading positions...',
    empty: 'No open positions found.',
    failed: "Couldn't load positions. Close and try again.",
  },
}

export function TradePicker({ open, mode, onClose, onSelect, prioritizeArtist }: TradePickerProps) {
  const [rows, setRows] = useState<TradeRow[]>([])
  // 'idle' renders the loading message too, so the first open never flashes
  // the empty state before the fetch effect has run.
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  // Mirror of `rows` so the open effect can check the cache without listing
  // the rows themselves as a dependency (which would re-fire it on load).
  const rowsRef = useRef<TradeRow[]>([])
  const reqId = useRef(0)

  const load = useCallback(async () => {
    // Out-of-order responses: a slow early fetch must not overwrite a later one.
    const id = ++reqId.current
    setStatus('loading')
    try {
      // Reads through the same shared cache the portfolio surfaces use, so
      // opening the picker after viewing the portfolio is free. The
      // out-of-order guard above still applies: mode can flip mid-flight.
      const data = await fetchAuthedResource<{ history?: TradeRow[]; trades?: TradeRow[] }>(
        mode === 'trades' ? '/api/trades/history' : '/api/trades/my-positions',
      )
      const fetched: TradeRow[] = (mode === 'trades' ? data?.history : data?.trades) || []
      const sorted = prioritizeArtist
        ? [
            ...fetched.filter(r => r.spotify_id === prioritizeArtist || r.artist_name === prioritizeArtist),
            ...fetched.filter(r => r.spotify_id !== prioritizeArtist && r.artist_name !== prioritizeArtist),
          ]
        : fetched
      if (id !== reqId.current) return
      rowsRef.current = sorted
      setRows(sorted)
      setStatus('ready')
    } catch {
      if (id !== reqId.current) return
      setStatus('error')
    }
  }, [mode, prioritizeArtist])

  useEffect(() => {
    if (!open) return
    // Closed trades are reused across opens once a non-empty list has loaded
    // (an empty or failed load retries next open); open positions always refetch.
    if (mode === 'trades' && rowsRef.current.length > 0) return
    void load()
  }, [open, mode, load])

  const select = (row: TradeRow) => {
    const pnl = row.unrealized_pnl ?? 0
    const totalCost = row.total_cost ?? row.entry_price * row.contracts
    const pnlPct = totalCost > 0 ? (pnl / totalCost) * 100 : 0
    onSelect({
      a: row.spotify_id,
      n: row.artist_name,
      s: row.position_type,
      c: row.contracts,
      e: row.entry_price,
      x: mode === 'positions' ? row.current_price ?? row.entry_price : row.current_price ?? 0,
      p: pnl,
      pc: pnlPct,
      ...(mode === 'positions' ? { o: true } : {}),
    })
  }

  const copy = COPY[mode]

  return (
    <OverlayCard open={open} onClose={onClose} title={copy.title}>
      {status === 'error' ? (
        <div className="py-6 text-center">
          <CSXText variant="body2" color="STMuted">{copy.failed}</CSXText>
        </div>
      ) : status !== 'ready' ? (
        <div className="py-6 text-center">
          <CSXText variant="body2" color="STMuted">{copy.loading}</CSXText>
        </div>
      ) : rows.length === 0 ? (
        <div className="py-6 text-center">
          <CSXText variant="body2" color="STMuted">{copy.empty}</CSXText>
        </div>
      ) : (
        <div className="flex max-h-[22.5rem] flex-col gap-2 overflow-y-auto">
          {rows.map(row => {
            const pnl = row.unrealized_pnl ?? 0
            const totalCost = row.total_cost ?? row.entry_price * row.contracts
            const isWin = pnl >= 0
            const pnlPct = totalCost > 0 ? (pnl / totalCost) * 100 : 0
            const exit = mode === 'positions'
              ? row.current_price ?? row.entry_price
              : row.current_price ?? 0
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => select(row)}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-[#1a1a1a] px-3 py-3 text-left transition-all hover:border-[#333] hover:bg-[#0d0d0d]"
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-white">{row.artist_name}</span>
                    <CSXPositionSideChip side={row.position_type} className="flex-shrink-0" />
                  </div>
                  <div className="text-xs text-zinc-500">
                    ${fmtIndexPrice(row.entry_price ?? 0)} → ${fmtIndexPrice(exit)} · {row.contracts} contracts
                  </div>
                </div>
                <div className={`flex-shrink-0 text-sm font-semibold ${isWin ? 'text-st-chart-positive' : 'text-st-chart-negative'}`}>
                  {isWin ? '+' : '-'}${Math.abs(pnl).toFixed(2)}
                  <span className="ml-1 text-xs font-normal opacity-70">({isWin ? '+' : '-'}{Math.abs(pnlPct).toFixed(1)}%)</span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </OverlayCard>
  )
}

export default TradePicker
