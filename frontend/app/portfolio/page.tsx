'use client'

import { useEffect,  useState,  useRef } from 'react'
import { useClosePosition } from '@/lib/hooks/useClosePosition'
import { useRouter } from 'next/navigation'
import { ConfirmCloseDialog, shouldSkipCloseConfirm } from '@/components/shared/ConfirmCloseDialog'
import dynamic from 'next/dynamic'
import { CSXLiquidatedChip, CSXPositionSideChip } from '@/components/sx/core/CSXInfoChip'
import { CSXText, type SXColorToken } from '@/components/sx/core/CSXText'
import { CSXButton } from '@/components/sx/core/CSXButton'
import NumberFlow, { NumberFlowGroup } from '@number-flow/react'
import { CSXTextualLink } from '@/components/sx/core/CSXTextualLink'
import { SXPageLoading } from '@/components/sx/SXPageLoading'
import { SXSectionHeading } from '@/components/sx/SXSectionHeading'
import { UsernameEditor } from '@/components/shared/UsernameEditor'
import { logout } from '@/lib/logout'
import {
  SXTable,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/sx/SXTable'
import { fmtDateTime, fmtNumber, fmtIndexPrice } from '@/lib/format'
import { usePortfolio } from '@/lib/hooks/usePortfolio'
import type { Position, ClosedPosition } from '@/lib/hooks/usePortfolio'
import { useTradeHistory } from '@/lib/hooks/useTradeHistory'

const SXSharePositionModal = dynamic(
  () => import('@/components/sx/SXSharePositionModal').then(mod => ({ default: mod.SXSharePositionModal })),
  { ssr: false }
)

export default function PortfolioPage() {
  const { close: closePosition, closingId } = useClosePosition()
  const [closeError, setCloseError] = useState<string | null>(null)
  const router = useRouter()
  // Shared cache with the mobile panel and the profile page; a trade anywhere
  // revalidates it for all three.
  const { data, loading, error, refetch: fetchPortfolio } = usePortfolio()
  const { history: closedPositions } = useTradeHistory()
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [totalVolume, setTotalVolume] = useState(0)
  const [displayPortfolioValue, setDisplayPortfolioValue] = useState(0)
  const [displayBalance, setDisplayBalance] = useState(0)
  const [displayMarketValue, setDisplayMarketValue] = useState(0)
  const [displayPnl, setDisplayPnl] = useState(0)
  const [displayVolume, setDisplayVolume] = useState(0)
  const [shareModal, setShareModal] = useState<{
    artistName: string
    contracts: number
    position: 'long' | 'short'
    profitLoss: number
    isOpenPosition?: boolean
    entryPrice?: number
    currentPrice?: number
  } | null>(null)
  const [confirmClose, setConfirmClose] = useState<{
    spotifyId: string; positionId: string; artistName: string
    side: 'long' | 'short'; contracts: number; pnl: number | null
  } | null>(null)

  const requestClosePosition = (pos: {
    spotify_id?: string | null; artist_name: string; id: string
    position_type: 'long' | 'short'; contracts: number; unrealized_pnl?: number | null
  }) => {
    const spotifyId = pos.spotify_id ?? pos.artist_name
    if (shouldSkipCloseConfirm()) { void doClosePosition(spotifyId, pos.id); return }
    setConfirmClose({
      spotifyId, positionId: pos.id, artistName: pos.artist_name,
      side: pos.position_type, contracts: pos.contracts, pnl: pos.unrealized_pnl ?? null,
    })
  }

  const doClosePosition = async (spotifyId: string, positionId: string) => {
    setConfirmClose(null)
    const result = await closePosition(spotifyId, positionId)
    // Previously this branch did not exist: a failed close just stopped
    // spinning and said nothing.
    if (result.ok) fetchPortfolio()
    else setCloseError(result.error)
  }

  useEffect(() => {
    // Auth guard only — usePortfolio does the fetching. Kept here because the
    // page must bounce a signed-out visitor rather than render an empty shell.
    const token = localStorage.getItem('auth_token')
    if (!token) { router.push('/'); return }
    try {
      const storedUser = JSON.parse(localStorage.getItem('user') || 'null')
      if (storedUser?.avatar_url) setAvatarUrl(storedUser.avatar_url)
      if (storedUser?.total_volume != null) setTotalVolume(Number(storedUser.total_volume))
    } catch {}
  }, [router])

  useEffect(() => {
    if (loading || !data) return
    const portfolioValue = data.balance + data.total_market_value
    const realized = closedPositions.reduce((sum, p) => sum + (p.unrealized_pnl || 0), 0)
    const pnl = data.total_unrealized_pnl + realized
    const raf = requestAnimationFrame(() => {
      setDisplayPortfolioValue(portfolioValue)
      setDisplayBalance(data.balance)
      setDisplayMarketValue(data.total_market_value)
      setDisplayPnl(pnl)
      setDisplayVolume(totalVolume)
    })
    return () => cancelAnimationFrame(raf)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, data, totalVolume])

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const token = localStorage.getItem('auth_token')
    if (!token) return
    setAvatarUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/user/avatar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const json = await res.json()
      if (json.avatar_url) {
        setAvatarUrl(json.avatar_url)
        try {
          const storedUser = JSON.parse(localStorage.getItem('user') || 'null')
          if (storedUser) localStorage.setItem('user', JSON.stringify({ ...storedUser, avatar_url: json.avatar_url }))
        } catch {}
      }
    } finally {
      setAvatarUploading(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }

  if (loading) {
    return (
      <main className="flex flex-1 w-full flex-col bg-[rgb(10,10,10)] text-white px-3 md:px-0 pt-4 md:pt-2 pb-16">
        <SXPageLoading className="mx-auto w-full max-w-[92.5rem]" />
      </main>
    )
  }

  if (error || !data) {
    return (
      <main className="flex flex-1 w-full flex-col bg-[rgb(10,10,10)] text-white px-3 md:px-0 pt-4 md:pt-2 pb-16">
        <div className="mx-auto w-full max-w-[92.5rem]">
          <CSXText variant="body2" color="STChartNegative">
            {error || 'Failed to load'}
          </CSXText>
        </div>
      </main>
    )
  }

  const totalPnl = data.total_unrealized_pnl + closedPositions.reduce((sum, p) => sum + (p.unrealized_pnl || 0), 0)
  const pnlPositive = totalPnl >= 0

  return (
    <main className="flex flex-1 w-full flex-col bg-[rgb(10,10,10)] text-white px-3 md:px-0 pt-4 md:pt-2 pb-16" style={{ fontFamily: 'var(--font-inter)' }}>
      <div className="w-full max-w-[92.5rem] mx-auto">

        <div className="mb-8 flex items-start gap-4">
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            disabled={avatarUploading}
            className="relative flex h-14 w-14 flex-shrink-0 cursor-pointer select-none items-center justify-center overflow-hidden rounded-full bg-white text-gray-900 transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            {avatarUrl
              ? <img src={avatarUrl} alt="avatar" className="h-full w-full object-cover" />
              : (
                <CSXText variant="title" color="STForeground">
                  {(data?.username?.[0] ?? '?').toUpperCase()}
                </CSXText>
              )}
            {avatarUploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-[rgb(10,10,10)]/50">
                <svg className="h-5 w-5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              </div>
            )}
          </button>
          <div className="min-w-0 flex-1">
            <SXSectionHeading
              as="h1"
              title={
                <UsernameEditor
                  username={data.username}
                  onChanged={() => { void fetchPortfolio() }}
                />
              }
              className="!pt-0 !pb-0"
              subtitle={
                <button
                  type="button"
                  className="m-0 cursor-pointer border-0 bg-transparent p-0 text-left transition-opacity hover:opacity-80"
                  onClick={() => avatarInputRef.current?.click()}
                >
                  <CSXText variant="body2" color="STSecondary">
                    {avatarUrl ? 'Change photo' : 'Upload photo'}
                  </CSXText>
                </button>
              }
              subtitleUnstyled
            />
          </div>
          <div className="flex-shrink-0">
            <CSXButton
              variant="outline"
              size="compact"
              label="Log out"
              onClick={async () => {
                await logout()
                router.push('/')
              }}
            />
          </div>
          <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
        </div>

        {/* Summary cards */}
        <NumberFlowGroup>
        <div className="mb-10 grid grid-cols-2 md:grid-cols-5 gap-px border border-zinc-800 bg-zinc-800">
          {([
            { label: 'Total Value', value: displayPortfolioValue, color: 'var(--st-white)', format: { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol', maximumFractionDigits: 2 } },
            { label: 'Available Balance', value: displayBalance, color: 'var(--st-white)', format: { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol', maximumFractionDigits: 2 } },
            { label: 'Open Positions Value', value: displayMarketValue, color: 'var(--st-white)', format: { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol', maximumFractionDigits: 2 } },
            { label: 'P&L', value: displayPnl, color: `var(--${pnlPositive ? 'st-chart-positive' : 'st-chart-negative'})`, format: { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol', signDisplay: 'always', maximumFractionDigits: 2 } },
            { label: 'Total Volume', value: displayVolume, color: 'var(--st-white)', format: { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol', maximumFractionDigits: 2 } },
          ] as const).map(({ label, value, color, format }) => (
            <div key={label} className="bg-[rgb(10,10,10)] px-6 py-5">
              <div className="mb-1">
                <CSXText variant="body3" color="STMuted">{label}</CSXText>
              </div>
              <NumberFlow
                value={value}
                format={format as React.ComponentProps<typeof NumberFlow>['format']}
                style={{ color, fontSize: '1.25rem', fontWeight: 400, lineHeight: 'normal', letterSpacing: '-0.025em' }}
              />
            </div>
          ))}
        </div>
        </NumberFlowGroup>

        {/* Open Positions */}
        <section className="mb-10">
          <h2 className="mb-4">
            <CSXText variant="body2Medium" color="STSecondary">
              Open Positions
            </CSXText>
          </h2>
          {closeError && (
            <div
              role="alert"
              className="mb-3 rounded border px-3 py-2"
              style={{ borderColor: 'var(--st-chart-negative)', background: 'rgba(220,60,50,0.08)' }}
            >
              <CSXText variant="body2" color="STChartNegative">{closeError}</CSXText>
            </div>
          )}
          {data.positions.length === 0 ? (
            <div className="border-t border-zinc-800 py-6">
              <CSXText variant="body2" color="STMuted">
                No open positions.{' '}
              </CSXText>
              <CSXTextualLink href="/" variant="body2" color="STWhite" className="underline underline-offset-2">
                Start trading
              </CSXTextualLink>
            </div>
          ) : (
            <div className="border-t border-b border-zinc-800 bg-[rgb(10,10,10)] overflow-x-auto">
              <SXTable variant="bloomberg" className="w-full">
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-[#131313]">
                    <TableHead className="h-8 whitespace-nowrap">Artist</TableHead>
                    <TableHead className="h-8 whitespace-nowrap">Side</TableHead>
                    <TableHead className="h-8 text-right tabular-nums whitespace-nowrap">Contracts</TableHead>
                    <TableHead className="h-8 text-right tabular-nums whitespace-nowrap">Entry</TableHead>
                    <TableHead className="h-8 text-right tabular-nums whitespace-nowrap">Total Entry</TableHead>
                    <TableHead className="h-8 text-right tabular-nums whitespace-nowrap">Current</TableHead>
                    <TableHead className="h-8 text-right tabular-nums whitespace-nowrap">Market Value</TableHead>
                    <TableHead className="h-8 text-right tabular-nums whitespace-nowrap">Unrealized P&L</TableHead>
                    <TableHead plain className="h-8 p-0 text-right align-middle">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.positions.map((pos) => (
                    <PositionRow
                      key={pos.id}
                      variant="open"
                      pos={pos}
                      closing={closingId === pos.id}
                      onShare={() => setShareModal({
                        artistName: pos.artist_name,
                        contracts: pos.contracts,
                        position: pos.position_type,
                        profitLoss: pos.unrealized_pnl,
                        isOpenPosition: true,
                        entryPrice: pos.entry_price,
                        currentPrice: pos.current_price,
                      })}
                      onClose={() => requestClosePosition(pos)}
                    />
                  ))}
                </TableBody>
              </SXTable>
            </div>
          )}
        </section>

        {/* Order History */}
        <section>
          <h2 className="mb-0 border-b border-zinc-800 pb-3">
            <CSXText variant="body2Medium" color="STSecondary">
              Order History
            </CSXText>
          </h2>

          <div>
              {/* Closed Positions */}
              {closedPositions.length > 0 && (
                <div className="mb-8">
                  <h3 className="border-b border-zinc-800 py-4">
                    <CSXText variant="body3" color="STMuted">
                      Closed Positions
                    </CSXText>
                  </h3>
                  <div className="border-t border-b border-zinc-800 bg-[rgb(10,10,10)] overflow-x-auto">
                    <SXTable variant="bloomberg" className="w-full">
                      <TableHeader>
                        <TableRow className="border-zinc-800 hover:bg-[#131313]">
                          <TableHead className="h-8 whitespace-nowrap">Closed</TableHead>
                          <TableHead className="h-8 whitespace-nowrap">Artist</TableHead>
                          <TableHead className="h-8 whitespace-nowrap">Side</TableHead>
                          <TableHead className="h-8 text-right tabular-nums whitespace-nowrap">Contracts</TableHead>
                          <TableHead className="h-8 text-right tabular-nums whitespace-nowrap">Entry</TableHead>
                          <TableHead className="h-8 text-right tabular-nums whitespace-nowrap">Exit</TableHead>
                          <TableHead className="h-8 text-right tabular-nums whitespace-nowrap">P&L</TableHead>
                          <TableHead plain className="h-8 w-9 p-0 text-right align-middle">
                            <span className="sr-only">Share</span>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {closedPositions.map((pos) => (
                          <PositionRow
                            key={pos.id}
                            variant="closed"
                            pos={pos}
                            onShare={() => setShareModal({
                              artistName: pos.artist_name,
                              contracts: pos.contracts,
                              position: pos.position_type,
                              profitLoss: pos.unrealized_pnl,
                            })}
                          />
                        ))}
                      </TableBody>
                    </SXTable>
                  </div>
                </div>
              )}

              {data.order_history.length === 0 && closedPositions.length === 0 && (
                <div className="border-b border-zinc-800 py-6">
                  <CSXText variant="body2" color="STMuted">
                    No order history yet.
                  </CSXText>
                </div>
              )}
            </div>
        </section>

      </div>

      <SXSharePositionModal
        isOpen={shareModal !== null}
        onClose={() => setShareModal(null)}
        username={data.username}
        artistName={shareModal?.artistName ?? ''}
        contracts={shareModal?.contracts ?? 0}
        position={shareModal?.position ?? 'long'}
        profitLoss={shareModal?.profitLoss ?? 0}
        isOpenPosition={shareModal?.isOpenPosition}
        entryPrice={shareModal?.entryPrice}
        currentPrice={shareModal?.currentPrice}
      />

      <ConfirmCloseDialog
        open={confirmClose !== null}
        artistName={confirmClose?.artistName}
        positionCount={1}
        side={confirmClose?.side ?? 'long'}
        contracts={confirmClose?.contracts ?? 0}
        estPnl={confirmClose?.pnl}
        busy={closingId !== null}
        onConfirm={() => { if (confirmClose) void doClosePosition(confirmClose.spotifyId, confirmClose.positionId) }}
        onCancel={() => setConfirmClose(null)}
      />
    </main>
  )
}

type PositionRowProps =
  | { variant: 'open'; pos: Position; closing: boolean; onShare: () => void; onClose: () => void }
  | { variant: 'closed'; pos: ClosedPosition; onShare: () => void }

function PositionRow(props: PositionRowProps) {
  const { pos } = props
  const isOpen = props.variant === 'open'
  const r2 = (n: number) => Math.round(n * 100) / 100
  // Prices carry up to 6 dp (sub-cent markets exist); rounding them to cents
  // for the colour comparison would call every sub-cent position flat.
  const r6 = (n: number) => Math.round(n * 1e6) / 1e6
  // Open rows round P&L to cents before deriving sign/percent; closed rows use the stored value as-is.
  const pnl = isOpen ? r2(pos.unrealized_pnl) : pos.unrealized_pnl
  const pnlPos = pnl >= 0
  const pnlPct = pos.total_cost > 0 ? (pnl / pos.total_cost) * 100 : 0
  const rCurrent = r6(pos.current_price)
  const rEntry = r6(pos.entry_price)
  const mvColor: SXColorToken =
    pos.position_type === 'long'
      ? rCurrent < rEntry ? 'STChartNegative' : 'STChartPositive'
      : rCurrent > rEntry ? 'STChartNegative' : 'STChartPositive'
  return (
    <TableRow className="border-zinc-800 hover:bg-[#131313]">
      {props.variant === 'closed' && (
        <TableCell className="whitespace-nowrap" textColor="STMuted">
          {fmtDateTime(props.pos.closed_at)}
        </TableCell>
      )}
      <TableCell plain className="min-w-0">
        <CSXTextualLink
          href={`/artist/${encodeURIComponent(pos.spotify_id ?? pos.artist_name)}`}
          variant="body2"
          color="STWhite"
        >
          {pos.artist_name}
        </CSXTextualLink>
      </TableCell>
      <TableCell plain>
        {props.variant === 'closed' ? (
          <div className="flex flex-wrap items-center gap-2">
            <CSXPositionSideChip side={pos.position_type} />
            {props.pos.status === 'liquidated' && <CSXLiquidatedChip />}
          </div>
        ) : (
          <CSXPositionSideChip side={pos.position_type} />
        )}
      </TableCell>
      <TableCell className="text-right tabular-nums" textVariant="body2" textColor="STWhite">
        {pos.contracts}
      </TableCell>
      <TableCell className="text-right tabular-nums" textVariant="body2" textColor="STWhite">
        ${fmtIndexPrice(pos.entry_price)}
      </TableCell>
      {isOpen && (
        <TableCell className="text-right tabular-nums" textVariant="body2" textColor="STWhite">
          ${fmtNumber(pos.entry_price * pos.contracts)}
        </TableCell>
      )}
      <TableCell className="text-right tabular-nums" textVariant="body2" textColor="STSecondary">
        ${fmtIndexPrice(pos.current_price)}
      </TableCell>
      {props.variant === 'open' && (
        <TableCell className="text-right tabular-nums" textVariant="body2" textColor={mvColor}>
          ${fmtNumber(props.pos.market_value)}
        </TableCell>
      )}
      <TableCell plain className="text-right tabular-nums">
        <CSXText variant="body2" color={pnlPos ? 'STChartPositive' : 'STChartNegative'}>
          {isOpen ? (pnl > 0 ? '+' : pnl < 0 ? '-' : '') : pnlPos ? '+' : '-'}${fmtNumber(Math.abs(pnl))}
        </CSXText>
        <CSXText variant="body3" color="STMuted">
          {' '}({pnlPos ? '+' : '-'}{fmtNumber(Math.abs(pnlPct))}%)
        </CSXText>
      </TableCell>
      <TableCell plain className="text-right align-middle">
        {props.variant === 'open' ? (
          <div className="flex items-center justify-end gap-2">
            <ShareButton onClick={props.onShare} />
            <CSXButton
              variant="outline"
              size="compact"
              label={props.closing ? 'Closing…' : 'Close'}
              disabled={props.closing}
              onClick={props.onClose}
            />
          </div>
        ) : (
          <ShareButton onClick={props.onShare} />
        )}
      </TableCell>
    </TableRow>
  )
}

function ShareButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-500 hover:text-white transition-colors cursor-pointer"
      aria-label="Share"
      onClick={onClick}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" />
        <path d="m21.854 2.147-10.94 10.939" />
      </svg>
    </button>
  )
}
