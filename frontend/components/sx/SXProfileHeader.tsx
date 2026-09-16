'use client'

import React, { useRef, useState, useEffect, useMemo } from 'react'
import { AnimatedPrice } from './SXPriceChartWidget'
import { NumberFlowGroup } from '@number-flow/react'
import { CSXText } from './core/CSXText'
import type { SXColorToken } from './core/sx-color-tokens'
import { fmtNumber } from '@/lib/format'
import { RELEASE_COLORS } from '@/lib/constants'
import { SXShareButton } from './SXShareButton'
import { supabaseImage } from '@/lib/supabaseImage'

interface Release {
  id: string
  name: string
  type?: string
  image?: string
  date?: string
  release_date?: string
}

interface SXProfileHeaderProps {
  name: string
  id: string
  picture: string | null
  avatarHref?: string
  index_price?: number | null
  mark_price?: number | null
  funding_rate?: number | null
  volume?: number | null
  total_forecasts?: number | null
  market_cap?: number | null
  holders?: number | null
  change_1h?: number | null
  change_1d?: number | null
  data_points?: Array<{ index: number; timestamp: string }>
  selectedPeriod?: '1H' | '1D' | '1W' | '1M' | 'ALL'
  hoverPrice?: number | null
  className?: string
  releases?: Release[]
  hiddenReleaseIds?: string[]
  onToggleRelease?: (id: string) => void
  instagram?: string | null
  twitter?: string | null
  tiktok?: string | null
  spotify_url?: string | null
  appleMusic?: string | null
  youtube?: string | null
  twitch?: string | null
}

export function SXProfileHeader({
  name,
  id: _id,
  picture,
  avatarHref,
  index_price,
  mark_price: _mark_price,
  funding_rate: _funding_rate,
  market_cap,
  data_points = [],
  selectedPeriod = 'ALL',
  hoverPrice = null,
  className = '',
  releases = [],
  hiddenReleaseIds = [],
  onToggleRelease,
  appleMusic,
  youtube,
}: SXProfileHeaderProps) {
  // Memoized: this component re-renders on every chart-hover frame
  // (hoverPrice prop). The previous inline version re-sorted the full
  // array with a Date parse per comparison — ~25k Date allocations per
  // mouse-move frame on a 1200-point history. Timestamps are parsed once.
  const periodStartPrice = useMemo(() => {
    if (data_points.length < 2) return null
    const periodMs: Record<string, number> = {
      '1H':  60 * 60 * 1000,
      '1D':  24 * 60 * 60 * 1000,
      '1W':  7 * 24 * 60 * 60 * 1000,
      '1M':  30 * 24 * 60 * 60 * 1000,
      'ALL': Infinity,
    }
    const sortedPoints = data_points
      .map(p => ({ index: p.index, t: new Date(p.timestamp).getTime() }))
      .filter(p => Number.isFinite(p.t))
      .sort((a, b) => a.t - b.t)
    if (sortedPoints.length < 2) return null
    if (selectedPeriod === 'ALL') return sortedPoints[0]!.index
    const now = sortedPoints[sortedPoints.length - 1]!.t
    const cutoffTime = now - periodMs[selectedPeriod]!
    for (let i = sortedPoints.length - 1; i >= 0; i--) {
      if (sortedPoints[i]!.t <= cutoffTime) return sortedPoints[i]!.index
    }
    return sortedPoints[0]!.index
  }, [data_points, selectedPeriod])

// Derived, not state — the old setState-in-effect added a second render
  // pass on every hover update. (Both lineages fixed this the same way; the
  // period-start price itself is the useMemo above.)

  const currentPrice = hoverPrice ?? index_price ?? 0
  const currentChange = periodStartPrice != null && periodStartPrice !== 0
    ? ((currentPrice - periodStartPrice) / periodStartPrice) * 100
    : null
  const rawChange = periodStartPrice != null ? currentPrice - periodStartPrice : null

  // Persist the last valid values so the figures don't blank out while a new
  // timeframe loads.
  //
  // This was a ref written during render, which react-hooks/refs flags and
  // which a discarded concurrent render would still have mutated. State +
  // effect is equivalent here: the sticky value is only ever read when the live
  // one is null, and by then the effect has already run from the render where
  // it was non-null.
  const [stickyChange, setStickyChange] = useState<number | null>(null)
  const [stickyRawChange, setStickyRawChange] = useState<number | null>(null)
  useEffect(() => {
    if (currentChange !== null) setStickyChange(currentChange)
  }, [currentChange])
  useEffect(() => {
    if (rawChange !== null) setStickyRawChange(rawChange)
  }, [rawChange])
  const displayChange = currentChange ?? stickyChange
  const displayRawChange = rawChange ?? stickyRawChange

  const [pressedBtn, setPressedBtn] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsVisible, setSettingsVisible] = useState(false)
  const settingsRef = useRef<HTMLDivElement>(null)
  // (b) FLIP prototype: glide the $ and ⓘ when the % number's box resizes,
  // in sync with NumberFlow's own prefix/suffix tween (instead of teleporting).
  const priceSrcRef = useRef<HTMLSpanElement>(null)
  const pointsFlipRef = useRef<HTMLSpanElement>(null)
  const pctSrcRef = useRef<HTMLDivElement>(null)
  const dollarFlipRef = useRef<HTMLSpanElement>(null)
  const infoFlipRef = useRef<HTMLSpanElement>(null)
  const changeGroupFlipRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (settingsOpen) {
      requestAnimationFrame(() => requestAnimationFrame(() => setSettingsVisible(true)))
    } else {
      setSettingsVisible(false)
    }
  }, [settingsOpen])

  useEffect(() => {
    if (!settingsOpen) return
    const handleClick = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setSettingsOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [settingsOpen])

  // (b) Width-delta FLIP. A ResizeObserver on each number's box fires only when
  // that box changes width (a digit added/removed — NOT every frame). On that
  // change we invert the downstream elements by the delta and transition it to 0
  // using NumberFlow's own transformTiming, so ▲/points/ⓘ glide together with
  // the $/% instead of teleporting.
  useEffect(() => {
    const easing = 'linear(0,.005,.019,.039,.066,.096,.129,.165,.202,.24,.278,.316,.354,.39,.426,.461,.494,.526,.557,.586,.614,.64,.665,.689,.711,.731,.751,.769,.786,.802,.817,.831,.844,.856,.867,.877,.887,.896,.904,.912,.919,.925,.931,.937,.942,.947,.951,.955,.959,.962,.965,.968,.971,.973,.976,.978,.98,.981,.983,.984,.986,.987,.988,.989,.99,.991,.992,.992,.993,.994,.994,.995,.995,.996,.996,.9963,.9967,.9969,.9972,.9975,.9977,.9979,.9981,.9982,.9984,.9985,.9987,.9988,.9989,1)'
    // Synchronous, blending FLIP. Setting the inline transform inside the
    // ResizeObserver callback applies THIS frame (before paint), so there's no
    // one-frame teleport at the digit change — unlike a WAAPI animation, whose
    // first sample only lands next frame. And instead of resetting to -Δ (which
    // snaps away an in-flight glide), we read the element's CURRENT offset and
    // add -Δ to it — so rapid / multi-source changes (e.g. the ⓘ pushed by both
    // % and $) accumulate and blend instead of fighting.
    const parseTX = (t: string) => {
      const m = /matrix(?:3d)?\(([^)]+)\)/.exec(t)
      if (!m) return 0
      const p = m[1].split(',')
      return parseFloat(p.length === 16 ? p[12] : p[4]) || 0
    }
    const flip = (el: HTMLElement, d: number) => {
      const current = parseTX(getComputedStyle(el).transform)
      el.style.transition = 'none'
      el.style.transform = `translateX(${current - d}px)` // add -Δ to the in-flight offset
      void el.offsetWidth                                  // apply synchronously, before paint
      el.style.transition = `transform 900ms ${easing}`
      el.style.transform = 'translateX(0px)'               // glide back to rest
    }
    const observe = (
      src: Element | null,
      followers: ReadonlyArray<{ readonly current: HTMLElement | null }>,
    ) => {
      if (!src) return () => {}
      let lastW = -1
      const ro = new ResizeObserver(entries => {
        const w = entries[0].contentRect.width
        if (lastW < 0) { lastW = w; return } // prime
        const d = w - lastW
        lastW = w
        if (Math.abs(d) < 0.5) return
        for (const ref of followers) { if (ref.current) flip(ref.current, d) }
      })
      ro.observe(src)
      return () => ro.disconnect()
    }
    const cleanups = [
      observe(priceSrcRef.current, [pointsFlipRef, changeGroupFlipRef]), // price → points + whole change group (incl. ▲)
      observe(pctSrcRef.current, [dollarFlipRef, infoFlipRef]),          // %     → $ + ⓘ
      observe(dollarFlipRef.current, [infoFlipRef]),                     // $     → ⓘ
    ]
    return () => cleanups.forEach(c => c())
  }, [])

  const deduplicatedReleases = releases.filter(r => r.date || r.release_date)

  const isPositive = (displayChange ?? 0) >= 0
  const changeColor: SXColorToken | string = isPositive ? 'STPositive' : 'STChartNegative'

  return (
    <div className={`flex items-start justify-between pt-8 md:pt-6 pb-8 ${className}`}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-6">
          <div className="flex min-w-0 items-center gap-3 md:gap-5">
            {avatarHref ? (
              <a href={avatarHref} style={{ display: 'flex', flexShrink: 0 }}>
                {picture ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={supabaseImage(picture, 128)} alt={name} className="h-9 w-9 md:h-14 md:w-14 flex-shrink-0 select-none rounded-full object-cover" style={{ minWidth: '2.25rem', minHeight: '2.25rem' }} draggable={false} loading="lazy" />
                ) : (
                  <div className="h-9 w-9 md:h-14 md:w-14 flex-shrink-0 select-none rounded-full bg-zinc-700" />
                )}
              </a>
            ) : picture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={supabaseImage(picture, 128)} alt={name} className="h-9 w-9 md:h-14 md:w-14 flex-shrink-0 select-none rounded-full object-cover" style={{ minWidth: '2.25rem', minHeight: '2.25rem' }} draggable={false} loading="lazy" />
            ) : (
              <div className="h-9 w-9 md:h-14 md:w-14 flex-shrink-0 select-none rounded-full bg-zinc-700" />
            )}
            <h1 className="m-0 min-w-0 p-0">
              <span className="block truncate [&>span]:!select-text md:[&>span]:!text-[1.875rem]">
                <CSXText variant="title" color="STWhite">
                  {name}
                </CSXText>
              </span>
            </h1>
            <div className="flex flex-shrink-0 items-center gap-2.5" style={{ color: 'var(--st-secondary)' }}>
              {_id && (
                <a
                  href={`https://open.spotify.com/artist/${_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${name} on Spotify`}
                  className="flex-shrink-0 transition-colors hover:text-white"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                  </svg>
                </a>
              )}
              <a
                href={appleMusic || 'https://music.apple.com'}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open ${name} on Apple Music`}
                className="flex-shrink-0 transition-colors hover:text-white"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                  <path d="M23.994 6.124a9.23 9.23 0 0 0-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 0 0-1.877-.726 10.496 10.496 0 0 0-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026-.747.043-1.49.123-2.193.4-1.336.53-2.3 1.452-2.865 2.78-.192.448-.292.925-.363 1.408a10.61 10.61 0 0 0-.1 1.18c0 .032-.007.062-.01.093v12.223c.01.14.017.283.027.424.05.815.154 1.624.497 2.373.65 1.42 1.738 2.353 3.234 2.801.42.127.856.187 1.293.228.555.053 1.11.06 1.667.06h11.03a12.5 12.5 0 0 0 1.57-.1c.822-.106 1.596-.35 2.296-.81a5.046 5.046 0 0 0 1.88-2.207c.186-.42.293-.87.37-1.324.113-.675.138-1.358.137-2.04-.002-3.8 0-7.595-.003-11.393zm-6.423 3.99v5.712c0 .417-.058.827-.244 1.206-.29.59-.76.962-1.388 1.14-.35.1-.706.157-1.07.173-.95.045-1.773-.6-1.943-1.536a1.88 1.88 0 0 1 1.038-2.022c.323-.16.67-.25 1.018-.324.378-.082.758-.153 1.134-.24.274-.063.457-.23.51-.516a.904.904 0 0 0 .02-.193c0-1.815 0-3.63-.002-5.443a.725.725 0 0 0-.026-.185c-.04-.15-.15-.243-.304-.234-.16.01-.318.035-.475.066l-5.597 1.09c-.306.06-.43.197-.437.516v7.37c0 .38-.05.753-.203 1.103-.28.64-.77 1.04-1.434 1.233-.365.106-.742.16-1.123.18-.96.05-1.79-.593-1.96-1.53a1.88 1.88 0 0 1 1.048-2.025c.355-.177.735-.267 1.117-.344.27-.055.54-.102.808-.16.39-.084.594-.292.615-.696.004-.08 0-.16 0-.24V5.992c0-.564.15-.915.57-1.04 1.914-.568 3.83-1.132 5.744-1.697.582-.172 1.164-.345 1.746-.516.47-.14.69-.01.69.478v5.896z" />
                </svg>
              </a>
              <a
                href={youtube || 'https://www.youtube.com'}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open ${name} on YouTube`}
                className="flex-shrink-0 transition-colors hover:text-white"
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
        <NumberFlowGroup>
        <div className="flex flex-col gap-4 min-w-0 md:flex-row md:flex-wrap md:items-baseline md:gap-4">
          <div className="flex items-center gap-2">
            <span ref={priceSrcRef} style={{ display: 'inline-flex' }}>
              <AnimatedPrice
                value={currentPrice}
                fontSize={24}
                color="STWhite"
              />
            </span>
            <span ref={pointsFlipRef} style={{ display: 'inline-flex' }}>
              <CSXText variant="title" color="STWhite">points</CSXText>
            </span>
          </div>
          {displayChange != null && (
            <span ref={changeGroupFlipRef} style={{ display: 'inline-flex' }}>
            <div className="flex items-center gap-3 md:-translate-y-0.5">
              <div ref={pctSrcRef} className="flex items-center gap-1">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 18"
                  width="14"
                  height="14"
                  className="shrink-0"
                  style={{
                    color: `var(--${isPositive ? 'st-positive' : 'st-chart-negative'})`,
                    transform: `rotate(${isPositive ? '0deg' : '180deg'}) translateY(1px)`,
                  }}
                >
                  <path fill="currentColor" d="m12 0 10.392 14.25H1.608z" />
                </svg>
                <AnimatedPrice
                  value={Math.abs(displayChange)}
                  fontSize={14}
                  color={changeColor}
                  suffix="%"
                />
              </div>
              {displayRawChange != null && (
                <span ref={dollarFlipRef} style={{ display: 'inline-flex' }}>
                  <AnimatedPrice
                    value={Math.abs(displayRawChange)}
                    fontSize={14}
                    color={changeColor}
                    prefix={isPositive ? '+$' : '-$'}
                  />
                </span>
              )}
              <span ref={infoFlipRef} style={{ display: 'inline-flex' }}>
              <div className="group relative flex items-center" style={{ marginLeft: '0.125rem', transform: 'translateY(-0.0625rem)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#52525b', cursor: 'pointer', flexShrink: 0 }}>
                  <path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8" />
                </svg>
                <div
                  className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                  style={{
                    background: '#000000',
                    border: '1px solid #262626',
                    borderRadius: '0.375rem',
                    boxShadow: '0 0.5rem 2rem rgba(0,0,0,0.7)',
                    padding: '0.3125rem 0.5625rem',
                    whiteSpace: 'nowrap',
                    fontFamily: 'var(--font-geist-sans)',
                    fontSize: '0.6875rem',
                    color: '#a1a1aa',
                    zIndex: 30,
                  }}
                >
                  The Index is based on recent trading activity
                </div>
              </div>
              </span>
            </div>
            </span>
          )}
        </div>
        </NumberFlowGroup>
      </div>
      <div className="hidden flex-col items-end justify-between self-stretch lg:flex">
        {/* Action buttons — top right */}
        <div className="flex items-center gap-1">
          {/* Sort/filter */}
          {deduplicatedReleases.length > 0 && (
            <div className="relative" ref={settingsRef}>
              <button
                type="button"
                onClick={() => setSettingsOpen(v => !v)}
                className="bg-transparent rounded transition-colors hover:bg-zinc-800/50"
                style={{ color: 'white', border: 'none', cursor: 'pointer', padding: '0.375rem', display: 'flex', alignItems: 'center', transition: 'background-color 150ms, transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1)', transform: pressedBtn === 'filter' ? 'scale(0.88)' : 'scale(1)' }}
                aria-label="Filter releases"
                onPointerDown={() => setPressedBtn('filter')}
                onPointerUp={() => setPressedBtn(null)}
                onPointerLeave={() => setPressedBtn(null)}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                  <path d="M14 10H3v2h11zm0-4H3v2h11zm4 8v-4h-2v4h-4v2h4v4h2v-4h4v-2zM3 16h7v-2H3z" />
                </svg>
              </button>
              {settingsOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 0.5rem)',
                    right: '0rem',
                    width: '15rem',
                    background: '#000000',
                    border: '1px solid #262626',
                    borderRadius: '0.625rem',
                    boxShadow: '0 0.5rem 2rem rgba(0,0,0,0.7)',
                    zIndex: 20,
                    padding: '0.25rem 0',
                    opacity: settingsVisible ? 1 : 0,
                    transform: settingsVisible ? 'translateY(0)' : 'translateY(-4px)',
                    transition: 'opacity 80ms ease, transform 80ms ease',
                    willChange: 'opacity, transform',
                  }}
                >
                  <div style={{ padding: '0.25rem 0.875rem 0.375rem', borderBottom: '1px solid #1f1f1f', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const allHidden = deduplicatedReleases.every(r => hiddenReleaseIds.includes(r.id))
                        deduplicatedReleases.forEach(r => {
                          const isHidden = hiddenReleaseIds.includes(r.id)
                          if (allHidden ? isHidden : !isHidden) onToggleRelease?.(r.id)
                        })
                      }}
                      style={{ fontFamily: 'var(--font-geist-sans)', fontSize: '0.6875rem', color: 'var(--st-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0rem' }}
                      className="hover:opacity-70 transition-opacity"
                    >
                      {deduplicatedReleases.every(r => hiddenReleaseIds.includes(r.id)) ? 'Select all' : 'Deselect all'}
                    </button>
                  </div>
                  <div style={{ maxHeight: '15rem', overflowY: 'auto' }}>
                    {deduplicatedReleases.map((r, i) => {
                      const isVisible = !hiddenReleaseIds.includes(r.id)
                      const dotColor = RELEASE_COLORS[i % RELEASE_COLORS.length]
                      return (
                        <button key={r.id} type="button" onClick={() => onToggleRelease?.(r.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', width: '100%', padding: '0.4375rem 0.875rem', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                          className="hover:bg-zinc-900 transition-colors"
                        >
                          <span style={{ width: '0.875rem', height: '0.875rem', borderRadius: '0.25rem', border: `1.5px solid ${isVisible ? '#3b82f6' : '#3f3f46'}`, background: isVisible ? '#3b82f6' : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s, border-color 0.15s' }}>
                            {isVisible && <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M1.5 4.5L3.5 6.5L7.5 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                          </span>
                          {r.image
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={r.image} alt="" width={14} height={14} style={{ borderRadius: '50%', flexShrink: 0, opacity: isVisible ? 1 : 0.35 }} loading="lazy" />
                            : <span style={{ width: '0.5rem', height: '0.5rem', borderRadius: '50%', background: dotColor, flexShrink: 0, opacity: isVisible ? 1 : 0.35 }} />
                          }
                          <span style={{ fontFamily: 'var(--font-geist-sans)', fontSize: '0.75rem', color: isVisible ? 'var(--st-white)' : 'var(--st-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: '0rem', flex: 1, transition: 'color 0.15s' }}>
                            {r.name}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Share — opens native share sheet on mobile, copies URL on desktop. */}
          <SXShareButton ticker={_id} name={name} />
        </div>

        {/* LIVE indicator */}
        <style>{`@keyframes livePulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3125rem', marginTop: '0.75rem', marginBottom: '0.75rem' }}>
          <span style={{ width: '0.25rem', height: '0.25rem', borderRadius: '50%', backgroundColor: 'var(--st-chart-positive)', display: 'inline-block', animation: 'livePulse 1.5s ease-in-out infinite', flexShrink: 0 }} />
          <span style={{ fontSize: '0.5rem', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--st-chart-positive)', fontFamily: 'var(--font-inter)', lineHeight: 1 }}>LIVE</span>
        </div>
      </div>
    </div>
  )
}
