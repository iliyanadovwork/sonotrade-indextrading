'use client'

import { memo, useState, useEffect, useRef, type CSSProperties } from 'react'
import { createIdempotencyHolder } from '@/lib/idempotency'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { SXRelatedProfiles, type RelatedProfileInput } from './SXRelatedProfiles'
import { SlideToTrade } from '@/components/mobile/SlideToTrade'
import { CSXText } from '@/components/sx/core/CSXText'
import { CSXTextualLink, brightenTowardWhite } from '@/components/sx/core/CSXTextualLink'
import { resolveSXColor } from '@/components/sx/core/sx-color-tokens'
import { useMyPositions } from '@/lib/hooks/useMyPositions'

/** Fade in/out of the success state, and the delay before unmounting it. */
const SUCCESS_FADE_MS = 220
/** How long the confirmation holds before auto-dismissing. */
const SUCCESS_HOLD_MS = 4000
/** Minimum value of any exposure-opening order; keep in sync with place_order_tx. */
const MIN_ORDER_USD = 1

const SIDE_MUTED = '#5c5c5c'
const TEXT_BUTTON_GLIMMER =
  '0 0 0.75rem rgba(255, 255, 255, 0.4)' as const

/** Long / Short / Dollars — text buttons with link-like hover (optional glimmer). */
function TradeTextButton({
  label,
  color,
  glimmer = false,
  onClick,
  style,
}: {
  label: string
  color: string
  glimmer?: boolean
  onClick: () => void
  style?: CSSProperties
}) {
  const [hovered, setHovered] = useState(false)
  const rest = resolveSXColor(color)
  const resolved = hovered ? brightenTowardWhite(rest) : rest

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      className="cursor-pointer border-none bg-transparent px-0 transition-[color,text-shadow,filter] duration-150"
      style={style}
    >
      <CSXText
        variant="title"
        color={resolved}
        style={
          glimmer && hovered
            ? { textShadow: TEXT_BUTTON_GLIMMER, filter: 'brightness(1.12)' }
            : undefined
        }
      >
        {label}
      </CSXText>
    </button>
  )
}

interface SXTradingPanelProps {
  spotifyId: string
  contractPrice?: number
  availableFunds?: number
  className?: string
  related?: RelatedProfileInput[]
  /** Render the slide-to-trade control instead of the button (mobile drawer). */
  mobile?: boolean
  /** Focus the amount input once the mobile drawer has settled open. */
  focusAmount?: boolean
}

type InputMode = 'contracts' | 'dollars'

/** What the confirmation state renders once an order fills. */
interface SuccessInfo {
  position: 'long' | 'short'
  contracts: number
  amount: number
}

function formatUsd(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** Label / value row for the order ticket — muted left, tabular right. */
function OrderSummaryRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <CSXText variant="subtitle" color="STSecondary">{label}</CSXText>
      <CSXText variant="subtitle" color="STWhite">
        <span style={{ fontFamily: 'var(--font-inter)', fontVariantNumeric: 'tabular-nums' }}>
          {value}
        </span>
      </CSXText>
    </div>
  )
}

function SXTradingPanelInner({
  spotifyId,
  contractPrice = 0,
  availableFunds,
  className = '',
  related = [],
  mobile = false,
  focusAmount = false,
}: SXTradingPanelProps) {
  // Minted once per intent; reused only across retries that never got an answer.
  const idempotency = useRef(createIdempotencyHolder()).current
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [position, setPosition] = useState<'long' | 'short'>('long')
  const [inputValue, setInputValue] = useState<string>('')
  const [inputMode, setInputMode] = useState<InputMode>('dollars')
  const [inputVisible, setInputVisible] = useState(true)
  const fadingRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [userBalance, setUserBalance] = useState<number>(0)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)
  const [tradeError, setTradeError] = useState<string | null>(null)
  // Success is a full-card confirmation state (animated checkmark), not a banner.
  const [successInfo, setSuccessInfo] = useState<SuccessInfo | null>(null)
  const [successVisible, setSuccessVisible] = useState(false)
  const successHoldRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const successUnmountRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [errorKey, setErrorKey] = useState(0)
  // Same cache entry as SXOpenPosition on this page — both ask for the same
  // artist, so this pair really was a duplicate request.
  const { positions: myPositions, refetch: fetchOpenPosition } = useMyPositions(spotifyId)
  const openPosition = myPositions[0] ?? null

  const loadBalanceFromCache = () => {
    const token = localStorage.getItem('auth_token')
    if (!token) { setIsLoggedIn(false); setUserBalance(0); return }
    try {
      const user = JSON.parse(localStorage.getItem('user') || 'null')
      if (user) { setUserBalance(Number(user.balance) || 0); setIsLoggedIn(true) }
      else setIsLoggedIn(true)
    } catch { setIsLoggedIn(true) }
  }

  const refreshBalance = async () => {
    const token = localStorage.getItem('auth_token')
    if (!token) return
    try {
      const response = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      if (response.ok) {
        const data = await response.json()
        setUserBalance(Number(data.user.balance) || 0)
        setIsLoggedIn(true)
        localStorage.setItem('user', JSON.stringify(data.user))
      } else {
        setIsLoggedIn(false)
        setUserBalance(0)
        localStorage.removeItem('auth_token')
        localStorage.removeItem('user')
      }
    } catch {}
  }

  useEffect(() => {
    // Initial sync from the cached auth/session on mount — external (localStorage)
    // → React state. Intentional setState-in-effect (mount-only init).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadBalanceFromCache()
    fetchOpenPosition()
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'user' || e.key === 'auth_token') loadBalanceFromCache()
    }
    const handleAuthChange = () => loadBalanceFromCache()
    const handleBalanceRefresh = () => { loadBalanceFromCache(); fetchOpenPosition() }
    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('authChange', handleAuthChange)
    window.addEventListener('balanceRefresh', handleBalanceRefresh)
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('authChange', handleAuthChange)
      window.removeEventListener('balanceRefresh', handleBalanceRefresh)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Autofocus once the mobile drawer reports it has settled open. Timing
  // tracks MobileTradeDrawer's 340ms slide-up so focus lands after the sheet
  // is on-screen (iOS Safari also needs focus close enough to the open tap
  // gesture to bring up the keyboard).
  useEffect(() => {
    if (!mobile || !focusAmount) return
    const t = setTimeout(() => inputRef.current?.focus(), 360)
    return () => clearTimeout(t)
  }, [mobile, focusAmount])

  const openSignup = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('auth', 'signup')
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const dismissSuccess = () => {
    if (successHoldRef.current) { clearTimeout(successHoldRef.current); successHoldRef.current = null }
    setSuccessVisible(false)
    // Unmount after the exit fade, matching the OverlayCard convention.
    successUnmountRef.current = setTimeout(() => setSuccessInfo(null), SUCCESS_FADE_MS)
  }

  // Clear the auto-dismiss / unmount timers if the panel goes away first
  // (e.g. the mobile drawer closes mid-confirmation).
  useEffect(() => () => {
    if (successHoldRef.current) clearTimeout(successHoldRef.current)
    if (successUnmountRef.current) clearTimeout(successUnmountRef.current)
  }, [])

  // Allow digits only in contracts mode; digits + single decimal point in dollars mode
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    const pattern = inputMode === 'dollars' ? /^\d*\.?\d{0,2}$/ : /^\d*\.?\d?$/
    if (value === '' || pattern.test(value)) setInputValue(value)
  }

  const handleModeChange = (mode: InputMode) => {
    if (fadingRef.current) return
    fadingRef.current = true
    setInputVisible(false)
    setTimeout(() => {
      setInputMode(mode)
      setInputValue('')
      setInputVisible(true)
      fadingRef.current = false
    }, 150)
  }

  // Derived quantities
  const rawNum = parseFloat(inputValue) || 0

  const contractsQty: number = (() => {
    if (inputMode === 'contracts') return Math.floor(rawNum * 10) / 10
    if (contractPrice <= 0) return 0
    return Math.floor((rawNum / contractPrice) * 10) / 10
  })()

  const grossTotal: number | null = contractsQty > 0 && contractPrice > 0
    ? parseFloat((contractsQty * contractPrice).toFixed(2))
    : null

  const displayBalance = availableFunds !== undefined ? availableFunds : userBalance

  const opposingPosition =
    (position === 'long' && openPosition?.position_type === 'short') ||
    (position === 'short' && openPosition?.position_type === 'long')
      ? openPosition!
      : null

  const marginReturned: number = opposingPosition
    ? parseFloat(((opposingPosition.total_cost / opposingPosition.contracts) * Math.min(contractsQty, opposingPosition.contracts)).toFixed(2))
    : 0

  const netTotal: number | null = grossTotal !== null
    ? parseFloat(Math.max(0, grossTotal - marginReturned).toFixed(2))
    : null

  const insufficientFunds = (() => {
    if (netTotal === null) return false
    return position === 'long' && netTotal > displayBalance
  })()

  // Mirrors the $1.00 minimum place_order_tx enforces on every leg that OPENS
  // exposure (sql/20260906_min_order_value.sql). Reducing or closing an
  // opposing position is exempt; only the contracts beyond it — the new leg
  // of a flip — count. Checked here so the message shows before submit.
  const openingNotional: number = (() => {
    if (contractsQty <= 0 || contractPrice <= 0) return 0
    const openingQty = opposingPosition
      ? Math.max(0, contractsQty - opposingPosition.contracts)
      : contractsQty
    return openingQty * contractPrice
  })()
  const belowMinimumOrder = openingNotional > 0 && openingNotional < MIN_ORDER_USD

  const orderLabel = (() => {
    if (!opposingPosition) return `Place ${position} order`
    const qtyToClose = Math.min(contractsQty, opposingPosition.contracts)
    const flipQty = contractsQty - qtyToClose
    if (flipQty === 0) return `Close ${opposingPosition.position_type}`
    if (qtyToClose === opposingPosition.contracts) return `Close ${opposingPosition.position_type} + ${position} ${flipQty}`
    return `Reduce ${opposingPosition.position_type} by ${qtyToClose}`
  })()

  const hasAmount = rawNum > 0

  const actionDisabled = isExecuting || !hasAmount || contractsQty === 0 || !isLoggedIn || insufficientFunds || belowMinimumOrder

  const actionLabel = isExecuting
    ? 'Placing order...'
    : !hasAmount || contractsQty === 0
    ? 'Enter amount'
    : insufficientFunds
    ? 'Insufficient funds'
    : belowMinimumOrder
    ? `Minimum order is $${MIN_ORDER_USD.toFixed(2)}`
    : !isLoggedIn
    ? 'Sign up to trade'
    : orderLabel

  const slideLabel = isExecuting ? 'Placing order...' : `Slide to ${position}`

  const executeTrade = async () => {
    const token = localStorage.getItem('auth_token')
    if (!token) {
      setTradeError('Please log in to trade')
      setErrorKey(k => k + 1)
      return
    }
    if (!hasAmount || contractsQty <= 0) {
      setTradeError('Please enter a valid amount')
      setErrorKey(k => k + 1)
      return
    }
    if (belowMinimumOrder) {
      setTradeError(`Minimum order is $${MIN_ORDER_USD.toFixed(2)}`)
      setErrorKey(k => k + 1)
      return
    }

    setIsExecuting(true)
    setTradeError(null)

    try {
      const response = await fetch('/api/orders/place', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotency.take(),
        },
        body: JSON.stringify({
          spotify_id: spotifyId,
          side: position === 'long' ? 'buy' : 'sell',
          quantity: contractsQty,
        }),
      })

      // The server answered, so this intent is settled — the next submit is a

      // new one. Only a request that never got a reply keeps the key alive.

      idempotency.settle()

      const data = await response.json()

      if (response.ok) {
        // Flip the whole card to the animated-checkmark confirmation. Two frames
        // so the transparent state commits before the fade starts (a single
        // frame can be coalesced, which skips the transition).
        if (successUnmountRef.current) { clearTimeout(successUnmountRef.current); successUnmountRef.current = null }
        setSuccessInfo({
          position,
          contracts: Number(data.order?.filled_quantity) || contractsQty,
          amount: netTotal ?? grossTotal ?? rawNum,
        })
        requestAnimationFrame(() => requestAnimationFrame(() => setSuccessVisible(true)))
        if (successHoldRef.current) clearTimeout(successHoldRef.current)
        successHoldRef.current = setTimeout(dismissSuccess, SUCCESS_HOLD_MS)
        setInputValue('')
        // Notify sibling components (SXOpenPosition) to refetch — replaces the
        // old 10s polling on the positions table.
        window.dispatchEvent(new Event('tradeComplete'))
        setTimeout(() => { refreshBalance().then(() => window.dispatchEvent(new Event('balanceRefresh'))); fetchOpenPosition() }, 500)
      } else {
        setTradeError(data.error || 'Trade failed')
        setErrorKey(k => k + 1)
      }
    } catch {
      setTradeError('Network error. Please try again.')
      setErrorKey(k => k + 1)
    } finally {
      setIsExecuting(false)
    }
  }

  return (
    <div className={`w-full max-w-[43.4375rem] ${className}`}>
      <div className={`relative overflow-hidden ${mobile ? '' : 'bg-[#131313] rounded-2xl p-5'}`}>
      {/* Order filled — the WHOLE card flips to a solid success state with a
          gamified animated checkmark (replaces the old inline green banner).
          The circle draws itself, then the tick, then the copy rises in.
          Tap to dismiss; also auto-dismisses after SUCCESS_HOLD_MS. */}
      {successInfo && (
        <>
          <style>{`
            @keyframes tc-pop { 0%{transform:scale(0.5);opacity:0} 60%{transform:scale(1.12)} 100%{transform:scale(1);opacity:1} }
            @keyframes tc-circle { to { stroke-dashoffset: 0 } }
            @keyframes tc-mark { to { stroke-dashoffset: 0 } }
            @keyframes tc-rise { from{opacity:0;transform:translateY(0.5rem)} to{opacity:1;transform:translateY(0)} }
            .tc-check { animation: tc-pop 440ms cubic-bezier(0.22,1,0.36,1) both; }
            .tc-circle { stroke-dasharray: 151; stroke-dashoffset: 151; animation: tc-circle 460ms ease-out 120ms forwards; }
            .tc-mark { stroke-dasharray: 48; stroke-dashoffset: 48; animation: tc-mark 300ms ease-out 440ms forwards; }
            .tc-rise { animation: tc-rise 340ms ease-out 480ms both; }
            @media (prefers-reduced-motion: reduce) {
              .tc-check, .tc-rise { animation: none; }
              .tc-circle, .tc-mark { animation: none; stroke-dashoffset: 0; }
            }
          `}</style>
          <div
            onClick={dismissSuccess}
            role="status"
            aria-live="polite"
            className="absolute inset-0 z-20 flex cursor-pointer flex-col items-center justify-center gap-3 px-6 text-center"
            style={{
              background: 'var(--st-success-surface)',
              opacity: successVisible ? 1 : 0,
              transition: `opacity ${SUCCESS_FADE_MS}ms ease`,
              fontFamily: 'var(--font-geist-sans)',
            }}
          >
            <svg className="tc-check" width="76" height="76" viewBox="0 0 52 52" fill="none" aria-hidden="true">
              <circle className="tc-circle" cx="26" cy="26" r="24" strokeWidth="2.5" stroke="var(--st-white)" strokeOpacity="0.85" />
              <path className="tc-mark" d="M15 27 l7.5 7.5 L38 18" strokeWidth="4.5" stroke="var(--st-white)" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="tc-rise">
              <CSXText variant="title" color="STWhite" style={{ fontWeight: 600 }}>Trade confirmed</CSXText>
            </span>
            <span className="tc-rise">
              <CSXText variant="subtitle" color="STWhite" style={{ opacity: 0.95 }}>
                {successInfo.position === 'long' ? 'Long' : 'Short'}
                {' · '}
                {successInfo.contracts.toFixed(1)} contracts
                {' · '}
                ${successInfo.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </CSXText>
            </span>
          </div>
        </>
      )}

      {/* Long/Short toggle + mode dropdown */}
      <div className="flex items-center justify-between pb-6">
        <div className="flex gap-4">
          <TradeTextButton
            label="Long"
            color={position === 'long' ? 'STPositive' : SIDE_MUTED}
            glimmer
            onClick={() => setPosition('long')}
          />
          <TradeTextButton
            label="Short"
            color={position === 'short' ? 'var(--st-chart-negative)' : SIDE_MUTED}
            glimmer
            onClick={() => setPosition('short')}
          />
        </div>

        <TradeTextButton
          label={inputMode === 'contracts' ? 'Contracts' : 'Dollars'}
          color="STSecondary"
          onClick={() => handleModeChange(inputMode === 'contracts' ? 'dollars' : 'contracts')}
          style={{ opacity: inputVisible ? 1 : 0, transition: 'opacity 0.15s ease' }}
        />
      </div>

      {/* Amount row: $ / field / unit share one baseline.
          The input is position:absolute inside the measure box so it can't
          poison flex baseline alignment (UA inputs don't baseline like text).
          No paddingBottom hacks on the unit — those skew the baseline. */}
      <div
        className="flex flex-nowrap items-baseline gap-2.5 py-4"
        style={{ opacity: inputVisible ? 1 : 0, transition: 'opacity 0.15s ease' }}
      >
        {inputMode === 'dollars' && (
          <CSXText
            variant="chartAnimatedPrice"
            color="STWhite"
            style={{ fontSize: '2.5rem', lineHeight: 1, fontWeight: 400 }}
          >
            $
          </CSXText>
        )}
        <div
          className="relative inline-grid shrink-0"
          style={{
            fontFamily: 'var(--font-geist-sans)',
            fontSize: '2.5rem',
            fontWeight: 400,
            lineHeight: 1,
            gridTemplateColumns: 'max-content',
          }}
        >
          <span
            aria-hidden
            className="invisible whitespace-pre"
            style={{ gridArea: '1 / 1' }}
          >
            {inputValue || '0'}
          </span>
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            pattern="\d*\.?\d?"
            placeholder="0"
            value={inputValue}
            onChange={handleInputChange}
            size={1}
            className="absolute inset-0 bg-transparent text-white outline-none border-none placeholder-white/30"
            style={{
              width: '100%',
              height: '100%',
              minWidth: 0,
              font: 'inherit',
              lineHeight: 'inherit',
              padding: 0,
              margin: 0,
              border: 'none',
            }}
          />
        </div>
        {inputMode === 'contracts' && (
          <CSXText
            variant="title"
            color="STSecondary"
            style={{ lineHeight: 1 }}
          >
            Contracts
          </CSXText>
        )}
      </div>

      {/* Compact order summary — price, cash, quantity. */}
      <div className="py-5 space-y-3">
        <OrderSummaryRow
          label="Contract price"
          value={contractPrice > 0 ? formatUsd(contractPrice) : '—'}
        />
        <OrderSummaryRow
          label="Available cash"
          value={formatUsd(displayBalance)}
        />
        {hasAmount && contractsQty > 0 && (
          <OrderSummaryRow
            label="Quantity"
            value={`${contractsQty.toFixed(1)} contracts`}
          />
        )}
      </div>

      {/* Trade error (success is the full-card confirmation state above) */}
      {tradeError && (
        <div
          className="mb-4 rounded border border-st-chart-negative/20 bg-st-chart-negative/10 p-3"
          role="alert"
        >
          <CSXText variant="body1" color="var(--st-chart-negative)">{tradeError}</CSXText>
        </div>
      )}

      {/* Action: slide-to-trade on mobile; solid CTA on desktop (and for
          signed-out signup). Same CSXText title treatment everywhere. */}
      {!isLoggedIn && hasAmount ? (
        <button
          onClick={openSignup}
          type="button"
          className="flex w-full items-center justify-center rounded-full bg-white hover:opacity-90 active:scale-95 transition-all duration-75"
          style={{ height: mobile ? 60 : 48 }}
        >
          <CSXText variant="title" color="STForeground">
            Sign up to trade
          </CSXText>
        </button>
      ) : mobile ? (
        <SlideToTrade
          label={actionDisabled && !isExecuting ? actionLabel : slideLabel}
          disabled={actionDisabled}
          isExecuting={isExecuting}
          errorKey={errorKey}
          onConfirm={executeTrade}
        />
      ) : (
        <button
          onClick={executeTrade}
          type="button"
          className="flex w-full items-center justify-center rounded-full bg-white hover:opacity-90 active:scale-95 transition-all duration-75 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ height: 48 }}
          disabled={actionDisabled}
        >
          <CSXText variant="title" color="STForeground">
            {actionLabel}
          </CSXText>
        </button>
      )}

      <p className="mt-5 mb-0 text-center">
        <CSXText variant="body2" color="STSecondary">
          By trading, you agree to the{' '}
          <CSXTextualLink
            href="/terms"
            variant="body2"
            color="STSecondary"
            className="underline underline-offset-2"
          >
            Terms of Use
          </CSXTextualLink>
          .
        </CSXText>
      </p>
      </div>

      {!mobile && related.length > 0 && <SXRelatedProfiles related={related} />}
    </div>
  )
}

// Memoized: parents re-render on every chart-hover frame; this panel's
// props are hover-independent.
export const SXTradingPanel = memo(SXTradingPanelInner)
