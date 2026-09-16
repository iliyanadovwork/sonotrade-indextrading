'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { CSXText, type SXColorToken } from '@/components/sx/core/CSXText'
import { SXPageLoading } from '@/components/sx/SXPageLoading'
import {
  SXTable,
  TableBody,
  TableCell,
  TableCellText,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/sx/SXTable'
import { mainColumnWidthStyle } from '@/lib/mainColumnLayout'
import { fmtAbs } from '@/lib/format'

/** Fixed widths so header and body columns stay aligned (`table-fixed` + colgroup). */
const LEADERBOARD_COLGROUP = (
  <colgroup>
    <col style={{ width: '7%' }} />
    <col style={{ width: '41%' }} />
    <col style={{ width: '17%' }} />
    <col style={{ width: '17%' }} />
    <col style={{ width: '18%' }} />
  </colgroup>
)

type SortTab = 'pnl' | 'volume'

interface LeaderboardEntry {
  id: string
  username: string
  avatar_url: string | null
  total_pnl: number
  total_volume: number
  total_trades: number
  open_positions: number
  winning_trades: number
}

export default function LeaderboardPage() {
  const [tab, setTab] = useState<SortTab>('pnl')
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  const [hoverTab, setHoverTab] = useState<SortTab | null>(null)
  const offsetRef = useRef(0)
  const isFetchingRef = useRef(false)
  const observer = useRef<IntersectionObserver | null>(null)

  const fetchEntries = useCallback(async (reset = false, sort: SortTab = tab) => {
    if (isFetchingRef.current) return
    isFetchingRef.current = true
    try {
      if (reset) { setLoading(true); offsetRef.current = 0 }
      else setIsFetching(true)

      const res = await fetch(`/api/leaderboard?limit=50&offset=${offsetRef.current}&sort=${sort}`, { cache: 'no-store' })
      const data = await res.json()

      if (data.success) {
        const newEntries = data.leaderboard || []
        if (reset) {
          setEntries(newEntries)
          offsetRef.current = newEntries.length
        } else {
          setEntries(prev => [...prev, ...newEntries])
          offsetRef.current += newEntries.length
        }
        setHasMore(data.hasMore || false)
      }
    } catch (e) {
      console.error('Leaderboard fetch error:', e)
    } finally {
      isFetchingRef.current = false
      setLoading(false)
      setIsFetching(false)
      setHasLoadedOnce(true)
    }
  }, [tab])

  // Async fetch — setState lands after the awaited request, not synchronously.
  // Same justification as the feed/positions fetch effects elsewhere in the app.
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { fetchEntries(true, tab) }, [tab])

  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    if (observer.current) observer.current.disconnect()
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !isFetchingRef.current) fetchEntries(false, tab)
    })
    if (node) observer.current.observe(node)
  }, [hasMore, fetchEntries, tab])

  return (
    <main className="bg-[rgb(10,10,10)] text-white flex justify-center" style={{ minHeight: '100vh' }}>
      <div className="flex items-start">
        {/* Center column */}
        {!hasLoadedOnce && loading ? (
          <div
            className="shrink-0 border-x border-[#262626]"
            style={{ ...mainColumnWidthStyle, minHeight: '100vh' }}
          >
            <SXPageLoading aria-label="Loading leaderboard" />
          </div>
        ) : (
        <div
          className="shrink-0 border-x border-[#262626]"
          style={{ ...mainColumnWidthStyle, minHeight: '100vh' }}
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-[#262626]">
            <CSXText variant="subtitle" color="STWhite">
              Leaderboard
            </CSXText>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-[#262626]">
            {([['pnl', 'P&L'], ['volume', 'Volume']] as [SortTab, string][]).map(([key, label]) => {
              const active = tab === key
              const hovered = hoverTab === key
              const tabColor: SXColorToken = active || hovered ? 'STWhite' : 'STMuted'
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  onMouseEnter={() => setHoverTab(key)}
                  onMouseLeave={() => setHoverTab(null)}
                  className={`flex flex-1 items-center justify-center border-b-2 py-3.5 transition-colors ${active ? '-mb-px border-white' : 'border-transparent'}`}
                >
                  <CSXText variant="body2Medium" color={tabColor}>
                    {label}
                  </CSXText>
                </button>
              )
            })}
          </div>

          {loading ? (
            <SXPageLoading
              aria-label="Loading leaderboard"
              minHeightClassName="min-h-[calc(100vh-15rem)]"
            />
          ) : (
            <div className="border-t border-b border-zinc-800 bg-[rgb(10,10,10)]">
              <SXTable variant="bloomberg" className="w-full table-fixed">
                {LEADERBOARD_COLGROUP}
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-zinc-900">
                    <TableHead className="h-8 pl-0 pr-3 text-center tabular-nums whitespace-nowrap">
                      #
                    </TableHead>
                    <TableHead className="h-8 px-3 text-left whitespace-nowrap tabular-nums select-none">
                      TRADER
                    </TableHead>
                    <TableHead className="h-8 px-3 text-right whitespace-nowrap tabular-nums select-none">
                      {tab === 'pnl' ? 'P&L' : 'VOLUME'}
                    </TableHead>
                    <TableHead className="h-8 px-3 text-right whitespace-nowrap tabular-nums select-none">
                      TRADES
                    </TableHead>
                    <TableHead className="h-8 px-3 text-right whitespace-nowrap tabular-nums select-none">
                      WIN %
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.length === 0 && (
                    <TableRow className="border-zinc-800">
                      <TableCell
                        colSpan={5}
                        className="py-16 text-center"
                        textVariant="body2"
                        textColor="STMuted"
                      >
                        Be the first to trade and appear on the leaderboard!
                      </TableCell>
                    </TableRow>
                  )}
                  {entries.map((entry, i) => (
                    <LeaderboardRow key={entry.id} entry={entry} rank={i + 1} tab={tab} />
                  ))}
                </TableBody>
              </SXTable>
            </div>
          )}

          {!loading && entries.length > 0 && (
            <div ref={sentinelRef} className="flex justify-center py-4">
              {isFetching && (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-white" />
              )}
            </div>
          )}
        </div>
        )}
      </div>
    </main>
  )
}

function LeaderboardRow({ entry, rank, tab }: { entry: LeaderboardEntry; rank: number; tab: SortTab }) {
  const pnlPos = entry.total_pnl >= 0
  // Trades = every trade taken, open AND closed — matching the profile page's
  // trade count. Win rate stays over closed trades only: an open position
  // hasn't won or lost yet, so counting it in the denominator would drag every
  // active trader's win rate down.
  const allTrades = entry.total_trades + entry.open_positions
  const winPct = entry.total_trades > 0
    ? Math.round((entry.winning_trades / entry.total_trades) * 100)
    : 0

  return (
    <TableRow className="border-zinc-800 hover:bg-zinc-900">
      <TableCell
        className="pl-0 pr-3 text-center tabular-nums whitespace-nowrap"
        textColor="STMuted"
      >
        {rank}
      </TableCell>
      <TableCell plain className="min-w-0 px-3">
        <Link
          href={`/profile/${encodeURIComponent(entry.username)}`}
          className="flex min-w-0 items-center gap-3 no-underline hover:underline"
        >
          {entry.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={entry.avatar_url}
              alt={entry.username}
              className="h-6 w-6 flex-shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="h-6 w-6 flex-shrink-0 rounded-full bg-zinc-700" />
          )}
          <div
            className="min-w-0 flex-1 truncate [&>span]:block [&>span]:truncate"
            title={entry.username}
          >
            <TableCellText variant="body1" color="STWhite">
              {entry.username}
            </TableCellText>
          </div>
        </Link>
      </TableCell>
      {tab === 'pnl' ? (
        <TableCell
          className="px-3 text-right tabular-nums whitespace-nowrap"
          textColor={
            pnlPos ? 'STChartPositive' : 'STChartNegative'
          }
        >
          {pnlPos ? '+' : '-'}${fmtAbs(entry.total_pnl)}
        </TableCell>
      ) : (
        <TableCell className="px-3 text-right tabular-nums whitespace-nowrap">
          ${fmtAbs(entry.total_volume)}
        </TableCell>
      )}
      <TableCell className="px-3 text-right tabular-nums whitespace-nowrap">
        {allTrades}
      </TableCell>
      <TableCell className="px-3 text-right tabular-nums whitespace-nowrap">
        {entry.total_trades > 0 ? `${winPct}%` : '—'}
      </TableCell>
    </TableRow>
  )
}
