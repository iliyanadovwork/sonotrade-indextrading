'use client'

import { useState, useEffect } from 'react'
import NumberFlow, { NumberFlowGroup } from '@number-flow/react'
import Link from 'next/link'
import { TrendingUp } from 'lucide-react'
import { CSXButton } from '@/components/sx/core/CSXButton'
import { CSXLiquidatedChip, CSXPositionSideChip } from '@/components/sx/core/CSXInfoChip'
import { CSXText, type SXColorToken } from '@/components/sx/core/CSXText'
import { SXSectionHeading } from '@/components/sx/SXSectionHeading'
import { mainColumnWidthStyle } from '@/lib/mainColumnLayout'
import { supabaseImage } from '@/lib/supabaseImage'
import { UsernameEditor } from '@/components/shared/UsernameEditor'
import { fmtDateOnly, fmtNumber } from '@/lib/format'

type Tab = 'positions' | 'trades'

export interface ProfileData {
  username: string
  avatar_url: string | null
  created_at: string
  total_volume?: number
  total_unrealized_pnl?: number
  realized_pnl?: number
  positions: Position[]
  trades: ClosedPosition[]
  userId: string
}

export interface Position {
  id: string
  artist_name: string
  ticker?: string | null
  /* /api/portfolio and /api/trades/history return the artist key as
     `spotify_id`; only the public-profile route maps it to `ticker`. Accept
     both — linking by artist_name lands on the 404 page. */
  spotify_id?: string | null
  position_type: 'long' | 'short'
  contracts: number
  entry_price: number
  current_price: number
  total_cost: number
  market_value: number
  unrealized_pnl: number
  opened_at: string
}

export interface ClosedPosition {
  id: string
  artist_name: string
  ticker?: string | null
  spotify_id?: string | null
  position_type: 'long' | 'short'
  contracts: number
  entry_price: number
  current_price: number
  total_cost: number
  unrealized_pnl: number
  opened_at: string
  closed_at: string
  status: 'closed' | 'liquidated'
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <TrendingUp className="mb-3 h-10 w-10 opacity-30 text-st-muted" aria-hidden />
      <CSXText variant="body2" color="STMuted">
        {label}
      </CSXText>
    </div>
  )
}

interface ProfileViewProps {
  data: ProfileData
  isOwn?: boolean
  avatarUrl?: string | null
  avatarUploading?: boolean
  onAvatarClick?: () => void
  /** Own profile only: renders a "Log out" action in the header — account
      management belongs here, not in the Cash panel. */
  onLogout?: () => void
}

export function ProfileView({
  data,
  isOwn = false,
  avatarUrl,
  avatarUploading = false,
  onAvatarClick,
  onLogout,
}: ProfileViewProps) {
  const [tab, setTab] = useState<Tab>('positions')
  // Local override after an in-place rename — parent `data` stays stale until
  // its next fetch, so the header would otherwise snap back to the old handle.
  const [usernameOverride, setUsernameOverride] = useState<string | null>(null)
  const displayUsername = usernameOverride ?? data.username
  const [hoverTab, setHoverTab] = useState<Tab | null>(null)

  const displayAvatar = avatarUrl ?? data.avatar_url
  const combinedPnl = (data.total_unrealized_pnl ?? 0) + (data.realized_pnl ?? 0)
  const pnlPositive = combinedPnl >= 0

  const [displayVolume, setDisplayVolume] = useState(0)
  const [displayPnl, setDisplayPnl] = useState(0)
  const [displayPositions, setDisplayPositions] = useState(0)
  const [displayTrades, setDisplayTrades] = useState(0)
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setDisplayVolume(data.total_volume || 0)
      setDisplayPnl(combinedPnl)
      setDisplayPositions(data.positions.length)
      setDisplayTrades(data.trades.length)
    })
    return () => cancelAnimationFrame(raf)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const TABS: { key: Tab; label: string }[] = [
    { key: 'positions', label: 'Positions' },
    { key: 'trades', label: 'Trades' },
  ]

  return (
    <main className="bg-[rgb(10,10,10)] text-white flex justify-center" style={{ minHeight: '100vh' }}>
      <div className="flex items-start">
        {/* Center column */}
        <div
          className="shrink-0 border-x border-st-border"
          style={{ ...mainColumnWidthStyle, minHeight: '100vh' }}
        >

          {/* Profile header */}
          <div className="p-6 border-b border-st-border">
            <div className="flex items-start gap-4 mb-4">
              {isOwn ? (
                <button
                  type="button"
                  onClick={onAvatarClick}
                  disabled={avatarUploading}
                  className="relative flex h-16 w-16 flex-shrink-0 cursor-pointer select-none items-center justify-center overflow-hidden rounded-full bg-white transition-opacity hover:opacity-80 disabled:opacity-50"
                >
                  {displayAvatar ? (
                    <img src={supabaseImage(displayAvatar, 128)} alt="avatar" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <CSXText variant="title" color="STForeground">
                      {data.username.charAt(0).toUpperCase()}
                    </CSXText>
                  )}
                  {avatarUploading && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </button>
              ) : (
                <div className="relative flex h-16 w-16 flex-shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-white">
                  {displayAvatar ? (
                    <img src={supabaseImage(displayAvatar, 128)} alt={data.username} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <CSXText variant="title" color="STForeground">
                      {data.username.charAt(0).toUpperCase()}
                    </CSXText>
                  )}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <SXSectionHeading
                  as="h1"
                  title={
                    isOwn
                      ? <UsernameEditor username={displayUsername} onChanged={setUsernameOverride} />
                      : displayUsername
                  }
                  className="!pt-0 !pb-0"
                  subtitle={
                    isOwn ? (
                      <button
                        type="button"
                        className="m-0 cursor-pointer border-0 bg-transparent p-0 text-left transition-opacity hover:opacity-80"
                        onClick={onAvatarClick}
                      >
                        <CSXText variant="body2" color="STSecondary">
                          {displayAvatar ? 'Change photo' : 'Upload photo'}
                        </CSXText>
                      </button>
                    ) : (
                      `Joined ${fmtDateOnly(data.created_at)}`
                    )
                  }
                  subtitleUnstyled={isOwn}
                />
              </div>
              {isOwn && onLogout && (
                <div className="shrink-0">
                  <CSXButton variant="outline" size="compact" label="Log out" onClick={onLogout} />
                </div>
              )}
            </div>

            {/* Stats grid */}
            <NumberFlowGroup>
            <div className="grid grid-cols-4 border border-st-border">
              {([
                {
                  label: 'VOLUME',
                  node: <NumberFlow value={displayVolume} format={{ style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol', maximumFractionDigits: 2 }} className="text-sm font-semibold leading-normal tracking-[-0.025em]" style={{ color: 'var(--st-white)' }} />,
                },
                {
                  label: 'P&L',
                  node: <NumberFlow value={displayPnl} format={{ style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol', signDisplay: 'always', maximumFractionDigits: 2 }} className="text-sm font-semibold leading-normal tracking-[-0.025em]" style={{ color: `var(--${pnlPositive ? 'st-chart-positive' : 'st-chart-negative'})` }} />,
                },
                {
                  label: 'POSITIONS',
                  node: <NumberFlow value={displayPositions} format={{ maximumFractionDigits: 0 }} className="text-sm font-semibold leading-normal tracking-[-0.025em]" style={{ color: 'var(--st-white)' }} />,
                },
                {
                  label: 'TRADES',
                  node: <NumberFlow value={displayTrades} format={{ maximumFractionDigits: 0 }} className="text-sm font-semibold leading-normal tracking-[-0.025em]" style={{ color: 'var(--st-white)' }} />,
                },
              ]).map((stat, i) => (
                <div key={stat.label} className={`flex flex-col gap-1 px-3 py-2.5 ${i < 3 ? 'border-r border-st-border' : ''}`}>
                  <CSXText variant="body3" color="STMuted">{stat.label}</CSXText>
                  {stat.node}
                </div>
              ))}
            </div>
            </NumberFlowGroup>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-st-border">
            {TABS.map(({ key, label }) => {
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

          {/* Tab content */}
          <div>
            {/* Positions */}
            {tab === 'positions' && (
              data.positions.length === 0 ? (
                <EmptyState label="No open positions" />
              ) : (
                <div className="divide-y divide-st-border">
                  {data.positions.map((pos) => {
                    const pnlPos = pos.unrealized_pnl >= 0
                    const pnlPct = pos.total_cost > 0 ? (pos.unrealized_pnl / pos.total_cost) * 100 : 0
                    return (
                      <div key={pos.id} className="flex items-center justify-between px-6 py-4">
                        <div>
                          <Link
                            href={`/artist/${encodeURIComponent(pos.ticker ?? pos.spotify_id ?? pos.artist_name)}`}
                            className="no-underline transition-opacity hover:opacity-80"
                          >
                            <CSXText variant="body2Medium" color="STWhite">
                              {pos.artist_name}
                            </CSXText>
                          </Link>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <CSXPositionSideChip side={pos.position_type} />
                            <CSXText variant="body3" color="STMuted">
                              {`${pos.contracts} contracts`}
                            </CSXText>
                            <CSXText variant="body3" color="STMuted">
                              {`Entry $${fmtNumber(pos.entry_price)}`}
                            </CSXText>
                          </div>
                        </div>
                        <div className="text-right">
                          <CSXText
                            variant="body2Semibold"
                            color={pnlPos ? 'STChartPositive' : 'STChartNegative'}
                          >
                            {pnlPos ? '+' : '-'}${fmtNumber(Math.abs(pos.unrealized_pnl))}
                          </CSXText>
                          <div className="mt-0.5">
                            <CSXText variant="body3" color="STMuted">
                              {`${pnlPos ? '+' : '-'}${fmtNumber(Math.abs(pnlPct))}%`}
                            </CSXText>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            )}

            {/* Trades */}
            {tab === 'trades' && (
              data.trades.length === 0 ? (
                <EmptyState label="No trade history" />
              ) : (
                <div className="divide-y divide-st-border">
                  {data.trades.map((pos) => {
                    const pnlPos = (pos.unrealized_pnl ?? 0) >= 0
                    const pnlPct = pos.total_cost > 0 ? ((pos.unrealized_pnl ?? 0) / pos.total_cost) * 100 : 0
                    return (
                      <div key={pos.id} className="flex items-center justify-between px-6 py-4">
                        <div>
                          <Link
                            href={`/artist/${encodeURIComponent(pos.ticker ?? pos.spotify_id ?? pos.artist_name)}`}
                            className="no-underline transition-opacity hover:opacity-80"
                          >
                            <CSXText variant="body2Medium" color="STWhite">
                              {pos.artist_name}
                            </CSXText>
                          </Link>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <CSXPositionSideChip side={pos.position_type} />
                            {pos.status === 'liquidated' && <CSXLiquidatedChip />}
                            <CSXText variant="body3" color="STMuted">
                              {`${pos.contracts} contracts`}
                            </CSXText>
                            <CSXText variant="body3" color="STMuted">
                              {fmtDateOnly(pos.closed_at)}
                            </CSXText>
                          </div>
                        </div>
                        <div className="text-right">
                          <CSXText
                            variant="body2Semibold"
                            color={pnlPos ? 'STChartPositive' : 'STChartNegative'}
                          >
                            {pnlPos ? '+' : '-'}${fmtNumber(Math.abs(pos.unrealized_pnl ?? 0))}
                          </CSXText>
                          <div className="mt-0.5">
                            <CSXText variant="body3" color="STMuted">
                              {`${pnlPos ? '+' : '-'}${fmtNumber(Math.abs(pnlPct))}%`}
                            </CSXText>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
