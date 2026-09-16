'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useClosePosition } from '@/lib/hooks/useClosePosition'
import { useUser } from '@/lib/use-user'
import { usePortfolioPanel } from '@/context/PortfolioPanelContext'
import { CSXText, type SXColorToken } from '@/components/sx/core/CSXText'
import { UsernameEditor } from '@/components/shared/UsernameEditor'
import { CSXButton } from '@/components/sx/core/CSXButton'
import { ConfirmCloseDialog, shouldSkipCloseConfirm } from '@/components/shared/ConfirmCloseDialog'
import { CSXPositionSideChip, CSXLiquidatedChip } from '@/components/sx/core/CSXInfoChip'
import { fmtDateTime, fmtNumber } from '@/lib/format'
import { usePortfolio } from '@/lib/hooks/usePortfolio'
import { useTradeHistory } from '@/lib/hooks/useTradeHistory'

const SLIDE_MS = 320

export function MobilePortfolioPanel() {
  const { close: closePosition, closingId } = useClosePosition()
  const [closeError, setCloseError] = useState<string | null>(null)
  const { isOpen, closePortfolio } = usePortfolioPanel()
  const { user, loading: userLoading } = useUser()

  // Never fall back to the email — it's private. Every account has a username
  // (chosen or generated at signup), so this only shows while `user` resolves.
  const username = (user?.user_metadata?.username as string | undefined) ?? user?.username ?? ''
  const avatarUrl = (user?.avatar_url as string | null | undefined) ?? (user?.user_metadata?.avatar_url as string | null | undefined) ?? null
  const totalVolume = Number(user?.total_volume ?? 0)

  // Shared cache: the portfolio page, this panel and the profile page all read
  // the same entry, and any trade revalidates it for all of them.
  const { data, loading, refetch: fetchPortfolio } = usePortfolio(isOpen)
  const { history: closedPositions } = useTradeHistory(isOpen)

  const [confirmClose, setConfirmClose] = useState<{
    spotifyId: string; positionId: string; artistName: string
    side: 'long' | 'short'; contracts: number; pnl: number | null
  } | null>(null)

  const requestClosePosition = (pos: {
    spotify_id?: string | null; artist_name: string; id: string
    position_type: 'long' | 'short'; contracts: number; unrealized_pnl?: number | null
  }) => {
    const spotifyId = pos.spotify_id ?? pos.artist_name
    if (shouldSkipCloseConfirm()) { void handleClosePosition(spotifyId, pos.id); return }
    setConfirmClose({
      spotifyId, positionId: pos.id, artistName: pos.artist_name,
      side: pos.position_type, contracts: pos.contracts, pnl: pos.unrealized_pnl ?? null,
    })
  }

  const handleClosePosition = useCallback(async (spotifyId: string, positionId: string) => {
    setConfirmClose(null)
    const result = await closePosition(spotifyId, positionId)
    // Previously this branch did not exist: a failed close just stopped
    // spinning and said nothing.
    if (result.ok) await fetchPortfolio()
    else setCloseError(result.error)
  }, [fetchPortfolio, closePosition])

  // --- Slide-in / slide-out panel lifecycle (mirrors prior shell) ---
  const [shouldRender, setShouldRender] = useState(false)
  const [isExiting, setIsExiting] = useState(false)
  const wasOpenRef = useRef(false)

  /* eslint-disable react-hooks/set-state-in-effect --
     Prop-driven (isOpen) animation lifecycle: mounts the panel before the
     enter animation and unmounts SLIDE_MS after the exit animation. Same
     justification as app/portfolio/page.tsx and MobileMorePanel. */
  useEffect(() => {
    if (isOpen) {
      setIsExiting(false)
      setShouldRender(true)
      wasOpenRef.current = true
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    } else if (wasOpenRef.current) {
      setIsExiting(true)
      document.body.style.overflow = ''
      const t = setTimeout(() => {
        setShouldRender(false)
        setIsExiting(false)
        wasOpenRef.current = false
      }, SLIDE_MS)
      return () => clearTimeout(t)
    }
  }, [isOpen])
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!shouldRender) return null

  const realizedPnl = closedPositions.reduce((sum, p) => sum + (p.unrealized_pnl || 0), 0)
  const marketValue = data?.total_market_value ?? 0
  const balance = data?.balance ?? Number(user?.balance ?? 0)
  const totalValue = balance + marketValue
  const totalPnl = (data?.total_unrealized_pnl ?? 0) + realizedPnl
  const pnlPositive = totalPnl >= 0

  const summary: { label: string; value: number; color: SXColorToken; signed?: boolean }[] = [
    { label: 'Total Value', value: totalValue, color: 'STWhite' },
    { label: 'Available Balance', value: balance, color: 'STWhite' },
    { label: 'Open Positions Value', value: marketValue, color: 'STWhite' },
    { label: 'P&L', value: totalPnl, color: pnlPositive ? 'STChartPositive' : 'STChartNegative', signed: true },
    { label: 'Total Volume', value: totalVolume, color: 'STWhite' },
  ]

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgb(10,10,10)',
        display: 'flex', flexDirection: 'column',
        willChange: 'transform',
        animation: isExiting
          ? `profilePanelOut ${SLIDE_MS}ms cubic-bezier(0.55,0,1,0.45) forwards`
          : `profilePanelIn ${SLIDE_MS}ms cubic-bezier(0.16,1,0.3,1) forwards`,
      }}
    >
      <style>{`.portfolio-panel-scroll::-webkit-scrollbar{display:none}.portfolio-panel-scroll{scrollbar-width:none}`}</style>

      {/* Header */}
      <div style={{ flexShrink: 0, background: 'rgb(10,10,10)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 'max(env(safe-area-inset-top), 0.75rem)', paddingBottom: '0.5rem', paddingLeft: '0.25rem', paddingRight: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '0rem' }}>
          <button onClick={closePortfolio} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '2.25rem', height: '2.25rem', background: 'none', border: 'none', cursor: 'pointer', color: '#fff', padding: '0rem', flexShrink: 0 }} aria-label="Go back">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </button>
          {!userLoading && user && (
            <>
              <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '50%', overflow: 'hidden', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {avatarUrl
                  ? <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                  : <CSXText variant="body2Medium" color="STForeground">{(username.charAt(0) || '?').toUpperCase()}</CSXText>
                }
              </div>
              <div style={{ minWidth: '0rem', overflow: 'hidden' }}>
                <CSXText variant="body2Medium" color="STWhite">
                  {/* refreshUser() inside the editor re-syncs useUser, which
                      re-renders this panel with the new handle. */}
                  <UsernameEditor username={username} onChanged={() => {}} />
                </CSXText>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="portfolio-panel-scroll" style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0.75rem' }}>
        {userLoading || loading ? (
          <div style={{ padding: '1.5rem 0' }}>
            <CSXText variant="body2" color="STMuted">Loading…</CSXText>
          </div>
        ) : !user ? (
          <div style={{ padding: '1.5rem 0' }}>
            <CSXText variant="body2" color="STMuted">Sign in to view your portfolio.</CSXText>
          </div>
        ) : (
          <>
            {/* Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.0625rem', border: '1px solid #27272a', background: '#27272a', marginBottom: '1.25rem' }}>
              {summary.map(({ label, value, color, signed }) => (
                <div key={label} style={{ background: 'rgb(10,10,10)', padding: '0.75rem 0.875rem' }}>
                  <div style={{ marginBottom: '0.125rem' }}>
                    <CSXText variant="body3" color="STMuted">{label}</CSXText>
                  </div>
                  <CSXText variant="body1" color={color}>
                    {signed ? (value >= 0 ? '+' : '-') : ''}${fmtNumber(Math.abs(signed ? value : value))}
                  </CSXText>
                </div>
              ))}
            </div>

            {/* Open Positions */}
            <section style={{ marginBottom: '1.5rem' }}>
              <div style={{ marginBottom: '0.5rem' }}>
                <CSXText variant="body2Medium" color="STSecondary">Open Positions</CSXText>
              </div>
              {closeError && (
                <div
                  role="alert"
                  style={{
                    marginBottom: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '0.375rem',
                    border: '1px solid var(--st-chart-negative)', background: 'rgba(220,60,50,0.08)',
                  }}
                >
                  <CSXText variant="body2" color="STChartNegative">{closeError}</CSXText>
                </div>
              )}
              {!data || data.positions.length === 0 ? (
                <div style={{ borderTop: '1px solid #27272a', padding: '1rem 0' }}>
                  <CSXText variant="body2" color="STMuted">No open positions.</CSXText>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {data.positions.map((pos) => {
                    const r2 = (n: number) => Math.round(n * 100) / 100
                    const roundedPnl = r2(pos.unrealized_pnl)
                    const pnlPos = roundedPnl >= 0
                    const pnlPct = pos.total_cost > 0 ? (roundedPnl / pos.total_cost) * 100 : 0
                    return (
                      <div key={pos.id} style={{ border: '1px solid #27272a', borderRadius: '0.625rem', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '0rem' }}>
                            <CSXText variant="body2Medium" color="STWhite">{pos.artist_name}</CSXText>
                            <CSXPositionSideChip side={pos.position_type} />
                          </div>
                          <CSXButton
                            variant="outline"
                            size="compact"
                            label={closingId === pos.id ? 'Closing…' : 'Close'}
                            disabled={closingId === pos.id}
                            onClick={() => requestClosePosition(pos)}
                          />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                          <Stat label="Contracts" value={`${pos.contracts}`} />
                          <Stat label="Entry" value={`$${fmtNumber(pos.entry_price)}`} />
                          <Stat label="Current" value={`$${fmtNumber(pos.current_price)}`} color="STSecondary" />
                          <Stat label="Total Entry" value={`$${fmtNumber(pos.entry_price * pos.contracts)}`} />
                          <Stat label="Market Value" value={`$${fmtNumber(pos.market_value)}`} />
                          <Stat
                            label="Unrealized P&L"
                            value={`${roundedPnl > 0 ? '+' : roundedPnl < 0 ? '-' : ''}$${fmtNumber(Math.abs(roundedPnl))} (${pnlPos ? '+' : '-'}${fmtNumber(Math.abs(pnlPct))}%)`}
                            color={pnlPos ? 'STChartPositive' : 'STChartNegative'}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {/* Closed Positions */}
            <section>
              <div style={{ marginBottom: '0.5rem', borderBottom: '1px solid #27272a', paddingBottom: '0.5rem' }}>
                <CSXText variant="body2Medium" color="STSecondary">Closed Positions</CSXText>
              </div>
              {closedPositions.length === 0 ? (
                <div style={{ padding: '1rem 0' }}>
                  <CSXText variant="body2" color="STMuted">No closed positions yet.</CSXText>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                  {closedPositions.map((pos) => {
                    const pnlPos = pos.unrealized_pnl >= 0
                    const pnlPct = pos.total_cost > 0 ? (pos.unrealized_pnl / pos.total_cost) * 100 : 0
                    return (
                      <div key={pos.id} style={{ border: '1px solid #27272a', borderRadius: '0.625rem', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '0rem', flexWrap: 'wrap' }}>
                            <CSXText variant="body2Medium" color="STWhite">{pos.artist_name}</CSXText>
                            <CSXPositionSideChip side={pos.position_type} />
                            {pos.status === 'liquidated' && <CSXLiquidatedChip />}
                          </div>
                          <CSXText variant="body3" color="STMuted">{fmtDateTime(pos.closed_at)}</CSXText>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                          <Stat label="Contracts" value={`${pos.contracts}`} />
                          <Stat label="Entry" value={`$${fmtNumber(pos.entry_price)}`} />
                          <Stat label="Exit" value={`$${fmtNumber(pos.current_price)}`} color="STSecondary" />
                          <Stat
                            label="P&L"
                            value={`${pnlPos ? '+' : '-'}$${fmtNumber(Math.abs(pos.unrealized_pnl))} (${pnlPos ? '+' : '-'}${fmtNumber(Math.abs(pnlPct))}%)`}
                            color={pnlPos ? 'STChartPositive' : 'STChartNegative'}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            <div style={{ height: '5rem' }} />
          </>
        )}
      </div>

      <ConfirmCloseDialog
        open={confirmClose !== null}
        artistName={confirmClose?.artistName}
        positionCount={1}
        side={confirmClose?.side ?? 'long'}
        contracts={confirmClose?.contracts ?? 0}
        estPnl={confirmClose?.pnl}
        busy={closingId !== null}
        zIndex={10001}
        onConfirm={() => { if (confirmClose) void handleClosePosition(confirmClose.spotifyId, confirmClose.positionId) }}
        onCancel={() => setConfirmClose(null)}
      />
    </div>
  )
}

function Stat({ label, value, color = 'STWhite' }: { label: string; value: string; color?: SXColorToken }) {
  return (
    <div style={{ minWidth: '0rem' }}>
      <div style={{ marginBottom: '0.0625rem' }}>
        <CSXText variant="body3" color="STMuted">{label}</CSXText>
      </div>
      <CSXText variant="body2" color={color}>{value}</CSXText>
    </div>
  )
}
