'use client'

import { useState } from 'react'
import { useClosePosition } from '@/lib/hooks/useClosePosition'
import { CSXPositionSideChip } from '@/components/sx/core/CSXInfoChip'
import { CSXText } from '@/components/sx/core/CSXText'
import { BottomSheet } from '@/components/mobile/BottomSheet'
import { ConfirmCloseDialog, shouldSkipCloseConfirm } from '@/components/shared/ConfirmCloseDialog'
import { MobileDetailRow } from '@/components/mobile/MobileDetailRow'
import { useLiveArtistPrice } from '@/lib/hooks/useLiveArtistPrice'
import { fmtNumber } from '@/lib/format'
import { useMyPositions } from '@/lib/hooks/useMyPositions'

type Trade = {
  id: string
  position: 'long' | 'short'
  contracts: number
  entry_price: number
  total_cost: number
  artist_name?: string
}

interface MobileOpenPositionProps {
  spotifyId: string
  livePrice: number
}

export function MobileOpenPosition({ spotifyId, livePrice }: MobileOpenPositionProps) {
  const { close: closePosition, isClosing, error: closeError, clearError } = useClosePosition()
  // Shared with the trading panel on the same page, which asks for the same
  // artist; a trade revalidates both.
  const { positions, loading, refetch: fetchPositions } = useMyPositions(spotifyId)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  // Live index price via Realtime (seeded from the SSR value passed by the page).
  const liveIndexPrice = useLiveArtistPrice(spotifyId, livePrice)
  const currentPrice = liveIndexPrice ?? livePrice




  function requestClose() {
    // Styled confirmation (with a "don't ask again" opt-out) — a single tap
    // used to close the trade outright.
    if (shouldSkipCloseConfirm()) { void handleClose(); return }
    setConfirmOpen(true)
  }

  async function handleClose() {
    setConfirmOpen(false)
    const result = await closePosition(spotifyId)
    if (!result.ok) return   // the hook already holds the message
    setDrawerOpen(false)
    await fetchPositions()
  }

  if (loading) return null

  if (positions.length === 0) {
    return (
      <div className="w-full pt-6">
        <div>
          <CSXText variant="body2Semibold" color="STWhite">Positions</CSXText>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '4.5rem', borderBottom: '1px solid #27272a' }}>
          <CSXText variant="body2" color="STSecondary">No open positions</CSXText>
        </div>
      </div>
    )
  }

  const totalContracts = positions.reduce((s, p) => s + p.contracts, 0)
  const totalCost = positions.reduce((s, p) => s + p.total_cost, 0)
  const avgEntryPrice = totalContracts > 0 ? totalCost / totalContracts : 0
  const positionType = positions[0]?.position ?? 'long'

  const marketValue = totalContracts * currentPrice
  const unrealizedPnL = positionType === 'long'
    ? (currentPrice - avgEntryPrice) * totalContracts
    : (avgEntryPrice - currentPrice) * totalContracts
  const roundedPnl = Math.round(unrealizedPnL * 100) / 100
  const pnlPositive = roundedPnl >= 0

  return (
    <div className="w-full pt-6">
      <div>
        <CSXText variant="body2Semibold" color="STWhite">Positions</CSXText>
      </div>

      {/* Table header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '5rem 1fr 1fr 1fr',
          padding: '0.375rem 0',
          borderTop: '1px solid #27272a',
          borderBottom: '1px solid #27272a',
        }}
      >
        <div>
          <CSXText variant="spaced" color="STSecondary">Side</CSXText>
        </div>
        <div style={{ textAlign: 'right' }}>
          <CSXText variant="spaced" color="STSecondary">Paid</CSXText>
        </div>
        <div style={{ textAlign: 'right' }}>
          <CSXText variant="spaced" color="STSecondary">Worth</CSXText>
        </div>
        <div style={{ textAlign: 'right' }}>
          <CSXText variant="spaced" color="STSecondary">P&L</CSXText>
        </div>
      </div>

      <button
        type="button"
        onClick={() => { clearError(); setDrawerOpen(true) }}
        className="w-full text-left active:bg-white/[0.04] transition-colors"
        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'block', padding: '0rem' }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '5rem 1fr 1fr 1fr',
            alignItems: 'center',
            padding: '0.625rem 0',
            borderBottom: '1px solid #27272a',
          }}
        >
          <div>
            <CSXPositionSideChip side={positionType} />
          </div>
          <div className="text-right">
            <CSXText variant="body1" color="STWhite">${fmtNumber(totalCost)}</CSXText>
          </div>
          <div className="text-right">
            <CSXText variant="body1" color="STWhite">${fmtNumber(marketValue)}</CSXText>
          </div>
          <div className="text-right">
            <CSXText variant="body1" color={pnlPositive ? 'STChartPositive' : 'STChartNegative'}>
              {roundedPnl > 0 ? '+' : roundedPnl < 0 ? '−' : ''}${fmtNumber(Math.abs(roundedPnl))}
            </CSXText>
          </div>
        </div>
      </button>

      <BottomSheet
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={`${positionType === 'long' ? 'Up' : 'Down'} Position`}
      >
        <MobileDetailRow label="Direction" value={positionType === 'long' ? 'Up' : 'Down'} />
        <MobileDetailRow label="Contracts" value={String(totalContracts)} />
        <MobileDetailRow label="Avg entry" value={`$${fmtNumber(avgEntryPrice)}`} />
        <MobileDetailRow label="Paid" value={`$${fmtNumber(totalCost)}`} />
        <MobileDetailRow label="Current" value={`$${fmtNumber(currentPrice)}`} />
        <MobileDetailRow label="Worth Now" value={`$${fmtNumber(marketValue)}`} />
        <MobileDetailRow
          label="Unrealized P&L"
          value={`${roundedPnl > 0 ? '+' : roundedPnl < 0 ? '−' : ''}$${fmtNumber(Math.abs(roundedPnl))}`}
          valueColor={pnlPositive ? 'STChartPositive' : 'STChartNegative'}
        />
        {closeError && (
          <div style={{ marginTop: '0.75rem', padding: '0.625rem 0.75rem', borderRadius: '0.5rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <CSXText variant="body2" color="STChartNegative">{closeError}</CSXText>
          </div>
        )}
        <button
          type="button"
          onClick={requestClose}
          disabled={isClosing}
          style={{ width: '100%', marginTop: '1.5rem', padding: '0.75rem 0', borderRadius: '624.9375rem', background: isClosing ? '#3f3f46' : '#ffffff', border: 'none', cursor: isClosing ? 'not-allowed' : 'pointer' }}
        >
          <CSXText variant="body2Semibold" color={isClosing ? 'STSecondary' : 'STForeground'}>
            {isClosing ? 'Closing…' : `Close position${positions.length > 1 ? 's' : ''}`}
          </CSXText>
        </button>
      </BottomSheet>

      <ConfirmCloseDialog
        open={confirmOpen}
        positionCount={positions.length}
        side={positionType}
        contracts={totalContracts}
        estPnl={roundedPnl}
        busy={isClosing}
        zIndex={10001}
        onConfirm={() => { void handleClose() }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}
