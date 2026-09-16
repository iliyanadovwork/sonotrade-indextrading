'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { SXPriceChartWidget, AnimatedPrice } from '@/components/sx/SXPriceChartWidget'
import { Link } from '@/components/ui/Link'
import { CSXText } from '@/components/sx/core/CSXText'
import { CSXInfoChip } from '@/components/sx/core/CSXInfoChip'
import { TrendArrow } from '@/components/sx/core/TrendArrow'
import { fmtVolumeUSD, deriveShortName, deriveTicker, fmtIndexPrice } from '@/lib/format'
import { HeroImageLayers } from '@/components/sx/HeroImageLayers'
import { decodeHtml } from '@/lib/decodeHtml'
import { preloadImage } from '@/lib/imageCache'
import { type SlideProfile, SLIDE_CONFIGS, useTopGainerSlides } from '@/components/sx/useSXTopGainerSlides'
import { useIsMobile } from '@/lib/useIsMobile'
import { useProfilePanel } from '@/context/ProfilePanelContext'
import { supabaseImage } from '@/lib/supabaseImage'
import { usePageVisible } from '@/lib/hooks/usePageVisible'

// SLIDE_CONFIGS, SlideProfile, and data-fetching are in useSXTopGainerSlides.ts


const TOTAL_SLIDES = SLIDE_CONFIGS.length * 2

function getSlideInfo(slide: number): { artistIndex: number; type: 'image' | 'chart' } {
  return { artistIndex: Math.floor(slide / 2), type: slide % 2 === 0 ? 'image' : 'chart' }
}

export const BULLET_ICONS: Record<string, React.ReactElement> = {
  'Highest 1M return': (
    <svg width="12" height="12" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="8" stroke="#a1a1aa" strokeWidth="1.5" />
      <path d="M10 5v5l3 3" stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  'Strong momentum signal': (
    <svg width="12" height="12" viewBox="0 0 20 20" fill="none" style={{ display: 'block' }}>
      <ellipse cx="10" cy="10" rx="7" ry="4" stroke="#a1a1aa" strokeWidth="1.5" fill="none" />
      <circle cx="10" cy="10" r="2" fill="#a1a1aa" />
    </svg>
  ),
  'Highest index value': (
    <svg width="12" height="12" viewBox="0 0 20 20" fill="none">
      <path d="M10 2v16M10 2l5 5M10 2l-5 5" stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  'Blue-chip Index': (
    <svg width="12" height="12" viewBox="0 0 20 20" fill="none">
      <polygon points="10,2 12.9,7.6 19,8.6 14.5,13 15.6,19 10,16.1 4.4,19 5.5,13 1,8.6 7.1,7.6" stroke="#a1a1aa" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
    </svg>
  ),
  'Highest trading activity': (
    <svg width="12" height="12" viewBox="0 0 20 20" fill="none">
      <rect x="3" y="10" width="3" height="7" rx="1" fill="#a1a1aa" />
      <rect x="8.5" y="6" width="3" height="11" rx="1" fill="#a1a1aa" />
      <rect x="14" y="3" width="3" height="14" rx="1" fill="#a1a1aa" />
    </svg>
  ),
  'Deep liquidity pool': (
    <svg width="12" height="12" viewBox="0 0 20 20" fill="none">
      <path d="M3 14 Q6 10 10 14 Q14 18 17 14" stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M3 9 Q6 5 10 9 Q14 13 17 9" stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  ),
  'Largest 1M pullback': (
    <svg width="12" height="12" viewBox="0 0 20 20" fill="none">
      <path d="M10 18V2M10 18l-5-5M10 18l5-5" stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  'Potential mean reversion': (
    <svg width="12" height="12" viewBox="0 0 20 20" fill="none">
      <path d="M3 15 Q7 5 10 10 Q13 15 17 5" stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  ),
  'Highest 1Y return': (
    <svg width="12" height="12" viewBox="0 0 20 20" fill="none">
      <path d="M3 13 L7 9 L11 11 L17 5" stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 5h3v3" stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  'Sustained growth trend': (
    <svg width="12" height="12" viewBox="0 0 20 20" fill="none">
      <path d="M3 17 L17 3" stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2 2" />
    </svg>
  ),
  'Best 7-day performer': (
    <svg width="12" height="12" viewBox="0 0 20 20" fill="none">
      <path d="M10 2v16M10 2l5 5M10 2l-5 5" stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  'Breakout momentum': (
    <svg width="12" height="12" viewBox="0 0 20 20" fill="none" style={{ display: 'block' }}>
      <ellipse cx="10" cy="10" rx="7" ry="4" stroke="#a1a1aa" strokeWidth="1.5" fill="none" />
      <circle cx="10" cy="10" r="2" fill="#a1a1aa" />
    </svg>
  ),
  'Top monthly performer': (
    <svg width="12" height="12" viewBox="0 0 20 20" fill="none">
      <path d="M3 13 L7 9 L11 11 L17 5" stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="17" cy="5" r="2" fill="#a1a1aa" />
    </svg>
  ),
  'Market leader': (
    <svg width="12" height="12" viewBox="0 0 20 20" fill="none">
      <path d="M10 3l2.4 4.8L18 8.7l-4 3.9.9 5.4L10 15.4l-4.9 2.6.9-5.4L2 8.7l5.6-.9z" stroke="#a1a1aa" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
    </svg>
  ),
  'High market interest': (
    <svg width="12" height="12" viewBox="0 0 20 20" fill="none">
      <path d="M3 10 Q6 4 10 10 Q14 16 17 10" stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <circle cx="10" cy="10" r="2" fill="#a1a1aa" />
    </svg>
  ),
  'Discounted entry point': (
    <svg width="12" height="12" viewBox="0 0 20 20" fill="none">
      <path d="M10 3v14M6 14l4 3 4-3" stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  'Long-term outperformer': (
    <svg width="12" height="12" viewBox="0 0 20 20" fill="none">
      <path d="M3 15 L8 9 L12 12 L17 4" stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 4h3v3" stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  'Short-term strength': (
    <svg width="12" height="12" viewBox="0 0 20 20" fill="none">
      <path d="M4 10h4l2-5 2 10 2-5h4" stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
}

const DEFAULT_BULLET_ICON = (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
    <circle cx="5" cy="5" r="1.5" fill="#a1a1aa" />
  </svg>
)

/* Module scope, NOT inside the component body: an inline definition creates a
   new component type every render, so React unmounted and remounted this
   subtree on each 5s autoplay tick. Slide state comes in as props instead. */
function NavArrows({ step = 1, slideIndex, artistIndex, navigate }: {
  step?: number
  slideIndex: number
  artistIndex: number
  navigate: (slide: number, dir: 1 | -1) => void
}) {
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
      onClick={e => e.stopPropagation()}
    >
      <button
        aria-label="Previous"
        onClick={() => navigate((slideIndex - step + TOTAL_SLIDES) % TOTAL_SLIDES, -1)}
        className="hover:bg-zinc-800 transition-colors"
        style={{ cursor: 'pointer', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.4)', borderRadius: '50%', padding: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a1a1aa' }}
      >
        <svg viewBox="0 0 24 24" width={12.6} height={12.6} fill="currentColor">
          <path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
        </svg>
      </button>
      <div
        style={{
          minWidth: '2.75rem',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1,
        }}
      >
        <CSXText
          variant="chipLabelPill"
          color="rgba(255,255,255,0.45)"
          style={{ fontSize: '0.6875rem' }}
        >
          {artistIndex + 1} of {SLIDE_CONFIGS.length}
        </CSXText>
      </div>
      <button
        aria-label="Next"
        onClick={() => navigate((slideIndex + step) % TOTAL_SLIDES, 1)}
        className="hover:bg-zinc-800 transition-colors"
        style={{ cursor: 'pointer', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.4)', borderRadius: '50%', padding: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a1a1aa' }}
      >
        <svg viewBox="0 0 24 24" width={12.6} height={12.6} fill="currentColor">
          <path d="M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
        </svg>
      </button>
    </div>
  )
}




function FadeInImage({ src, alt, priority }: { src: string; alt: string; priority?: boolean }) {
  const ref = useRef<HTMLImageElement>(null)
  const [loaded, setLoaded] = useState(priority ?? false)
  // Track whether the image was already available at mount — if so, no fade-in animation
  const [animate, setAnimate] = useState(false)

  // useLayoutEffect runs before paint — avoids a 1-frame flash for cached images
  React.useLayoutEffect(() => {
    if (!loaded && ref.current?.complete && ref.current.naturalWidth > 0) {
      setLoaded(true) // cached: show immediately, no animation
    }
  }, [src]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="absolute inset-0"
      style={{
        opacity: loaded ? undefined : 0,
        animation: animate ? 'gallery-fade-in 0.7s ease forwards' : 'none',
      }}
    >
      <HeroImageLayers
        src={src}
        alt={alt}
        foregroundRef={ref}
        fetchPriority={priority ? 'high' : undefined}
        onForegroundLoad={() => { setLoaded(true); setAnimate(true) }}
      />
    </div>
  )
}

// Worm page-indicator geometry, matching the Expo FeaturedCarousel exactly:
// 5px dots, 5px gaps (10px stride), pill peaking at 15px mid-transition.
const WORM_DOT = 5
const WORM_STRIDE = 10
/** Finger travel (px) for a full fade when pulling past the last slide. */
const WRAP_PULL_RANGE = 140
// NOTE: TrendArrow is the shared @/components/sx/core/TrendArrow now — the
// local copy this file used to carry was deduped upstream (b9ce5d0).

function LocationIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, flexShrink: 0 }}>
      <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, flexShrink: 0 }}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

// Deterministic holder count fallback (mirrors SXGallerySlideshow on /discover)
// so the slideshow always shows a holders figure even when the DB column is null.
function holderCount(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = ((h * 31 + name.charCodeAt(i)) >>> 0)
  return 42 + (h % 900)
}

// Hero image slides prefer the first gallery image (same source as the
// artist-page banner); spotify_img is the fallback. The small round avatar
// on the chart slide intentionally keeps image_url.
function heroImage(p: SlideProfile | null | undefined): string | null {
  return p?.gallery_image || p?.image_url || null
}

export function SXTopGainerWidget({ initialHeroProfile = null }: { initialHeroProfile?: SlideProfile | null } = {}) {
  const router = useRouter()
  const isMobile = useIsMobile()
  const { openProfile } = useProfilePanel()
  // initialHeroProfile (server-fetched slide 0) seeds the hook so the LCP
  // image is in the SSR markup + paints on first paint. The hook still runs
  // its client fetch to populate slides 1-6 and enrich slide 0.
  const { profiles, chartHistories } = useTopGainerSlides(initialHeroProfile)

  // Preload all slide images as soon as profile data arrives
  useEffect(() => {
    profiles.forEach(p => { const url = heroImage(p); if (url) preloadImage(url) })
  }, [profiles])

  // On mobile, only image slides (even indices). Start at 0 always.
  const [slideIndex, setSlideIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  // Mobile paged strip (real finger-tracked paging). The strip is a native
  // scroll-snap scroller; the worm pill is driven CONTINUOUSLY from scrollLeft
  // (the same relationship as Expo's scrollX.interpolate), so the elastic
  // stretch is visible mid-drag, under the finger — not replayed afterwards.
  const stripRef = useRef<HTMLDivElement | null>(null)
  const wormPillRef = useRef<HTMLDivElement | null>(null)
  const stripSettleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Swipe-past-the-end wrap: snapshot of the gesture (start X, whether the
  // strip was already at its max scroll) — finger-tracked, not scroll-tracked,
  // because Chromium clamps scrollLeft at the edge while iOS rubber-bands.
  const wrapGestureRef = useRef<{ x: number; atEnd: boolean; atStart: boolean; dx: number } | null>(null)
  // True while a finger is on the strip. The snap-settle sync MUST NOT run
  // during this window: holding a drag between two slides stops scroll events,
  // the settle timer fires, and the follow effect would smooth-scroll the strip
  // out from under the held finger.
  const touchActiveRef = useRef(false)
  // Bumped every time the strip LANDS on a snap point. It participates in the
  // autoplay effect's deps, so each landing recreates the interval — i.e. the
  // countdown always starts from when motion stopped, not from the last tick.
  const [countdownEpoch, setCountdownEpoch] = useState(0)
  // While a long-jump fade is in flight, the snap-settle sync must not read the
  // in-between scroll positions and "correct" slideIndex back — that would undo
  // the wrap the moment the rubber-band releases.
  const stripFadeTargetRef = useRef<number | null>(null)
  const pageVisible = usePageVisible()
  const [direction, setDirection] = useState<1 | -1>(1)
  const [hoveredPrice, setHoveredPrice] = useState<number | null>(null)
  const [prevImageUrl, setPrevImageUrl] = useState<string | null>(null)
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [leavingImageUrl, setLeavingImageUrl] = useState<string | null>(null)
  const leavingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevSlideTypeRef = useRef<'image' | 'chart' | null>(null)
  const prevArtistIndexRef = useRef<number>(0)

  // On mobile snap to nearest image slide when switching modes
  useEffect(() => {
    if (isMobile && slideIndex % 2 !== 0) setSlideIndex(i => i % 2 !== 0 ? i - 1 : i)
  }, [isMobile]) // slideIndex intentionally omitted — functional update avoids stale closure

  function navigate(next: number, dir: 1 | -1) {
    const prevInfo = getSlideInfo(slideIndex)
    const nextInfo = getSlideInfo(next)
    if (prevInfo.type === 'image' && nextInfo.type === 'image') {
      setPrevImageUrl(heroImage(profiles[prevInfo.artistIndex]))
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
      fadeTimerRef.current = setTimeout(() => setPrevImageUrl(null), 700)
    } else {
      setPrevImageUrl(null)
    }
    // Preload the slide after next so it's ready before the user swipes again
    const step = isMobile ? 2 : 1
    const afterNext = (next + step) % TOTAL_SLIDES
    const afterNextInfo = getSlideInfo(afterNext)
    const url = heroImage(profiles[afterNextInfo.artistIndex])
    if (url) preloadImage(url)
    setDirection(dir)
    setSlideIndex(next)
    setHoveredPrice(null)
  }

  useEffect(() => {
    if (paused || !pageVisible) return
    const step = isMobile ? 2 : 1
    const id = setInterval(() => {
      // Mid-drag guard (see the settle handler): if the strip is off a snap
      // point, a held gesture owns it — skip this tick rather than yank it.
      if (isMobile) {
        const el = stripRef.current
        if (el) {
          const w = el.clientWidth || 1
          if (Math.abs(el.scrollLeft - Math.round(el.scrollLeft / w) * w) > 2) return
        }
      }
      setDirection(1)
      setSlideIndex(i => (i + step) % TOTAL_SLIDES)
    }, isMobile ? 3500 : 7000)  // mobile matches the Expo carousel's cadence
    return () => clearInterval(id)
  }, [paused, isMobile, pageVisible, countdownEpoch])

  const { artistIndex, type } = getSlideInfo(slideIndex)
  const cfg = SLIDE_CONFIGS[artistIndex]
  const top = profiles[artistIndex]

  // Fade-out when leaving an image slide
  useEffect(() => {
    const prevType = prevSlideTypeRef.current
    const prevIdx = prevArtistIndexRef.current
    prevSlideTypeRef.current = type
    prevArtistIndexRef.current = artistIndex
    if (prevType === 'image' && type === 'chart') {
      const url = heroImage(profiles[prevIdx])
      if (url) {
        setLeavingImageUrl(url)
        if (leavingTimerRef.current) clearTimeout(leavingTimerRef.current)
        leavingTimerRef.current = setTimeout(() => setLeavingImageUrl(null), 250)
      }
    }
  }, [slideIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  const isLoading = top === null

  // Chart slide derived state
  const change1w = top?.change_1w ?? 0
  const rawHistory = top?.id ? (chartHistories[top.id] ?? []) : []
  const chartHistory = rawHistory.length === 0 && top?.index_price != null
    ? [{ price: top.index_price, timestamp: Date.now() - 1000 }, { price: top.index_price, timestamp: Date.now() }]
    : rawHistory
  const currentPrice = chartHistory.length > 0 ? chartHistory[chartHistory.length - 1].price : (top?.index_price ?? 0)
  const isUp = change1w >= 0
  const color = isUp ? 'var(--st-chart-positive)' : 'var(--st-chart-negative)'

  const stats = [
    { label: 'Index', value: fmtIndexPrice(top?.index_price ?? 0) },
    { label: 'Total Forecasts', value: fmtVolumeUSD(top?.volume ?? null) },
    { label: 'Holders', value: top?.holders != null ? top.holders.toLocaleString('en-US') : '-' },
    { label: 'Listed', value: top?.listed_at ? new Date(top.listed_at).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '-' },
  ]

  // Image slide derived state
  const bioDecoded = top?.bio ? decodeHtml(top.bio) : ''
  const bio = bioDecoded ? (bioDecoded.length > 200 ? bioDecoded.slice(0, 197) + '…' : bioDecoded) : null
  const sinceYear = top?.info_active_since ? new Date(top.info_active_since).getFullYear() : null
  // The wrap fade must be the ONLY thing that happens when pulling forward on
  // the last slide — the card must not shift. overscroll-behavior handles the
  // engines that honor it; this native listener is the guarantee: React's root
  // touch handlers are passive (preventDefault is a no-op there), so a real
  // non-passive listener cancels the pan before the bounce can begin.
  useEffect(() => {
    if (!isMobile) return
    const el = stripRef.current
    if (!el) return
    const onMove = (e: TouchEvent) => {
      const g = wrapGestureRef.current
      if (!g) return
      const dx = (e.touches[0]?.clientX ?? 0) - g.x
      // Suppress the native pan for the two nowhere-to-scroll pulls, so the
      // fade is the only affordance at both edges.
      if ((g.atEnd && dx < 0) || (g.atStart && dx > 0)) e.preventDefault()
    }
    el.addEventListener('touchmove', onMove, { passive: false })
    return () => el.removeEventListener('touchmove', onMove)
  }, [isMobile, isLoading])

  // Continuous worm: piecewise-linear left/width from fractional page position.
  // frac<=0.5 stretches the leading edge (left anchored); frac>0.5 the trailing
  // edge catches up — identical breakpoints to the Expo inputRange midpoints.
  const updateWorm = () => {
    const el = stripRef.current, pill = wormPillRef.current
    if (!el || !pill) return
    const w = el.clientWidth || 1
    const t = Math.min(Math.max(el.scrollLeft / w, 0), SLIDE_CONFIGS.length - 1)
    const k = Math.floor(t), frac = t - k
    const stretch = frac <= 0.5 ? frac * 2 : (1 - frac) * 2
    pill.style.left = `${(frac <= 0.5 ? k : k + (frac - 0.5) * 2) * WORM_STRIDE}px`
    pill.style.width = `${WORM_DOT + stretch * WORM_STRIDE}px`
  }
  const onStripScroll = () => {
    updateWorm()
    if (stripSettleTimer.current) clearTimeout(stripSettleTimer.current)
    stripSettleTimer.current = setTimeout(() => {
      if (touchActiveRef.current) return  // finger down — the gesture owns the strip
      const el = stripRef.current
      if (!el) return
      const w = el.clientWidth || 1
      // ALIGNMENT GUARD — the load-bearing check for real iOS. Once the native
      // scroller takes over a pan, iOS fires touchcancel immediately, so touch
      // state cannot tell a held drag from a finished one. But a held drag is,
      // by definition, parked BETWEEN snap points: if we're not on a page
      // boundary, some gesture still owns the strip — do nothing. The native
      // snap guarantees a landing (and fresh scroll events) on release.
      if (Math.abs(el.scrollLeft - Math.round(el.scrollLeft / w) * w) > 2) return
      const ft = stripFadeTargetRef.current
      if (ft != null) {
        if (Math.abs(el.scrollLeft - ft) <= 2) stripFadeTargetRef.current = null
        return
      }
      setCountdownEpoch(e => e + 1)  // landed — restart the autoplay countdown
      const page = Math.round(el.scrollLeft / w)
      const target = (((page % SLIDE_CONFIGS.length) + SLIDE_CONFIGS.length) % SLIDE_CONFIGS.length) * 2
      if (target !== slideIndex) { setDirection(target > slideIndex ? 1 : -1); setSlideIndex(target) }
    }, 90)
  }
  // slideIndex is the single source of truth (autoplay interval, dots, arrows
  // all mutate it); the strip follows it with a smooth scroll, which also
  // animates the worm via the scroll events above.
  useEffect(() => {
    if (!isMobile) return
    const el = stripRef.current
    if (!el) return
    const w = el.clientWidth || 1
    const target = artistIndex * w
    if (Math.abs(el.scrollLeft - target) <= 2) { updateWorm(); return }
    if (Math.abs(Math.round(el.scrollLeft / w) - artistIndex) > 1) {
      // Long jump (autoplay wrap, distant dot): FADE across the switch instead
      // of letting the scroller rush back over every slide. The instant
      // scrollTo lands at the fade's midpoint, while both the card and the
      // worm pill are invisible — so the pill fades out on the old dot and
      // fades in on the new one (the scroll event repositions it while hidden).
      const FADE = [{ opacity: 1 }, { opacity: 0, offset: 0.45 }, { opacity: 0, offset: 0.55 }, { opacity: 1 }]
      stripFadeTargetRef.current = target
      el.animate(FADE, { duration: 360, easing: 'ease-in-out' })
      wormPillRef.current?.animate(FADE, { duration: 360, easing: 'ease-in-out' })
      setTimeout(() => el.scrollTo({ left: target, behavior: 'auto' }), 170)
    } else {
      stripFadeTargetRef.current = null
      el.scrollTo({ left: target, behavior: 'smooth' })
    }
  }, [artistIndex, isMobile, isLoading])

  const isPositiveDay = (top?.change_1d ?? 0) >= 0

  const slideAnim = direction === 1
    ? 'sxSlideInRight 0.4s cubic-bezier(0.4,0,0.2,1) forwards'
    : 'sxSlideInLeft 0.4s cubic-bezier(0.4,0,0.2,1) forwards'

  return (
    <>
      <style>{`
        @keyframes sxSlideInRight { from { transform: translateX(32px);  opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes sxSlideInLeft  { from { transform: translateX(-32px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes livePulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes gallery-fade-in  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes gallery-fade-out { from { opacity: 1; } to { opacity: 0; } }
      `}</style>
      <div
        className="h-[26.25rem] md:h-auto rounded-none md:rounded-2xl border-0"
        style={{ position: 'relative', width: '100%', background: '#131313', overflow: 'hidden' }}
        // Desktop-only: on touch devices the tap-synthesized mouseenter would
        // set paused=true with no mouseleave ever following — permanently
        // stopping autoplay after the first touch. Mobile pause/reset is
        // handled by the touch handlers on the strip wrapper below.
        onMouseEnter={() => { if (!isMobile) setPaused(true) }}
        onMouseLeave={() => { if (!isMobile) setPaused(false) }}
      >
        {/* ── Chart slide — always in DOM to maintain container height; hidden on mobile ── */}
        <div style={{ visibility: (type === 'chart' && !isMobile) ? 'visible' : 'hidden' }}>
          <div style={{ display: 'flex', flexDirection: 'row', width: '100%' }}>
            {/* Left panel */}
            <div style={{ flex: '0 0 30%', minWidth: '0rem', borderRight: '1px solid #222222', padding: '1.25rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflow: 'hidden' }}>
              <div key={`left-${slideIndex}`} style={{ animation: type === 'chart' ? slideAnim : 'none', display: 'flex', flexDirection: 'column', gap: '0rem', flex: 1, justifyContent: 'space-between' }}>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <Link href={top?.id ? `/artist/${encodeURIComponent(top.id)}` : '#'} prefetch={false} className="shrink-0">
                      {isLoading ? (
                        <div style={{ width: '4rem', height: '4rem', borderRadius: '62.5rem', background: '#1a1a1a' }} className="animate-pulse" />
                      ) : top?.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={supabaseImage(top.image_url, 128)} alt={top.name} style={{ width: '4rem', height: '4rem', objectFit: 'cover', objectPosition: 'center', borderRadius: '62.5rem' }} />
                      ) : (
                        <div style={{ width: '4rem', height: '4rem', borderRadius: '62.5rem', background: '#1a1a1a' }} />
                      )}
                    </Link>
                    <div className="flex flex-col gap-0.5 min-w-0">
                      {isLoading ? (
                        <div className="h-[1.25rem] mb-[0.125rem] mt-[0.125rem] w-28 rounded bg-zinc-800 animate-pulse" />
                      ) : (
                        <div className="flex items-center gap-2 min-w-0">
                          <Link href={top?.id ? `/artist/${encodeURIComponent(top.id)}` : '#'} prefetch={false} className="truncate min-w-0 hover:opacity-70 transition-opacity">
                            <CSXText variant="title" color="STWhite">{top?.name}</CSXText>
                          </Link>
                        </div>
                      )}
                      <CSXText variant="body2" color="STSecondary">{cfg.badge}</CSXText>
                    </div>
                  </div>
                  {bio && (
                    <div
                      style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 4,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        lineHeight: 1.5,
                      }}
                    >
                      <CSXText variant="body2" color="STSecondary">{bio}</CSXText>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  {cfg.bullets.map((label, i) => (
                    <div key={i} className="flex items-center gap-2">
                      {BULLET_ICONS[label] ?? DEFAULT_BULLET_ICON}
                      <CSXText variant="body3" color="STSecondary">{label}</CSXText>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-6" style={{ border: '1px solid #333333', borderRadius: '0.5rem', padding: '0.75rem 0.875rem', marginTop: '0.25rem', marginBottom: '0.5rem' }}>
                  {[
                    { label: '1D', value: top?.change_1d },
                    { label: '1W', value: top?.change_1w },
                    { label: '1M', value: top?.change_1m },
                  ].map(({ label, value }) => {
                    const up = (value ?? 0) >= 0
                    return (
                      <div key={label} className="flex flex-col gap-2">
                        <CSXText variant="body2" color="STMuted">{label}</CSXText>
                        {isLoading ? (
                          <div className="h-3 w-10 rounded bg-zinc-800 animate-pulse" />
                        ) : value == null ? (
                          <CSXText variant="cardPriceChange" color="STMuted">—</CSXText>
                        ) : (
                          <CSXText
                            variant="cardPriceChange"
                            color={up ? 'STPositive' : 'var(--st-chart-negative)'}
                            style={{ fontVariantNumeric: 'tabular-nums' }}
                          >
                            {value >= 0 ? '+' : '-'}{Math.abs(value).toFixed(1)}%
                          </CSXText>
                        )}
                      </div>
                    )
                  })}
                </div>

                <div className="flex flex-col" style={{ marginTop: '-0.5rem', marginBottom: '-0.5rem' }}>
                  {stats.map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between py-1">
                      <CSXText variant="body2" color="STSecondary">{label}</CSXText>
                      {isLoading ? (
                        <div className="h-3 w-12 rounded bg-zinc-800 animate-pulse" />
                      ) : (
                        <CSXText variant="body2" color="STSecondary" style={{ fontFamily: 'var(--font-inter)' }}>
                          {value}
                        </CSXText>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right panel — chart */}
            <div style={{ flex: '0 0 70%', minWidth: '0rem', display: 'flex', flexDirection: 'column', minHeight: '0rem', padding: '1.25rem 1.25rem 0.875rem 1.25rem', overflow: 'hidden' }}>
              <div key={`right-${slideIndex}`} style={{ animation: type === 'chart' ? slideAnim : 'none', display: 'flex', flexDirection: 'column', flex: 1, minHeight: '0rem' }}>
                <div className="flex items-start justify-between" style={{ marginBottom: '0.5rem', paddingBottom: '0.625rem', borderBottom: '1px solid #222222', marginLeft: '-1.25rem', marginRight: '-1.25rem', paddingLeft: '1.25rem', paddingRight: '1.25rem' }}>
                  <div className="flex flex-col gap-0.5">
                    <CSXText variant="cardPrice" color="STWhite" style={{ fontFamily: 'var(--font-inter)' }}>
                      {isLoading ? '——' : deriveTicker(top?.name ?? '')}
                    </CSXText>
                    <CSXText variant="body2" color="STSecondary">
                      {isLoading ? '——' : deriveShortName(top?.name ?? '')}
                    </CSXText>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <AnimatedPrice value={hoveredPrice ?? currentPrice} fontSize={18} color={isLoading ? 'STBorderStrong' : 'STWhite'} />
                    <CSXText
                      variant="cardPriceChange"
                      color={
                        isLoading
                          ? 'STBorderStrong'
                          : top?.change_1w != null && top.change_1w < 0
                            ? 'var(--st-chart-negative)'
                            : 'STPositive'
                      }
                      style={{ fontFamily: 'var(--font-inter)' }}
                    >
                      {(top?.change_1w ?? 0) >= 0 ? '+' : '-'}{Math.abs(top?.change_1w ?? 0).toFixed(1)}%
                    </CSXText>
                  </div>
                </div>

                {!isLoading && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3125rem', marginTop: '0.75rem', marginBottom: '0.75rem' }}>
                    <span style={{ width: '0.25rem', height: '0.25rem', borderRadius: '50%', backgroundColor: 'var(--st-chart-positive)', display: 'inline-block', animation: 'livePulse 1.5s ease-in-out infinite', flexShrink: 0 }} />
                    <CSXText variant="chipLabel" color="STPositive" style={{ lineHeight: 1 }}>LIVE</CSXText>
                  </div>
                )}

                <div style={{ marginBottom: '0rem', position: 'relative' }}>
                  {type === 'chart'
                    ? <SXPriceChartWidget data={chartHistory} height={288} initialPeriod="ALL" onHoverValueChange={setHoveredPrice} forceColor={color} />
                    : <div style={{ height: '20rem' }} />
                  }
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Leaving image slide — fade out when transitioning to chart ── */}
        {leavingImageUrl && type === 'chart' && (
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', animation: 'gallery-fade-out 0.25s ease forwards', zIndex: 1 }}>
            <HeroImageLayers src={leavingImageUrl} alt="" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.4) 55%, rgba(0,0,0,0.05) 100%)' }} />
          </div>
        )}

        {/* ── Previous image — stays in place and fades out during image-to-image transition ── */}
        {prevImageUrl && type === 'image' && (
          <div key={`leaving-${prevImageUrl}`} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', animation: 'gallery-fade-out 0.7s ease forwards', zIndex: 1 }}>
            <HeroImageLayers src={prevImageUrl} alt="" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.4) 55%, rgba(0,0,0,0.05) 100%)' }} />
          </div>
        )}

        {/* ── Image slide — absolutely overlays the chart slide ── */}
        {!isMobile && type === 'image' && (
          <div
            key={`image-${slideIndex}`}
            style={{ position: 'absolute', inset: 0, cursor: 'pointer', animation: slideAnim, zIndex: 2 }}
            onClick={() => top?.id && (isMobile ? openProfile(top.id) : router.push(`/artist/${encodeURIComponent(top.id)}`))}
          >
            {/* Incoming image */}
            {heroImage(top) ? (
              <FadeInImage key={heroImage(top)!} src={heroImage(top)!} alt={top?.name ?? ''} priority={artistIndex === 0} />
            ) : (
              <div className="absolute inset-0" style={{ background: '#0D0D0D' }} />
            )}

            {/* Gradient overlay — only rendered once image data is available */}
            {!isLoading && (
              <div style={{ position: 'absolute', top: '0rem', left: '0rem', right: '0rem', bottom: '-0.0625rem', background: isMobile
                ? 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.5) 45%, rgba(0,0,0,0.0) 100%)'
                : 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.4) 55%, rgba(0,0,0,0.05) 100%)'
              }} />
            )}

            {/* Industry pill — top left */}
            {top?.industry && (
              <div style={{ position: 'absolute', top: isMobile ? 12 : 20, left: isMobile ? 12 : 24, zIndex: 10 }}>
                <CSXInfoChip variant="artistCard">
                  <CSXText variant="chipLabelNormal" color="STForeground">{top.industry}</CSXText>
                </CSXInfoChip>
              </div>
            )}

            {/* Navigation arrows — top right */}
            <div style={{ position: 'absolute', top: isMobile ? 4 : 16, right: isMobile ? 4 : 16, zIndex: 10, padding: isMobile ? 8 : 0 }} onClick={e => e.stopPropagation()}>
              <NavArrows step={2} slideIndex={slideIndex} artistIndex={artistIndex} navigate={navigate} />
            </div>

            {/* Bottom content — desktop only */}
            {!isMobile && (
              <div className="absolute inset-0 flex flex-col justify-end" style={{ padding: '1.25rem 1.5rem', gap: '0.5rem' }}>
                {isLoading ? (
                  <>
                    {/* Ticker + name skeleton */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                      <div className="animate-pulse rounded" style={{ height: '1.625rem', width: '5rem', background: '#1f1f1f' }} />
                      <div className="animate-pulse rounded" style={{ height: '0.875rem', width: '7.5rem', background: '#1a1a1a' }} />
                      <div className="animate-pulse rounded" style={{ height: '0.875rem', width: '3.5rem', background: '#1a1a1a' }} />
                    </div>
                    {/* Bio skeleton */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3125rem' }}>
                      <div className="animate-pulse rounded" style={{ height: '0.6875rem', width: '26.25rem', background: '#1a1a1a' }} />
                      <div className="animate-pulse rounded" style={{ height: '0.6875rem', width: '20rem', background: '#1a1a1a' }} />
                    </div>
                    {/* Meta tags skeleton */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                      <div className="animate-pulse rounded" style={{ height: '0.6875rem', width: '5rem', background: '#1a1a1a' }} />
                      <div className="animate-pulse rounded" style={{ height: '0.6875rem', width: '3.75rem', background: '#1a1a1a' }} />
                      <div className="animate-pulse rounded" style={{ height: '0.6875rem', width: '4.375rem', background: '#1a1a1a' }} />
                    </div>
                    {/* Dot indicators skeleton */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', paddingTop: '0.125rem' }}>
                      {Array.from({ length: SLIDE_CONFIGS.length }).map((_, i) => (
                        <div key={i} className="animate-pulse" style={{ width: i === 0 ? 20 : 5, height: '0.3125rem', borderRadius: '0.1875rem', background: '#1f1f1f' }} />
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    {/* Name + ticker + price + change */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <CSXText
                        variant="title"
                        color="STWhite"
                        style={{ fontSize: '1.375rem', fontWeight: 700, lineHeight: 1.2, fontFamily: 'var(--font-inter)' }}
                      >
                        {top?.name ?? ''}
                      </CSXText>
                      {top?.index_price !== null && top?.index_price !== undefined && (
                        <CSXText variant="body2Semibold" color="STWhiteMuted" style={{ fontFamily: 'var(--font-inter)' }}>
                          {fmtIndexPrice(top.index_price)}
                        </CSXText>
                      )}
                      {top?.change_1d !== null && top?.change_1d !== undefined && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.1875rem' }}>
                          <TrendArrow positive={isPositiveDay} size={13} />
                          <CSXText
                            variant="cardPriceChange"
                            color={isPositiveDay ? 'STPositive' : 'var(--st-chart-negative)'}
                            style={{ fontFamily: 'var(--font-inter)' }}
                          >
                            {Math.abs(top.change_1d).toFixed(2)}%
                          </CSXText>
                        </span>
                      )}
                    </div>

                    {/* Bio */}
                    {bio && (
                      <div style={{ maxWidth: '31.25rem', lineHeight: 1.6 }}>
                        <CSXText variant="body2" color="STSecondary">{bio}</CSXText>
                      </div>
                    )}

                    {/* Meta row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', flexWrap: 'wrap' }}>
                      {top && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <UsersIcon />
                          <CSXText variant="body2" color="STSecondary">
                            {(top.holders ?? holderCount(top.name ?? '')).toLocaleString()} holders
                          </CSXText>
                        </span>
                      )}
                      {top && (
                        <CSXText variant="body2" color="STSecondary">
                          {fmtVolumeUSD(top.volume ?? null)} vol
                        </CSXText>
                      )}
                      {top?.info_location && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <LocationIcon />
                          <CSXText variant="body2" color="STSecondary">{top.info_location}</CSXText>
                        </span>
                      )}
                      {top?.info_subcategory && (
                        <CSXText variant="body2" color="STSecondary">{top.info_subcategory}</CSXText>
                      )}
                      {sinceYear && (
                        <CSXText variant="body2" color="STSecondary">Since {sinceYear}</CSXText>
                      )}
                    </div>

                    {/* Dot indicators */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', paddingTop: '0.125rem' }} onClick={e => e.stopPropagation()}>
                      {Array.from({ length: TOTAL_SLIDES }).map((_, i) => (
                        <button
                          key={i}
                          onClick={() => navigate(i, i > slideIndex ? 1 : -1)}
                          className="transition-all duration-300"
                          style={{
                            width: i === slideIndex ? 20 : 5,
                            height: '0.3125rem',
                            borderRadius: '0.1875rem',
                            background: i === slideIndex ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)',
                            border: 'none',
                            padding: '0rem',
                            cursor: 'pointer',
                            flexShrink: 0,
                          }}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}


          </div>
        )}

        {/* ── Mobile: real paged strip — slides track the finger (Expo parity) ── */}
        {isMobile && (
          <div
            className="absolute inset-0"
            // Backdrop the wrap fade reveals. Mobile-only on purpose: the
            // shared container keeps #131313 (the desktop card surface).
            style={{ zIndex: 2, background: '#0A0A0A' }}
            // Any touch (slide drag, dot tap) pauses; releasing recreates the
            // interval via the `paused` dep — i.e. the countdown restarts from
            // zero, matching the Expo carousel's reset-on-touch behavior.
            onTouchStart={e => {
              touchActiveRef.current = true
              setPaused(true)
              const el = stripRef.current
              wrapGestureRef.current = {
                x: e.touches[0]?.clientX ?? 0,
                atEnd: !!el && el.scrollLeft >= el.scrollWidth - el.clientWidth - 2,
                atStart: !!el && el.scrollLeft <= 2,
                dx: 0,
              }
            }}
            onTouchMove={e => {
              // On the LAST slide a forward swipe has nowhere to scroll, so the
              // pull SCRUBS a fade: opacity tracks the finger continuously on
              // both the card and the worm dot. Release decides commit/cancel.
              const g = wrapGestureRef.current
              if (!g || (!g.atEnd && !g.atStart) || isLoading) return
              g.dx = (e.touches[0]?.clientX ?? 0) - g.x
              // Only two pulls have nowhere to scroll: forward on the last
              // slide, backward on the first. Any other pull keeps opacity 1
              // (which also un-fades a wiggle that reverses direction).
              const pull = g.atEnd && g.dx < 0 ? -g.dx : g.atStart && g.dx > 0 ? g.dx : 0
              const progress = Math.min(pull / WRAP_PULL_RANGE, 1)
              const op = String(1 - progress)
              if (stripRef.current) stripRef.current.style.opacity = op
              if (wormPillRef.current) wormPillRef.current.style.opacity = op
            }}
            onTouchEnd={() => {
              touchActiveRef.current = false
              setPaused(false)
              const g = wrapGestureRef.current
              wrapGestureRef.current = null
              const el = stripRef.current
              const pill = wormPillRef.current
              if (!el || !g || (!g.atEnd && !g.atStart)) return
              const pull = g.atEnd && g.dx < 0 ? -g.dx : g.atStart && g.dx > 0 ? g.dx : 0
              const progress = Math.min(pull / WRAP_PULL_RANGE, 1)
              const restore = (from: number, ms: number) => {
                for (const n of [el, pill]) if (n) {
                  n.style.opacity = ''
                  n.animate([{ opacity: from }, { opacity: 1 }], { duration: ms, easing: 'ease-out' })
                }
              }
              if (progress > 0.5) {
                // Committed: jump while (mostly) faded, then fade back in at
                // the far edge — last→first or first→last. Scrolling BEFORE
                // setSlideIndex means the follow effect sees the strip already
                // in place and does nothing — no second animation. The fade-
                // target guard keeps the snap-settle sync from reading the
                // in-flight positions.
                const toStart = g.atEnd && g.dx < 0
                const lastArtist = SLIDE_CONFIGS.length - 1
                const target = toStart ? 0 : lastArtist * (el.clientWidth || 1)
                stripFadeTargetRef.current = target
                el.scrollTo({ left: target, behavior: 'auto' })
                setDirection(toStart ? 1 : -1)
                setSlideIndex(toStart ? 0 : lastArtist * 2)
                restore(1 - progress, 260)
              } else if (pull > 0) {
                // Cancelled: fade back in where we are.
                restore(1 - progress, 180)
              }
            }}
            onTouchCancel={() => {
              // Native scroll takeover ends the gesture with CANCEL, not END.
              // Same cleanup, but never commit a wrap from a cancelled gesture.
              touchActiveRef.current = false
              setPaused(false)
              const g = wrapGestureRef.current
              wrapGestureRef.current = null
              if (g && ((g.atEnd && g.dx < 0) || (g.atStart && g.dx > 0))) {
                const progress = Math.min(Math.abs(g.dx) / WRAP_PULL_RANGE, 1)
                for (const n of [stripRef.current, wormPillRef.current]) if (n) {
                  n.style.opacity = ''
                  n.animate([{ opacity: 1 - progress }, { opacity: 1 }], { duration: 180, easing: 'ease-out' })
                }
              }
            }}
          >
            {isLoading ? (
              <div className="absolute inset-0" style={{ background: '#0D0D0D' }}>
                <div className="absolute inset-0 flex flex-col justify-end" style={{ padding: '1rem 0.75rem 0.875rem', gap: '0.375rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div className="animate-pulse rounded" style={{ height: '1.75rem', width: '5.625rem', background: '#1f1f1f' }} />
                    <div className="animate-pulse rounded" style={{ height: '0.8125rem', width: '5rem', background: '#1a1a1a' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div className="animate-pulse rounded" style={{ height: '1rem', width: '4rem', background: '#1a1a1a' }} />
                    <div className="animate-pulse rounded" style={{ height: '0.8125rem', width: '2.75rem', background: '#1a1a1a' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div className="animate-pulse rounded" style={{ height: '0.6875rem', width: '90%', background: '#1a1a1a' }} />
                    <div className="animate-pulse rounded" style={{ height: '0.6875rem', width: '65%', background: '#1a1a1a' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3125rem', paddingTop: '0.25rem' }}>
                    {Array.from({ length: SLIDE_CONFIGS.length }).map((_, i) => (
                      <div key={i} className="animate-pulse" style={{ width: i === 0 ? 20 : 5, height: '0.3125rem', borderRadius: '0.1875rem', background: '#1f1f1f' }} />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div
                  ref={stripRef}
                  className="scrollbar-hide"
                  onScroll={onStripScroll}
                  style={{
                    position: 'absolute', inset: 0, display: 'flex', overflowX: 'auto',
                    scrollSnapType: 'x mandatory',
                    // 'none', not 'contain': contain keeps the native edge
                    // bounce, which would drag the last slide sideways under
                    // the wrap fade. The fade is the only edge affordance.
                    overscrollBehaviorX: 'none',
                    WebkitOverflowScrolling: 'touch',
                  }}
                >
                  {SLIDE_CONFIGS.map((_, i) => {
                    const sp = profiles[i]
                    const pos = (sp?.change_1d ?? 0) >= 0
                    const bio = sp?.bio ? decodeHtml(sp.bio) : ''
                    return (
                      <div
                        key={i}
                        style={{ position: 'relative', flex: '0 0 100%', height: '100%', scrollSnapAlign: 'start', scrollSnapStop: 'always', cursor: 'pointer', overflow: 'hidden' }}
                        onClick={() => sp?.id && openProfile(sp.id)}
                      >
                        {heroImage(sp) ? (
                          <FadeInImage key={heroImage(sp)!} src={heroImage(sp)!} alt={sp?.name ?? ''} priority={i === 0} />
                        ) : (
                          <div className="absolute inset-0" style={{ background: '#0D0D0D' }} />
                        )}
                        <div style={{ position: 'absolute', top: '0rem', left: '0rem', right: '0rem', bottom: '-0.0625rem', background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.5) 45%, rgba(0,0,0,0.0) 100%)' }} />
                        {sp?.industry && (
                          <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 10 }}>
                            <CSXInfoChip variant="artistCard">
                              <CSXText variant="chipLabelNormal" color="STForeground">{sp.industry}</CSXText>
                            </CSXInfoChip>
                          </div>
                        )}
                        {/* Text overlay — bottom padding reserves room for the fixed pager below */}
                        <div className="absolute inset-0 flex flex-col justify-end" style={{ padding: '1rem 0.75rem 1.75rem', gap: '0.375rem' }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                            <CSXText
                              variant="title"
                              color="STWhite"
                              style={{ fontSize: '1.625rem', fontWeight: 700, lineHeight: 1, fontFamily: 'var(--font-inter)' }}
                            >
                              {sp?.name ?? ''}
                            </CSXText>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {sp?.index_price != null && (
                              <CSXText variant="body2Semibold" color="STWhiteMuted" style={{ fontFamily: 'var(--font-inter)', fontSize: '1rem' }}>
                                {fmtIndexPrice(sp.index_price)}
                              </CSXText>
                            )}
                            {sp?.change_1d != null && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.1875rem' }}>
                                <TrendArrow positive={pos} size={13} />
                                <CSXText
                                  variant="body2Medium"
                                  color={pos ? 'STPositive' : 'var(--st-chart-negative)'}
                                  style={{ fontFamily: 'var(--font-inter)' }}
                                >
                                  {Math.abs(sp.change_1d).toFixed(2)}%
                                </CSXText>
                              </span>
                            )}
                          </div>
                          {bio && (
                            <CSXText variant="body2" color="STWhiteMuted">
                              {bio.length > 100 ? bio.slice(0, 97) + '…' : bio}
                            </CSXText>
                          )}
                          {sp && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <UsersIcon />
                              <CSXText variant="body2" color="STWhiteMuted">
                                {(sp.holders ?? holderCount(sp.name ?? '')).toLocaleString()} holders
                              </CSXText>
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
                {/* No nav arrows on mobile — swipe replaces them (Expo parity). */}
                {/* Worm pager — fixed over the strip, scroll-driven */}
                <div style={{ position: 'absolute', left: '0.75rem', bottom: '0.875rem', zIndex: 10 }} onClick={e => e.stopPropagation()}>
                  <div style={{ position: 'relative', height: WORM_DOT, width: SLIDE_CONFIGS.length * WORM_STRIDE - (WORM_STRIDE - WORM_DOT) }}>
                    {SLIDE_CONFIGS.map((_, i) => (
                      <button
                        key={i}
                        aria-label={`Go to slide ${i + 1}`}
                        onClick={() => navigate(i * 2, i * 2 > slideIndex ? 1 : -1)}
                        style={{ position: 'absolute', left: i * WORM_STRIDE, top: 0, width: WORM_DOT, height: WORM_DOT, borderRadius: WORM_DOT, background: 'rgba(255,255,255,0.3)', border: 'none', padding: 0, cursor: 'pointer' }}
                      />
                    ))}
                    {/* left/width are OWNED by updateWorm (scroll-driven).
                        They must not appear in this style prop: React would
                        re-write them on every slideIndex render, teleporting
                        the pill to the destination dot an instant before the
                        scroll events drag it back — a visible flicker on
                        every autoplay tick. */}
                    <div ref={wormPillRef} style={{ position: 'absolute', top: 0, left: 0, width: WORM_DOT, height: WORM_DOT, borderRadius: WORM_DOT, background: 'rgba(255,255,255,0.9)', pointerEvents: 'none' }} />
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  )
}
