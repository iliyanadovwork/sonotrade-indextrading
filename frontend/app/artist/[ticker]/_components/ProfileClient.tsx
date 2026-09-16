'use client'

import { useState, useEffect, useLayoutEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useIsMobile } from '@/lib/useIsMobile'
import { useArtistRefresh } from '@/lib/use-artist-refresh'
import { SXProfileHeader } from '@/components/sx/SXProfileHeader'
import { SXPriceChart, type TimePeriod } from '@/components/sx/SXPriceChart'
import { SXTradingPanel } from '@/components/sx/SXTradingPanel'
import { SXOpenPosition } from '@/components/sx/SXOpenPosition'
import { MobileOpenPosition } from '@/components/mobile/MobileOpenPosition'
import { MobileTradeDrawer } from '@/components/mobile/MobileTradeDrawer'
import SXOrderbookDetailsAccordion, { ClaimModal } from '@/components/sx/SXOrderbookDetailsAccordion'
import { CommentSection } from '@/components/comments/CommentSection'
import { SXReleases } from '@/components/sx/SXReleases'
import { SXTopTracks } from '@/components/sx/SXTopTracks'
import { SXTopCities } from '@/components/sx/SXTopCities'
import { SXArtistTours } from '@/components/sx/SXArtistTours'
import { SXMarketStatsRow } from '@/components/sx/SXMarketStatsRow'
import { SXProfileAbout, SXProfileAboutCard } from '@/components/sx/SXProfileAbout'
import { CSXText } from '@/components/sx/core/CSXText'
import { useLivePriceHistory } from '@/lib/hooks/useLivePriceHistory'
import { usePageVisible } from '@/lib/hooks/usePageVisible'
import { useLiveMarketStats } from '@/lib/hooks/useLiveMarketStats'
import { useMemo } from 'react'
import type { Profile } from '@/lib/types'
import type { MarketStatsLive } from '@/lib/data'

interface Props {
  initialProfile: Profile
  ticker: string
  initialStats: MarketStatsLive
}

// A freshly-scraped artist row lands with name/image/price but the enrichment
// fields (bio + music widgets) still empty until the scraper finishes.
function hasScrapedContent(p: Profile): boolean {
  return (
    Boolean(p.bio) ||
    (p.releases?.length ?? 0) > 0 ||
    (p.top_tracks?.length ?? 0) > 0 ||
    (p.top_cities?.length ?? 0) > 0 ||
    (p.events?.length ?? 0) > 0
  )
}

const ENRICH_POLL_MS = 5000
const ENRICH_POLL_MAX_ATTEMPTS = 36 // ~3 minutes, then give up quietly

function WidgetSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="animate-pulse py-4">
      <div className="h-5 w-32 rounded bg-zinc-800 mb-4" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-10 w-10 rounded bg-zinc-800 flex-shrink-0" />
            <div className="flex-1 min-w-0 flex flex-col gap-2">
              <div className="h-3.5 w-3/5 rounded bg-zinc-800" />
              <div className="h-3 w-2/5 rounded bg-zinc-800/70" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AboutSkeleton() {
  return (
    <div className="animate-pulse py-4">
      <div className="h-5 w-24 rounded bg-zinc-800 mb-4" />
      <div className="flex flex-col gap-2.5">
        <div className="h-3.5 w-full rounded bg-zinc-800" />
        <div className="h-3.5 w-full rounded bg-zinc-800" />
        <div className="h-3.5 w-11/12 rounded bg-zinc-800" />
        <div className="h-3.5 w-4/5 rounded bg-zinc-800" />
        <div className="h-3.5 w-1/2 rounded bg-zinc-800/70" />
      </div>
    </div>
  )
}

export function ProfileClient({ initialProfile, ticker, initialStats }: Props) {
  const isMobile = useIsMobile()
  const router = useRouter()
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('ALL')
  const [hoverPrice, setHoverPrice] = useState<number | null>(null)
  const [hiddenReleaseIds, setHiddenReleaseIds] = useState<string[]>([])

  // Lazy refresh: the daily scraper only covers the traded tier, so opening
  // a profile is what keeps everyone else current.
  useArtistRefresh(ticker)
  const pageVisible = usePageVisible()
  const [tradeOpen, setTradeOpen] = useState(false)
  const [claimProfileName, setClaimProfileName] = useState<string | null>(null)
  // Live-measured height of the global sticky <header> so the right-rail
  // trading panel can pin just below it (Kalshi-style). Measured with
  // offsetHeight, which is layout px in every engine — the same space CSS
  // `top` is applied in — so no zoom correction is involved.
  // The initial value must match the real header because it's what the SSR
  // HTML paints with before hydration — a wrong guess here is a visible jump
  // on every refresh. Desktop header = 4.25rem (h-9 account row + 2rem
  // vertical padding) at the 90% root font-size: 4.25 × 14.4 = 61.2 → 61
  // layout px (verified against offsetHeight in Chrome).
  const [headerLayoutH, setHeaderLayoutH] = useState(61)
  // Bio + widget data for a just-scraped artist arrives after first render —
  // start from the SSR profile and poll until the scraper has filled it in.
  const [profile, setProfile] = useState(initialProfile)
  const enriching = !hasScrapedContent(profile)
  // Upward fade/overlap of the scroll-over content into the about box. 0 at rest
  // (no fade shown) and grows as the user scrolls, so the blend only appears
  // once you start scrolling and widens from there.
  const [scrollFade, setScrollFade] = useState(0)

  // Adapt the SSR-rendered `PricePoint[]` (Profile.price_history uses
  // `{price, t}`) to the chart hook's `{price, timestamp}` shape. Memoised
  // so the seed identity is stable across renders.
  const initialChartHistory = useMemo(
    () =>
      (initialProfile.price_history ?? []).map(p => ({
        price: p.price,
        timestamp: p.t,
      })),
    [initialProfile.price_history]
  )

  const livePriceHistory = useLivePriceHistory(
    ticker,
    initialProfile.id,
    selectedPeriod,
    initialChartHistory
  )
  // Fall back to the SSR RPC-computed price (initialStats.price) — single
  // source of truth, microusdc-aware, immune to stale cents. Profile.price
  // from the embedded markets join can be 0 if the cents column hasn't been
  // backfilled, which would flat-line the chart for that profile.
  const lastLivePrice = livePriceHistory.length > 0
    ? livePriceHistory[livePriceHistory.length - 1]!.price
    : initialStats.price

  const liveStats = useLiveMarketStats(ticker, initialProfile.id, initialStats, lastLivePrice)

  const toggleRelease = useCallback((id: string) =>
    setHiddenReleaseIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    ), [])

  // Memoized: hovering the chart sets hoverPrice state on every mouse frame,
  // and rebuilding this array per render allocated 1000+ Dates/ISO strings
  // per frame (and broke child memoization via a fresh reference).
  const dataPoints = useMemo(() => livePriceHistory.map(p => ({
    index: p.price,
    timestamp: new Date(p.timestamp).toISOString(),
  })), [livePriceHistory])

  const visibleReleases = useMemo(
    () => ((profile.releases ?? []) as Array<{ id: string }>).filter(r => !hiddenReleaseIds.includes(r.id)),
    [profile.releases, hiddenReleaseIds]
  )

  // While the artist is still being scraped, poll the profile API until the
  // bio/widget fields land, then swap the skeletons for the real components.
  // Gated on page visibility like every other interval in the app — a hidden
  // tab shouldn't keep hitting the API. (Attempts reset when the tab returns,
  // which is fine: the count only exists to bound a scraper that never runs.)
  useEffect(() => {
    if (!enriching || !pageVisible) return
    let cancelled = false
    let attempts = 0
    const id = setInterval(async () => {
      attempts += 1
      if (attempts > ENRICH_POLL_MAX_ATTEMPTS) {
        clearInterval(id)
        return
      }
      try {
        // Cache-buster: the route sends `s-maxage=30`, which would otherwise
        // pin the poll to the same empty CDN-cached body.
        const res = await fetch(
          `/api/profile/${encodeURIComponent(ticker)}?t=${Date.now()}`,
          { cache: 'no-store' }
        )
        if (!res.ok) return
        const json = (await res.json()) as { profile?: Profile }
        if (!cancelled && json.profile && hasScrapedContent(json.profile)) {
          clearInterval(id)
          setProfile(json.profile)
        }
      } catch {
        // transient network error — keep polling
      }
    }, ENRICH_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [enriching, ticker, pageVisible])

  // Measure the global header height (desktop only) and keep the sticky
  // panel offset in sync as it reflows (login state, viewport width, etc.).
  // useLayoutEffect so the measured offset replaces the initial guess before
  // the browser paints — with useEffect the first frame painted at the guessed
  // height and then visibly jumped to the measured one.
  useLayoutEffect(() => {
    if (isMobile) return
    const el = document.querySelector('header')
    if (!el) return
    // `offsetHeight`, NOT getBoundingClientRect(): under `zoom: 0.9` the rect is
    // reported in *visual* px by Blink but *layout* px by WebKit, while
    // offsetHeight is layout px in both. Measuring in layout px directly means
    // the value already matches the space CSS `top` is applied in, so no zoom
    // correction is needed (and none can go stale).
    const measure = () => setHeaderLayoutH(el.offsetHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [isMobile])

  // Reveal + widen the upward fade as the user scrolls (desktop only).
  useEffect(() => {
    if (isMobile) return
    const onScroll = () => setScrollFade(Math.min(96, window.scrollY * 2))
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [isMobile])

  // Claim modal via window event (same as MobileProfilePanel)
  useEffect(() => {
    if (!isMobile) return
    const handler = (e: Event) => {
      const name = (e as CustomEvent<{ profileName: string }>).detail.profileName
      setClaimProfileName(name)
    }
    window.addEventListener('pauv:claimProfile', handler)
    return () => window.removeEventListener('pauv:claimProfile', handler)
  }, [isMobile])

  // ── Desktop layout ───────────────────────────────────────────────────────────
  if (!isMobile) {
    // The header height is already in layout px (offsetHeight), which is the
    // space CSS `top` resolves in — so it is used as-is. Plus the 8px content
    // top padding (md:pt-2, matching the home page) so the panel top lines up
    // with the about box (the first element in the left column).
    const ZOOM = 0.9
    const panelTop = Math.round(headerLayoutH) + 8
    return (
      <main className="flex flex-1 w-full flex-col bg-[rgb(10,10,10)] text-white pt-0 md:pt-2">
        <div className="w-full max-w-[92.5rem] mx-auto flex relative flex-1">
          <div className="flex-1 min-w-0 px-3 md:px-0 md:pr-6">
            {/* About box stays pinned; the content below scrolls up over it. */}
            <div className="sticky" style={{ top: panelTop, zIndex: 0 }}>
              {enriching ? (
                <AboutSkeleton />
              ) : (
                <SXProfileAboutCard
                  biography={profile.bio}
                  image_url={profile.photo_url || null}
                  name={profile.name}
                  gallery={(profile.gallery ?? []) as string[]}
                  followers={profile.followers}
                  monthly_listeners={profile.monthly_listeners}
                  top_cities={(profile.top_cities ?? []) as never[]}
                  facebook={profile.social_facebook || null}
                  instagram={profile.social_instagram || null}
                  twitter={profile.social_x || null}
                  tiktok={profile.social_tiktok || null}
                  spotify_id={ticker}
                />
              )}
            </div>
            {/* Opaque layer that slides up over the pinned about box, with a
                soft fade at its top edge as it stacks over the about box. */}
            <div
              className="relative"
              style={{
                zIndex: 1,
                // Pull the layer up to overlap the about box and pad it back, so
                // the fade widens *upward* into the about box while the content
                // (header) stays put. Driven by scroll: 0 at rest (no fade).
                marginTop: -scrollFade,
                paddingTop: scrollFade,
                background: 'rgb(10,10,10)',
                WebkitMaskImage: `linear-gradient(to bottom, transparent 0, black ${scrollFade}px)`,
                maskImage: `linear-gradient(to bottom, transparent 0, black ${scrollFade}px)`,
              }}
            >
            <div>
              <SXProfileHeader
                name={initialProfile.name}
                id={ticker}
                picture={initialProfile.photo_url || null}
                index_price={lastLivePrice}
                volume={liveStats.volume_24h}
                total_forecasts={liveStats.total_forecasts}
                market_cap={liveStats.market_cap}
                holders={liveStats.holders}
                change_1h={liveStats.change_1h}
                change_1d={liveStats.change_24h}
                data_points={dataPoints}
                selectedPeriod={selectedPeriod}
                hoverPrice={hoverPrice}
                releases={(profile.releases ?? []) as never[]}
                hiddenReleaseIds={hiddenReleaseIds}
                onToggleRelease={toggleRelease}
                instagram={initialProfile.social_instagram || null}
                twitter={initialProfile.social_x || null}
                tiktok={initialProfile.social_tiktok || null}
                spotify_url={initialProfile.social_spotify || null}
                appleMusic={initialProfile.social_applemusic || null}
                youtube={initialProfile.social_youtube || null}
                twitch={initialProfile.social_twitch || null}
              />
              <SXPriceChart
                data={livePriceHistory}
                height={400}
                onPeriodChange={(period: TimePeriod) => setSelectedPeriod(period)}
                initialPeriod={selectedPeriod}
                onHoverValueChange={setHoverPrice}
                releases={visibleReleases as never[]}
                allReleases={(profile.releases ?? []) as never[]}
                hiddenReleaseIds={hiddenReleaseIds}
                onToggleRelease={toggleRelease}
              />
              <div className="px-3 md:px-0 py-6 border-t border-b border-zinc-800">
                <SXMarketStatsRow
                  totalForecastsUsd={liveStats.total_forecasts}
                  volume24hUsd={liveStats.volume_24h}
                  holders={liveStats.holders}
                  change1h={liveStats.change_1h}
                  change24h={liveStats.change_24h}
                  change7d={liveStats.change_7d}
                />
              </div>
            </div>
            <div>
              <SXOpenPosition
                spotifyId={ticker}
                artistName={initialProfile.name}
                initialPrice={lastLivePrice}
              />
              <SXOrderbookDetailsAccordion profileName={initialProfile.name} />
              {enriching ? (
                <>
                  <div className="flex flex-col md:flex-row gap-8 md:gap-12 items-start">
                    <div className="flex-1 min-w-0"><WidgetSkeleton /></div>
                    <div className="flex-1 min-w-0"><WidgetSkeleton /></div>
                  </div>
                  <div className="flex flex-col md:flex-row gap-8 md:gap-12 items-start">
                    <div className="flex-1 min-w-0"><WidgetSkeleton rows={3} /></div>
                    <div className="flex-1 min-w-0"><WidgetSkeleton rows={3} /></div>
                  </div>
                </>
              ) : (
                <>
                  {((profile.releases?.length ?? 0) > 0 || (profile.top_tracks?.length ?? 0) > 0) && (
                    <div className="flex flex-col md:flex-row gap-8 md:gap-12 items-start">
                      {(profile.releases?.length ?? 0) > 0 && (
                        <div className="flex-1 min-w-0"><SXReleases releases={(profile.releases ?? []) as never[]} /></div>
                      )}
                      {(profile.top_tracks?.length ?? 0) > 0 && (
                        <div className="flex-1 min-w-0"><SXTopTracks tracks={(profile.top_tracks ?? []) as never[]} /></div>
                      )}
                    </div>
                  )}
                  <div className="flex flex-col md:flex-row gap-8 md:gap-12 items-start">
                    {(profile.top_cities?.length ?? 0) > 0 && (
                      <div className="flex-1 min-w-0"><SXTopCities cities={(profile.top_cities ?? []) as never[]} /></div>
                    )}
                    <div className="flex-1 min-w-0"><SXArtistTours events={(profile.events ?? []) as never[]} artistName={profile.name} /></div>
                  </div>
                </>
              )}
              <div id="comments"><CommentSection spotifyId={ticker} /></div>
            </div>
            </div>
          </div>
          <div style={{ width: '23.75rem' }} className="hidden md:flex flex-shrink-0">
            <div
              className="pl-6 profile-panel-sticky"
              style={{
                position: 'sticky',
                top: panelTop,
                // Hug the panel's own height instead of stretching to the
                // full column (the outer `md:flex` would otherwise stretch
                // this to ~viewport height, which exhausts the sticky travel
                // room and makes the panel detach early). flex-start keeps it
                // content-sized so it stays pinned through the whole column.
                alignSelf: 'flex-start',
                maxHeight: `calc(100vh / ${ZOOM} - ${panelTop + 24}px)`,
                overflowY: 'auto',
                width: '23.75rem',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'center',
              }}
            >
              <SXTradingPanel spotifyId={ticker} contractPrice={liveStats.price} related={initialProfile.related ?? []} />
            </div>
          </div>
        </div>
      </main>
    )
  }

  // ── Mobile layout — bottom-up panel ─────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes profilePageUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        .profile-page-scroll::-webkit-scrollbar { display: none; }
        .profile-page-scroll { scrollbar-width: none; }
      `}</style>

      <div
        className="profile-page-scroll"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: 'rgb(10,10,10)',
          overflowY: 'auto',
          overflowX: 'hidden',
          animation: 'profilePageUp 320ms cubic-bezier(0.16,1,0.3,1) forwards',
        }}
      >
        {/* Back button */}
        <div style={{
          position: 'sticky', top: '0rem', zIndex: 10,
          background: 'rgb(10,10,10)',
          display: 'flex', alignItems: 'center',
          paddingTop: 'max(env(safe-area-inset-top), 0.75rem)',
          paddingBottom: '0.5rem',
          paddingLeft: '0rem', paddingRight: '0.75rem',
        }}>
          <button
            onClick={() => router.back()}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '2.25rem', height: '2.25rem',
              background: 'none', border: 'none',
              cursor: 'pointer', color: '#fff', padding: '0rem',
            }}
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </button>
        </div>

        {/* Content — mirrors MobileProfilePanel ProfilePanelContent */}
        <div style={{ paddingBottom: '6rem' }}>
          <div className="border-b border-zinc-800">
            <div className="px-3">
              <SXProfileHeader
                className="!pt-0"
                name={initialProfile.name}
                id={ticker}
                picture={initialProfile.photo_url || null}
                avatarHref={`/artist/${encodeURIComponent(ticker)}`}
                index_price={lastLivePrice}
                volume={liveStats.volume_24h}
                total_forecasts={liveStats.total_forecasts}
                market_cap={liveStats.market_cap}
                holders={liveStats.holders}
                change_1h={liveStats.change_1h}
                change_1d={liveStats.change_24h}
                data_points={dataPoints}
                selectedPeriod={selectedPeriod}
                hoverPrice={hoverPrice}
                releases={(profile.releases ?? []) as never[]}
                hiddenReleaseIds={hiddenReleaseIds}
                onToggleRelease={toggleRelease}
                instagram={initialProfile.social_instagram || null}
                twitter={initialProfile.social_x || null}
                tiktok={initialProfile.social_tiktok || null}
                spotify_url={initialProfile.social_spotify || null}
                appleMusic={initialProfile.social_applemusic || null}
                youtube={initialProfile.social_youtube || null}
                twitch={initialProfile.social_twitch || null}
              />
            </div>
            <SXPriceChart
              data={livePriceHistory}
              height={280}
              onPeriodChange={(period: TimePeriod) => setSelectedPeriod(period)}
              initialPeriod={selectedPeriod}
              onHoverValueChange={setHoverPrice}
              releases={visibleReleases as never[]}
              allReleases={(profile.releases ?? []) as never[]}
              hiddenReleaseIds={hiddenReleaseIds}
              onToggleRelease={toggleRelease}
              hideYAxis
            />
            <div className="px-3 py-3">
              <button
                type="button"
                onClick={() => setTradeOpen(true)}
                className="flex w-full items-center justify-center rounded-full bg-white transition-opacity active:opacity-70"
                style={{ height: 48 }}
              >
                <CSXText variant="title" color="STForeground">
                  Trade
                </CSXText>
              </button>
            </div>
            <div className="px-3 py-5 border-t border-zinc-800">
              <SXMarketStatsRow
                totalForecastsUsd={liveStats.total_forecasts}
                volume24hUsd={liveStats.volume_24h}
                holders={liveStats.holders}
                change1h={liveStats.change_1h}
                change24h={liveStats.change_24h}
                change7d={liveStats.change_7d}
              />
            </div>
          </div>

          <MobileTradeDrawer
            isOpen={tradeOpen}
            onClose={() => setTradeOpen(false)}
            spotifyId={ticker}
            profileName={initialProfile.name}
            livePrice={lastLivePrice}
          />

          <div className="px-3">
            <MobileOpenPosition spotifyId={ticker} livePrice={lastLivePrice} />
            <SXOrderbookDetailsAccordion profileName={initialProfile.name} />
            {enriching ? (
              <>
                <AboutSkeleton />
                <div className="pb-4"><WidgetSkeleton /></div>
                <div className="pb-4"><WidgetSkeleton rows={3} /></div>
              </>
            ) : (
              <>
                <SXProfileAbout
                  biography={profile.bio}
                  image_url={profile.photo_url || null}
                  name={profile.name}
                  gallery={(profile.gallery ?? []) as string[]}
                  followers={profile.followers}
                  monthly_listeners={profile.monthly_listeners}
                  top_cities={(profile.top_cities ?? []) as never[]}
                  facebook={profile.social_facebook || null}
                  instagram={profile.social_instagram || null}
                  twitter={profile.social_x || null}
                  tiktok={profile.social_tiktok || null}
                  spotify_id={ticker}
                  industry={profile.industry || null}
                  info_location={profile.info_location || null}
                  info_subcategory={profile.info_subcategory || null}
                  info_active_since={profile.info_active_since || null}
                  info_language={profile.info_language || null}
                  holders={profile.holders}
                  view_count={profile.view_count}
                />
                {(profile.releases?.length ?? 0) > 0 && (
                  <div className="pb-4"><SXReleases releases={(profile.releases ?? []) as never[]} /></div>
                )}
                {(profile.top_tracks?.length ?? 0) > 0 && (
                  <div className="pb-4"><SXTopTracks tracks={(profile.top_tracks ?? []) as never[]} /></div>
                )}
                {(profile.top_cities?.length ?? 0) > 0 && (
                  <div className="pb-4"><SXTopCities cities={(profile.top_cities ?? []) as never[]} /></div>
                )}
                <div className="pb-4"><SXArtistTours events={(profile.events ?? []) as never[]} artistName={profile.name} /></div>
              </>
            )}
            <div id="comments"><CommentSection spotifyId={ticker} /></div>
          </div>
        </div>
      </div>

      {/* Claim modal — rendered outside panel to avoid transform containing block */}
      {claimProfileName && (
        <ClaimModal profileName={claimProfileName} onClose={() => setClaimProfileName(null)} />
      )}
    </>
  )
}
