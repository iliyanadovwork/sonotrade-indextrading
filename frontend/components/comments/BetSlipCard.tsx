'use client'

import Link from 'next/link'
import { CSXPositionSideChip } from '@/components/sx/core/CSXInfoChip'
import { CSXText } from '@/components/sx/core/CSXText'
import { useEffect, useState } from 'react'
import { fmtIndexPrice } from '@/lib/format'

export interface TradeEmbed {
  a: string           // spotify_id
  n?: string          // artist name (stored statically at share time)
  s: 'long' | 'short'
  c: number           // contracts
  e: number           // entry price
  x: number           // exit/current price (static for closed, will be updated for open)
  p: number           // pnl (static for closed, will be updated for open)
  pc: number          // pnl % (static for closed, will be updated for open)
  o?: boolean         // true = open position
}

export const TRADE_EMBED_REGEX = /\[\[TRADE:(\{.*?\})\]\]/s

export function parseTrade(content: string): { trade: TradeEmbed | null; text: string } {
  const match = content.match(TRADE_EMBED_REGEX)
  if (!match) return { trade: null, text: content }
  try {
    return { trade: JSON.parse(match[1]) as TradeEmbed, text: content.replace(TRADE_EMBED_REGEX, '').trim() }
  } catch {
    return { trade: null, text: content }
  }
}

/**
 * `bordered`: set when the card sits on a surface that is ALSO #131313 (feed
 * comment bubbles, comment-section replies, reply dialogs) — without it the
 * card dissolves into its background. Left off on page-level surfaces where
 * the fill alone already reads as a card.
 *
 * `linkToArtist`: makes the whole card a link to the artist page — the natural
 * "view / copy this trade" action. Opt-in because TradePicker renders these
 * cards as selectable buttons where navigation would break the picker.
 */
export function BetSlipCard({ trade, bordered = false, linkToArtist = false }: { trade: TradeEmbed; bordered?: boolean; linkToArtist?: boolean }) {
  // NB: in the className template literals below, the space before ${ matters —
  // Tailwind scans raw source text, and `max-w-[16.25rem]${…` glues into one
  // invalid candidate that silently drops the max-width rule from the
  // production CSS build (dev JIT masked it).
  const [artistName, setArtistName] = useState<string>(trade.n || trade.a)
  const [livePrice, setLivePrice] = useState<number | null>(null)
  const [loading, setLoading] = useState(trade.o === true)

  useEffect(() => {
    // Resolve the artist NAME from the spotify_id for every trade; for OPEN
    // positions also pull the live index value to recompute PnL.
    const fetchInfo = async () => {
      try {
        const res = await fetch(`/api/artist/${encodeURIComponent(trade.a)}?slim=true`, { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (data.artist?.name) setArtistName(data.artist.name)
        if (trade.o && data.artist?.index_price != null) setLivePrice(data.artist.index_price)
      } catch (error) {
        console.error('Error fetching artist info:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchInfo()
  }, [trade.a, trade.o])

  const isLong = trade.s === 'long'
  
  // For open positions, recalculate PnL with live price
  const currentPrice = trade.o && livePrice != null ? livePrice : trade.x
  const totalCost = trade.e * trade.c
  const pnl = trade.o && livePrice != null
    ? (isLong ? (livePrice - trade.e) : (trade.e - livePrice)) * trade.c
    : trade.p
  const pnlPct = totalCost > 0 ? (pnl / totalCost) * 100 : 0
  
  const isWin = pnl >= 0
  const pnlAbs = Math.abs(pnl)
  const pnlPctAbs = Math.abs(pnlPct)

  if (loading) {
    return (
    <div className={`rounded-lg bg-[#131313] p-3 max-w-[16.25rem] ${bordered ? 'border border-white/10' : ''}`}>
        <div className="h-16 animate-pulse bg-zinc-800 rounded" />
      </div>
    )
  }

  const card = (
    <div className={`rounded-lg bg-[#131313] p-3 max-w-[16.25rem] ${bordered ? 'border border-white/10' : ''} ${linkToArtist ? 'transition-opacity hover:opacity-80' : ''}`}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1 truncate">
          <CSXText variant="body2Semibold" color="STWhite">
            {artistName || trade.a}
          </CSXText>
        </div>
        <CSXPositionSideChip side={trade.s} className="ml-2 px-2" />
      </div>
      <div className="mb-1 flex flex-wrap items-center gap-1.5">
        <CSXText variant="body3" color="STMuted">
          ${trade.e.toFixed(2)}
        </CSXText>
        <CSXText variant="body3" color="STMuted">
          →
        </CSXText>
        <CSXText variant="body3" color="STSecondary">
          ${fmtIndexPrice(currentPrice)}
        </CSXText>
        <span className="ml-auto">
          <CSXText variant="body3" color="STMuted">
            {trade.c} {trade.c === 1 ? 'contract' : 'contracts'}
          </CSXText>
        </span>
      </div>
      <div>
        <CSXText variant="body2Semibold" color={isWin ? 'STChartPositive' : 'STChartNegative'}>
          {isWin ? '+' : '-'}${pnlAbs.toFixed(2)}
        </CSXText>
        <CSXText variant="body3" color="STMuted">
          {' '}
          ({isWin ? '+' : '-'}
          {pnlPctAbs.toFixed(2)}%)
        </CSXText>
      </div>
      <div className="mt-1">
        <CSXText variant="spaced" color="STMuted">
          {trade.o ? 'Open Position' : 'Closed Trade'}
        </CSXText>
      </div>
    </div>
  )

  if (!linkToArtist) return card

  return (
    <Link
      href={`/artist/${encodeURIComponent(trade.a)}`}
      className="block w-fit no-underline active:scale-[0.99]"
      aria-label={`View ${artistName || trade.a} — ${trade.s} position`}
    >
      {card}
    </Link>
  )
}
