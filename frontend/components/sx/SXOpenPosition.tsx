'use client'

import { memo, useState} from 'react'
import { useClosePosition } from '@/lib/hooks/useClosePosition'
import dynamic from 'next/dynamic'
import { CSXText } from './core/CSXText'
import { CSXButton } from './core/CSXButton'
import { CSXPositionSideChip } from './core/CSXInfoChip'
import type { SXColorToken } from './core/sx-color-tokens'
import { useLiveArtistPrice } from '@/lib/hooks/useLiveArtistPrice'
import { ConfirmCloseDialog, shouldSkipCloseConfirm } from '@/components/shared/ConfirmCloseDialog'
import { useMyPositions } from '@/lib/hooks/useMyPositions'
import { fmtIndexPrice } from '@/lib/format'

const SXSharePositionModal = dynamic(
  () => import('./SXSharePositionModal').then(mod => ({ default: mod.SXSharePositionModal })),
  { ssr: false }
)

interface SXOpenPositionProps {
  spotifyId: string
  artistName: string
  initialPrice?: number | null
}

function SXOpenPositionInner({ spotifyId, artistName, initialPrice = null }: SXOpenPositionProps) {
  const { close: closePosition, isClosing } = useClosePosition()
  // Shared with the trading panel on the same page, which asks for the same
  // artist; a trade revalidates both.
  const { positions, loading, refetch: fetchPositions } = useMyPositions(spotifyId)
  // Tracks the initial load; not read in render but kept so the fetch flow
  // mirrors frontend's SXOpenPosition. eslint-disable below for the no-read.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [username, setUsername] = useState('')
  // Live index price via Realtime (seeded from SSR) — replaces 10s polling.
  const liveIndexPrice = useLiveArtistPrice(spotifyId, initialPrice)




  const handleClosePositions = () => {
    const token = localStorage.getItem('auth_token')
    if (!token) {
      alert('Please log in to close positions')
      return
    }
    // Styled confirmation instead of the native confirm(); users can opt out
    // via "Don't ask again" in the dialog.
    if (shouldSkipCloseConfirm()) { void doClosePositions(); return }
    setConfirmOpen(true)
  }

  const doClosePositions = async () => {
    setConfirmOpen(false)
    const result = await closePosition(spotifyId)
    if (!result.ok) {
      alert(`Error: ${result.error}`)
      return
    }
    const pnl = result.totalProfitLoss ?? 0
    const pnlText = pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`
    alert(`Positions closed successfully!\nP&L: ${pnlText}\nNew balance: $${(result.newBalance ?? 0).toFixed(2)}`)
    fetchPositions()
  }

  const totalContracts = positions.reduce((sum, pos) => sum + pos.contracts, 0)
  const totalCost      = positions.reduce((sum, pos) => sum + pos.total_cost, 0)
  const avgEntryPrice  = totalContracts > 0 ? totalCost / totalContracts : 0
  const positionType   = positions[0]?.position ?? 'long'

  // Unrealized P&L uses index price as the current market price
  const livePrice      = liveIndexPrice
  const marketValue    = livePrice != null ? totalContracts * livePrice : null
  const unrealizedPnL  = livePrice != null
    ? positionType === 'long'
      ? (livePrice - avgEntryPrice) * totalContracts
      : (avgEntryPrice - livePrice) * totalContracts
    : null
  const roundedPnl     = unrealizedPnL != null ? Math.round(unrealizedPnL * 100) / 100 : null
  const isProfitable   = roundedPnl != null && roundedPnl >= 0

  const r2 = (n: number) => Math.round(n * 100) / 100
  const marketValueColor: SXColorToken | string =
    marketValue == null
      ? 'STMuted'
      : positionType === 'long'
        ? r2(marketValue) < r2(totalCost) ? 'STChartNegative' : 'STPositive'
        : r2(marketValue) > r2(totalCost) ? 'STChartNegative' : 'STPositive'

  return (
    <>
      <ConfirmCloseDialog
        open={confirmOpen}
        artistName={artistName}
        positionCount={positions.length}
        side={positionType}
        contracts={totalContracts}
        estPnl={roundedPnl}
        busy={isClosing}
        onConfirm={() => { void doClosePositions() }}
        onCancel={() => setConfirmOpen(false)}
      />
      <div className="w-full border-b border-zinc-800 py-6">
        <div className="flex items-center justify-between">
          <div className="flex mb-4 items-center gap-3">
            <CSXText variant="subtitle" color="STWhite">
              Positions
            </CSXText>
            {positions.length > 0 && (
              <>
                <div className={`h-2.5 w-2.5 animate-pulse rounded-full ${positionType === 'long' ? 'bg-st-chart-positive' : 'bg-st-chart-negative'}`} />
                <CSXButton
                  variant="outline"
                  size="compact"
                  label={isClosing ? 'Closing…' : `Close position${positions.length > 1 ? 's' : ''}`}
                  onClick={handleClosePositions}
                  disabled={isClosing}
                />
              </>
            )}
          </div>
        </div>

        {positions.length > 0 ? (
          <div className="border-t border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="py-3 text-left font-normal">
                  <CSXText variant="body3" color="STMuted">
                    Side
                  </CSXText>
                </th>
                <th className="py-3 pr-6 text-right font-normal">
                  <CSXText variant="body3" color="STMuted">
                    Contracts
                  </CSXText>
                </th>
                <th className="py-3 pr-6 text-right font-normal">
                  <CSXText variant="body3" color="STMuted">
                    Entry
                  </CSXText>
                </th>
                <th className="py-3 pr-6 text-right font-normal">
                  <CSXText variant="body3" color="STMuted">
                    Total Entry
                  </CSXText>
                </th>
                <th className="py-3 pr-6 text-right font-normal">
                  <CSXText variant="body3" color="STMuted">
                    Current
                  </CSXText>
                </th>
                <th className="py-3 pr-6 text-right font-normal">
                  <CSXText variant="body3" color="STMuted">
                    Market Value
                  </CSXText>
                </th>
                <th className="py-3 pr-6 text-right font-normal">
                  <CSXText variant="body3" color="STMuted">
                    Unrealized P&L
                  </CSXText>
                </th>
                <th className="py-3 font-normal" />
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-4">
                  <CSXPositionSideChip side={positionType} />
                </td>
                <td className="py-4 pr-6 text-right">
                  <CSXText variant="body2" color="STWhite">
                    {totalContracts}
                  </CSXText>
                </td>
                <td className="py-4 pr-6 text-right">
                  <CSXText variant="body2" color="STWhite">
                    ${fmtIndexPrice(avgEntryPrice)}
                  </CSXText>
                </td>
                <td className="py-4 pr-6 text-right">
                  <CSXText variant="body2" color="STWhite">
                    ${(avgEntryPrice * totalContracts).toFixed(2)}
                  </CSXText>
                </td>
                <td className="py-4 pr-6 text-right">
                  <CSXText variant="body2" color="STSecondary">
                    {livePrice != null ? `$${fmtIndexPrice(livePrice)}` : '—'}
                  </CSXText>
                </td>
                <td className="py-4 pr-6 text-right">
                  <CSXText variant="body2" color={marketValueColor}>
                    {marketValue != null ? `$${marketValue.toFixed(2)}` : '—'}
                  </CSXText>
                </td>
                <td className="py-4 text-right">
                  {roundedPnl != null ? (
                    <span>
                      <CSXText variant="body2" color={isProfitable ? 'STPositive' : 'STChartNegative'}>
                        {roundedPnl > 0 ? '+' : roundedPnl < 0 ? '-' : ''}${Math.abs(roundedPnl).toFixed(2)}
                      </CSXText>
                      <span className="ml-1 inline opacity-80">
                        <CSXText variant="body3" color="STMuted">
                          ({roundedPnl > 0 ? '+' : roundedPnl < 0 ? '-' : ''}
                          {Math.abs(totalCost > 0 ? (roundedPnl / totalCost) * 100 : 0).toFixed(2)}%)
                        </CSXText>
                      </span>
                    </span>
                  ) : (
                    <CSXText variant="body2" color="STMuted">
                      —
                    </CSXText>
                  )}
                </td>
                <td className="py-4 text-right">
                  <button
                    type="button"
                    className="ml-auto flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-zinc-500 transition-colors hover:text-white"
                    aria-label="Share position"
                    onClick={() => setIsShareModalOpen(true)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" />
                      <path d="m21.854 2.147-10.94 10.939" />
                    </svg>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          </div>
        ) : (
          <div>
            <CSXText variant="body2" color="STSecondary">
              No positions yet
            </CSXText>
          </div>
        )}
      </div>

      <SXSharePositionModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        username={username}
        artistName={artistName}
        contracts={totalContracts}
        position={positionType}
        profitLoss={unrealizedPnL}
        isOpenPosition
        entryPrice={avgEntryPrice}
        currentPrice={livePrice ?? undefined}
      />
    </>
  )
}

// Memoized: parents re-render on every chart-hover frame.
export const SXOpenPosition = memo(SXOpenPositionInner)
