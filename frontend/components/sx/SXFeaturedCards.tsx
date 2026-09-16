'use client'

import { useEffect, useRef, useState, type ReactElement } from 'react'
import { useRouter } from 'next/navigation'
import { BULLET_ICONS } from './SXTopGainerWidget'
import { CSXText} from './core/CSXText'
import { TrendArrow } from './core/TrendArrow'
import { useIsMobile } from '@/lib/useIsMobile'
import { useProfilePanel } from '@/context/ProfilePanelContext'
import { preloadImage } from '@/lib/imageCache'
import { fetchJsonDeduped } from '@/lib/fetch-dedup'
import { supabaseImage } from '@/lib/supabaseImage'
import { usePageVisible } from '@/lib/hooks/usePageVisible'
import { deriveTicker, fmtNumber, fmtVolumeUSD } from '@/lib/format'

// Featured-card banner display is ~192px tall; 384 covers 2× retina.
// Used for BOTH the rendered <img> and the preload so they request the
// same resource (no double-fetch of the full-size original).
const FEATURED_IMG_WIDTH = 384

// Fallback bullet glyphs for labels not in the shared BULLET_ICONS map.
// Chosen deterministically by label so each bullet keeps a stable, distinct icon.
const FALLBACK_BULLET_ICONS: ReactElement[] = [
  <svg key="arrow" width="12" height="12" viewBox="0 0 20 20" fill="none"><path d="M10 16V4M10 4l5 5M10 4l-5 5" stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  <svg key="star" width="12" height="12" viewBox="0 0 20 20" fill="none"><polygon points="10,2 12.4,7.2 18,8 14,12 15,17.6 10,15 5,17.6 6,12 2,8 7.6,7.2" stroke="#a1a1aa" strokeWidth="1.5" fill="none" strokeLinejoin="round" /></svg>,
  <svg key="bars" width="12" height="12" viewBox="0 0 20 20" fill="none"><rect x="3" y="10" width="3" height="7" rx="1" fill="#a1a1aa" /><rect x="8.5" y="6" width="3" height="11" rx="1" fill="#a1a1aa" /><rect x="14" y="3" width="3" height="14" rx="1" fill="#a1a1aa" /></svg>,
  <svg key="pulse" width="12" height="12" viewBox="0 0 20 20" fill="none"><path d="M3 10h3l2-5 2 10 2-5h3" stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  <svg key="bolt" width="12" height="12" viewBox="0 0 20 20" fill="none"><path d="M11 2 4 12h4l-1 6 7-10h-4z" stroke="#a1a1aa" strokeWidth="1.5" fill="none" strokeLinejoin="round" /></svg>,
  <svg key="target" width="12" height="12" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7" stroke="#a1a1aa" strokeWidth="1.5" /><circle cx="10" cy="10" r="2" fill="#a1a1aa" /></svg>,
]

function bulletIcon(label: string): ReactElement {
  if (BULLET_ICONS[label]) return BULLET_ICONS[label]
  let h = 0
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) >>> 0
  return FALLBACK_BULLET_ICONS[h % FALLBACK_BULLET_ICONS.length]
}

interface FeaturedArtist {
  id: string  // ticker (URL slug)
  name: string
  industry?: string | null
  index_price: number | null
  change_1m: number | null
  holders: number | null
  volume: number | null
  image_url?: string | null
}

interface FeaturedCard {
  category: string
  badge: string
  bullets: [string, string, string]
  artist: FeaturedArtist | null
  sortBy: string
  sortDir: 'asc' | 'desc'
}

const CARD_CONFIGS: Omit<FeaturedCard, 'artist'>[] = [
  {
    category: 'Biggest Gainer',
    badge: 'Top Gainer',
    bullets: ['Highest 1M return', 'Strong momentum signal', 'Trending this month'],
    sortBy: 'change_1m',
    sortDir: 'desc',
  },
  {
    category: 'Highest Volume',
    badge: 'Most Traded',
    bullets: ['Highest trading activity', 'Deep liquidity pool', 'High volume leader'],
    sortBy: 'volume',
    sortDir: 'desc',
  },
  {
    category: 'Highest Index',
    badge: 'Top Ranked',
    bullets: ['Highest index value', 'Blue-chip Index', 'Market benchmark'],
    sortBy: 'current_index_value',
    sortDir: 'desc',
  },
  {
    category: 'Biggest Dip',
    badge: 'Dip Alert',
    bullets: ['Largest 1M pullback', 'Potential mean reversion', 'Discounted entry point'],
    sortBy: 'change_1m',
    sortDir: 'asc',
  },
  {
    category: 'Rising Star',
    badge: 'Trending',
    bullets: ['Top 1W performance', 'Short-term breakout', 'Rising fast'],
    sortBy: 'change_1w',
    sortDir: 'desc',
  },
  {
    category: 'Long Term Pick',
    badge: 'Top 1Y',
    bullets: ['Highest 1Y return', 'Sustained growth trend', 'Long-term outperformer'],
    sortBy: 'change_1m',
    sortDir: 'desc',
  },
  {
    category: 'Hidden Gem',
    badge: 'Undervalued',
    bullets: ['Low index, high upside', 'Under-the-radar profile', 'Early opportunity'],
    sortBy: 'current_index_value',
    sortDir: 'asc',
  },
  {
    category: 'Weekly Winner',
    badge: 'Top 1W',
    bullets: ['Best 7-day performer', 'Breakout momentum', 'Weekly standout'],
    sortBy: 'change_1w',
    sortDir: 'desc',
  },
]

function HolderAvatars({ count = 128 }: { seed?: string; count?: number }) {
  return (
    <span className="font-sans m-0 indent-0 p-0 text-xs font-normal leading-normal tracking-[-0.025em]" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--st-secondary)' }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
      {count.toLocaleString()} holders
    </span>
  )
}

function FeaturedCardSkeleton() {
  return (
    <div
      className="rounded-md overflow-hidden animate-pulse"
      style={{ background: 'rgb(19, 19, 19)' }}
    >
      <div style={{ aspectRatio: '1', background: '#1a1a1a' }} />
      <div className="flex flex-col" style={{ padding: '0.625rem', gap: '0.625rem' }}>
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <div style={{ height: '1.125rem', width: '3rem', borderRadius: '0.25rem', background: '#27272a' }} />
            <div style={{ height: '1.125rem', width: '4rem', borderRadius: '0.25rem', background: '#27272a' }} />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <div style={{ width: '0.75rem', height: '0.75rem', borderRadius: '0.1875rem', background: '#27272a' }} />
            <div style={{ height: '0.875rem', width: '4rem', borderRadius: '0.25rem', background: '#27272a' }} />
          </div>
          <div style={{ height: '0.875rem', width: '4.5rem', borderRadius: '0.25rem', background: '#27272a' }} />
        </div>
        <div style={{ height: '0.0625rem', background: '#222222' }} />
        <div className="flex flex-col" style={{ gap: '0.5rem' }}>
          {[120, 96, 80].map((w, i) => (
            <div key={i} className="flex items-center gap-2">
              <div style={{ width: '0.75rem', height: '0.75rem', borderRadius: '0.1875rem', background: '#27272a', flexShrink: 0 }} />
              <div style={{ height: '0.875rem', width: w, borderRadius: '0.25rem', background: '#27272a' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const CARDS_PER_PAGE_DESKTOP = 4
const CARDS_PER_PAGE_MOBILE = 2

interface SXFeaturedCardsProps {
  hideHeader?: boolean
  onNavControlsRender?: (controls: React.ReactNode) => void
  disableAutoAdvance?: boolean
  headerTitle?: string
  headerSubtitle?: string
  onHeaderClick?: () => void
}

export function SXFeaturedCards({ hideHeader = false, onNavControlsRender, disableAutoAdvance = false, headerTitle = 'Featured', headerSubtitle = 'Curated picks across the market', onHeaderClick }: SXFeaturedCardsProps) {
  const router = useRouter()
  const isMobile = useIsMobile()
  const { openProfile } = useProfilePanel()
  const CARDS_PER_PAGE = isMobile ? CARDS_PER_PAGE_MOBILE : CARDS_PER_PAGE_DESKTOP
  const [cards, setCards] = useState<FeaturedCard[]>(
    CARD_CONFIGS.map(c => ({ ...c, artist: null }))
  )
  const [dataLoaded, setDataLoaded] = useState(false)
  const loading = !dataLoaded
  const [page, setPage] = useState(0)
  const [pressedCard, setPressedCard] = useState<string | null>(null)
  const pageVisible = usePageVisible()
  const [timerKey, setTimerKey] = useState(0)
  const dirRef = useRef<'left' | 'right'>('left')
  const touchStartX = useRef<number | null>(null)

  // Saved (bookmarked) markets — persisted locally so they survive reloads.
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  useEffect(() => {
    try {
      const raw = localStorage.getItem('pauv:savedMarkets')
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot hydrate from localStorage
      if (raw) setSavedIds(new Set(JSON.parse(raw) as string[]))
    } catch { /* ignore */ }
  }, [])
  const toggleSaved = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setSavedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      try { localStorage.setItem('pauv:savedMarkets', JSON.stringify([...next])) } catch { /* ignore */ }
      return next
    })
  }

  // Reset to page 0 when cards-per-page changes (mobile ↔ desktop)
  useEffect(() => { setPage(0) }, [CARDS_PER_PAGE])

  // Auto-advance every 10 seconds; resets when user manually navigates
  useEffect(() => {
    if (loading || disableAutoAdvance || !pageVisible) return
    const id = setInterval(() => {
      dirRef.current = 'left'
      setPage(p => {
        const next = p + 1
        return next >= Math.ceil(cards.length / CARDS_PER_PAGE) ? 0 : next
      })
    }, 10000)
    return () => clearInterval(id)
  }, [loading, cards.length, timerKey, disableAutoAdvance, pageVisible])

  useEffect(() => {
    let cancelled = false
    async function fetchAll() {
      // Step 1: fetch top-30 candidates per config card. The limit is
      // intentionally aligned with `useSXTopGainerSlides` so the resulting
      // URLs are byte-identical for the shared (sortBy, sortDir) tuples —
      // `fetchJsonDeduped` then collapses both widgets' requests into a
      // single in-flight promise. 30 rows costs ~2kB more per call but
      // saves up to 6 round-trips on home page load.
      const configCandidates = await Promise.all(
        CARD_CONFIGS.map(async (cfg) => {
          try {
            const data = await fetchJsonDeduped<{
              artists?: Array<{
                id: string; name: string; industry: string | null
                index_price: number | null; change_1m: number | null
                holders: number | null; volume: number | null; image_url: string
              }>
            }>(`/api/trade?limit=30&offset=0&sort_by=${cfg.sortBy}&sort_dir=${cfg.sortDir}`)
            return data.artists ?? []
          } catch {
            return []
          }
        })
      )

      // Pick first unused candidate per config slot (sequential so usedIds stays consistent)
      const usedIds = new Set<string>()
      const dedupedArtists = configCandidates.map(candidates => {
        for (const a of candidates) {
          if (usedIds.has(a.id)) continue
          usedIds.add(a.id)
          return {
            id: a.id,
            name: a.name,
            industry: a.industry || null,
            index_price: a.index_price,
            change_1m: a.change_1m,
            holders: a.holders,
            volume: a.volume,
            image_url: a.image_url,
          } as FeaturedArtist
        }
        return null
      })

      // Step 2: fetch top 30 to build one "Top {Industry}" card per unique
      // industry. Deduped — useSXTopGainerSlides asks for the same URL.
      const topIndustryCards: FeaturedCard[] = []
      try {
        const data = await fetchJsonDeduped<{
          artists?: Array<{
            id: string; name: string; industry: string | null
            index_price: number | null; change_1m: number | null
            holders: number | null; volume: number | null; image_url: string
          }>
        }>(`/api/trade?limit=30&offset=0&sort_by=current_index_value&sort_dir=desc`)
        {
          const seenIndustries = new Set<string>()
          for (const a of (data.artists ?? [])) {
            const ind = a.industry as string | null
            if (!ind || usedIds.has(a.id) || seenIndustries.has(ind)) continue
            usedIds.add(a.id)
            seenIndustries.add(ind)
            topIndustryCards.push({
              category: `Top ${ind}`,
              badge: 'Highest Index',
              bullets: [`Highest ${ind} index`, 'Blue-chip Index', 'Category leader'] as [string, string, string],
              sortBy: 'current_index_value',
              sortDir: 'desc' as const,
              artist: {
                id: a.id,
                name: a.name,
                industry: ind,
                index_price: a.index_price,
                change_1m: a.change_1m,
                holders: a.holders,
                volume: a.volume,
                image_url: a.image_url,
              },
            })
          }
        }
      } catch {}

      if (!cancelled) {
        const configCards = CARD_CONFIGS.map((cfg, i) => ({ ...cfg, artist: dedupedArtists[i] }))

        // Interleave: insert one Top Industry card after every 2 config cards
        const mixed: FeaturedCard[] = []
        let ti = 0
        for (let ci = 0; ci < configCards.length; ci++) {
          mixed.push(configCards[ci])
          if ((ci + 1) % 2 === 0 && ti < topIndustryCards.length) {
            mixed.push(topIndustryCards[ti++])
          }
        }
        while (ti < topIndustryCards.length) {
          mixed.push(topIndustryCards[ti++])
        }

        setCards(mixed)
        setDataLoaded(true)

        // Preload all card images immediately after data loads. Preload the
        // SAME transformed URL the <img> renders, or the preload warms the
        // wrong (full-size) resource and the card re-fetches.
        mixed.forEach(card => { if (card.artist?.image_url) preloadImage(supabaseImage(card.artist.image_url, FEATURED_IMG_WIDTH)) })
      }
    }
    fetchAll()
    return () => { cancelled = true }
  }, [])

  const totalPages = loading
    ? Math.ceil(CARD_CONFIGS.length / CARDS_PER_PAGE)
    : Math.ceil(cards.length / CARDS_PER_PAGE)

  // Preload next page images whenever page changes
  useEffect(() => {
    if (loading) return
    const nextPage = (page + 1) % totalPages
    cards.slice(nextPage * CARDS_PER_PAGE, (nextPage + 1) * CARDS_PER_PAGE)
      .forEach(card => { if (card.artist?.image_url) preloadImage(supabaseImage(card.artist.image_url, FEATURED_IMG_WIDTH)) })
  }, [page, loading, cards, totalPages, CARDS_PER_PAGE])

  const rawVisible: FeaturedCard[] = loading
    ? CARD_CONFIGS.slice(page * CARDS_PER_PAGE, (page + 1) * CARDS_PER_PAGE).map(cfg => ({ ...cfg, artist: null }))
    : cards.slice(page * CARDS_PER_PAGE, (page + 1) * CARDS_PER_PAGE)

  const visibleCards: FeaturedCard[] = [...rawVisible]
  if (!loading && cards.length > 0) {
    let wi = 0
    while (visibleCards.length < CARDS_PER_PAGE) {
      visibleCards.push(cards[wi % cards.length])
      wi++
    }
  }

  const navControls = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginLeft: 'auto' }}>
      <button
        aria-label="Previous slide"
        disabled={page === 0}
        onClick={() => { dirRef.current = 'right'; setTimerKey(k => k + 1); setPage(p => Math.max(0, p - 1)) }}
        className="hover:bg-zinc-800 transition-colors"
        style={{
          cursor: page === 0 ? 'not-allowed' : 'pointer',
          border: '1px solid #3f3f46',
          background: 'transparent',
          borderRadius: '50%',
          padding: '0.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: page === 0 ? '#52525b' : '#a1a1aa',
          opacity: page === 0 ? 0.4 : 1,
        }}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
        </svg>
      </button>
      <span style={{ minWidth: '2rem', textAlign: 'center', display: 'inline-block' }}>
        <CSXText variant="body3" color="STMuted">
          {page + 1} of {totalPages}
        </CSXText>
      </span>
      <button
        aria-label="Next slide"
        disabled={page >= totalPages - 1}
        onClick={() => { dirRef.current = 'left'; setTimerKey(k => k + 1); setPage(p => Math.min(totalPages - 1, p + 1)) }}
        className="hover:bg-zinc-800 transition-colors"
        style={{
          cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer',
          border: '1px solid #3f3f46',
          background: 'transparent',
          borderRadius: '50%',
          padding: '0.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: page >= totalPages - 1 ? '#52525b' : '#a1a1aa',
          opacity: page >= totalPages - 1 ? 0.4 : 1,
        }}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
        </svg>
      </button>
    </div>
  )

  // Expose nav controls to parent if callback provided
  useEffect(() => {
    if (onNavControlsRender) {
      onNavControlsRender(navControls)
    }
  }, [page, totalPages, onNavControlsRender])

  return (
    <div>
      <style>{`
        @keyframes sx-slide-from-right { from { transform: translateX(48px);  opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes sx-slide-from-left  { from { transform: translateX(-48px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .sx-slide-right { animation: sx-slide-from-right 0.28s cubic-bezier(0.25,0.46,0.45,0.94) both; }
        .sx-slide-left  { animation: sx-slide-from-left  0.28s cubic-bezier(0.25,0.46,0.45,0.94) both; }
      `}</style>
      {/* Heading row with nav arrows on the right */}
      {!hideHeader && (
        <div className="flex mt-6 md:mt-12 items-center justify-between mb-4">
          <div className="flex flex-col gap-0.5">
            <h2 
              className="m-0 p-0" 
              style={{ cursor: onHeaderClick ? 'pointer' : 'default' }}
              onClick={onHeaderClick}
            >
              <CSXText variant="subtitle" color="STWhite">{headerTitle}</CSXText>
            </h2>
            <CSXText variant="body2" color="STSecondary">{headerSubtitle}</CSXText>
          </div>
          {navControls}
        </div>
      )}

      {/* Card grid — always 4 columns */}
      <div
        style={{ overflow: 'hidden' }}
        onTouchStart={e => { touchStartX.current = e.touches[0].clientX }}
        onTouchEnd={e => {
          if (touchStartX.current === null) return
          const dx = touchStartX.current - e.changedTouches[0].clientX
          touchStartX.current = null
          if (Math.abs(dx) < 40) return
          if (dx > 0 && page < totalPages - 1) {
            dirRef.current = 'left'
            setTimerKey(k => k + 1)
            setPage(p => Math.min(totalPages - 1, p + 1))
          } else if (dx < 0 && page > 0) {
            dirRef.current = 'right'
            setTimerKey(k => k + 1)
            setPage(p => Math.max(0, p - 1))
          }
        }}
      >
      <div
        key={page}
        className={`grid gap-3 md:gap-7 grid-cols-2 md:grid-cols-4 ${dirRef.current === 'left' ? 'sx-slide-right' : 'sx-slide-left'}`}
      >
        {loading
          ? <>
              <FeaturedCardSkeleton />
              <FeaturedCardSkeleton />
              <div className="hidden md:contents"><FeaturedCardSkeleton /></div>
              <div className="hidden md:contents"><FeaturedCardSkeleton /></div>
            </>
          : visibleCards.map((card) => {
              const isUp = (card.artist?.change_1m ?? 0) >= 0
              const changeColor = `var(--${isUp ? 'st-positive' : 'st-chart-negative'})`
              const name = card.artist?.name ?? '—'
              const ticker = card.artist?.name ? deriveTicker(card.artist.name) : '—'

              return (
                <div
                  key={`${card.category}-${card.artist?.id || card.badge}`}
                  className="group rounded-md md:rounded-lg overflow-hidden cursor-pointer"
                  style={{
                    background: 'rgb(19, 19, 19)',
                    transition: 'transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                    transformOrigin: 'center',
                    transform: pressedCard === `${card.category}-${card.artist?.id || card.badge}` ? 'scale(0.96)' : 'scale(1)',
                  }}
                  onClick={() => card.artist && (isMobile ? openProfile(card.artist.id) : router.push(`/artist/${encodeURIComponent(card.artist.id)}`))}
                  onPointerDown={() => setPressedCard(`${card.category}-${card.artist?.id || card.badge}`)}
                  onPointerUp={() => setPressedCard(null)}
                  onPointerLeave={() => setPressedCard(null)}
                >
                  {/* Banner image — flush to the card's top and sides. Its own
                      bottom corners stay square so it meets the body edge-to-
                      edge; the top ones are clipped by the card's rounding. */}
                  <div className="relative" style={{ aspectRatio: '1', background: '#1a1a1a', overflow: 'hidden' }}>
                    {card.artist?.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={supabaseImage(card.artist.image_url, FEATURED_IMG_WIDTH)}
                        alt={name}
                        loading="lazy"
                        decoding="async"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center center' }}
                      />
                    ) : (
                      <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #1c1c1c 0%, #111 100%)' }} />
                    )}
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(to bottom, transparent 35%, rgba(0,0,0,0.65) 100%)',
                      }}
                    />
                    {card.artist && (() => {
                      const isSaved = savedIds.has(card.artist.id)
                      return (
                        <button
                          type="button"
                          aria-label={isSaved ? 'Remove from saved' : 'Save'}
                          aria-pressed={isSaved}
                          onClick={(e) => toggleSaved(card.artist!.id, e)}
                          className={`hover:bg-zinc-800 transition-[opacity,background-color] duration-200 cursor-pointer absolute top-2 right-2 ${isSaved ? '' : 'opacity-0 group-hover:opacity-100'}`}
                          style={{ cursor: 'pointer', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.4)', borderRadius: '50%', padding: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isSaved ? '#ffffff' : '#a1a1aa', zIndex: 20, filter: 'drop-shadow(0 0.125rem 0.5rem rgba(0,0,0,0.9))' }}
                        >
                          <svg viewBox="0 0 24 24" width={12.6} height={12.6} fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                          </svg>
                        </button>
                      )
                    })()}
                    {card.artist?.change_1m != null && (
                      <div className="absolute flex items-center gap-1 shrink-0" style={{ bottom: '0.5rem', right: '0.5rem', zIndex: 10, filter: 'drop-shadow(0 0.125rem 0.375rem rgba(0,0,0,0.9))' }}>
                        <TrendArrow positive={isUp} />
                        <span className="whitespace-nowrap tabular-nums text-xs" style={{ color: changeColor, fontFamily: 'var(--font-inter)' }}>
                          {Math.abs(card.artist.change_1m).toFixed(2)}%
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Card body */}
                  <div className="flex flex-col" style={{ padding: '0.625rem', gap: '0.375rem' }}>
                    <div className="flex flex-col">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate" style={{ fontFamily: 'var(--font-inter)', fontSize: '1rem', fontWeight: 600, color: '#ffffff' }}>
                          {name}
                        </span>
                        <span className="flex-shrink-0" style={{ fontFamily: 'var(--font-inter)', fontSize: '1rem', fontWeight: 600, color: '#ffffff', lineHeight: 1 }}>
                          {card.artist?.index_price != null ? fmtNumber(card.artist.index_price) : '—'}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '-0.1875rem' }}>
                      <HolderAvatars
                        seed={ticker}
                        count={card.artist?.holders ?? 0}
                      />
                      <span className="font-sans m-0 indent-0 p-0 text-xs font-normal leading-normal tracking-[-0.025em] flex-shrink-0" style={{ color: 'var(--st-secondary)' }}>
                        {`Vol. ${fmtVolumeUSD(card.artist?.volume, { decimals: 1, smallDecimals: 0 })}`}
                      </span>
                    </div>

                    <div className="flex flex-col" style={{ gap: '0.1875rem' }}>
                      {card.bullets.map((b, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="shrink-0 flex items-center" aria-hidden="true">{bulletIcon(b)}</span>
                          <span className="font-sans m-0 indent-0 p-0 text-xs font-normal leading-normal tracking-[-0.025em] truncate" style={{ color: 'var(--st-secondary)' }}>
                            {b}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
      </div>
      </div>
    </div>
  )
}
