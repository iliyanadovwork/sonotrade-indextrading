'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useProfilePanel } from '@/context/ProfilePanelContext'
import { SXProfileHeader } from '@/components/sx/SXProfileHeader'
import { SXPriceChart, type TimePeriod } from '@/components/sx/SXPriceChart'
import { useArtistRefresh } from '@/lib/use-artist-refresh'
import { MobileOpenPosition } from '@/components/mobile/MobileOpenPosition'
import SXOrderbookDetailsAccordion, { ClaimModal } from '@/components/sx/SXOrderbookDetailsAccordion'
import { SXProfileAbout } from '@/components/sx/SXProfileAbout'
import { CommentSection } from '@/components/comments/CommentSection'
import { SXReleases } from '@/components/sx/SXReleases'
import { SXTopTracks } from '@/components/sx/SXTopTracks'
import { SXTopCities } from '@/components/sx/SXTopCities'
import { SXArtistTours } from '@/components/sx/SXArtistTours'
import { SXMarketStatsRow } from '@/components/sx/SXMarketStatsRow'
import { MobileTradeDrawer } from '@/components/mobile/MobileTradeDrawer'
import { useLivePriceHistory } from '@/lib/hooks/useLivePriceHistory'
import { useLiveMarketStats } from '@/lib/hooks/useLiveMarketStats'
import type { Profile } from '@/lib/types'
import { ensureArtistListed } from '@/lib/list-artist'
import { SXPageLoading } from '@/components/sx/SXPageLoading'
import { CSXText } from '@/components/sx/core/CSXText'

const SLIDE_MS = 320

/** Post-mint refetch cadence: the market row is inserted synchronously by
    /api/artists/list, so the first refetch usually succeeds — the retries only
    cover a stale CDN-cached miss on /api/profile. */
const MINT_POLL_MS = 800
const MINT_POLL_MAX = 8

function ProfilePanelContent({ profile, ticker }: { profile: Profile; ticker: string }) {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('ALL')
  const [hoverPrice, setHoverPrice] = useState<number | null>(null)
  const [hiddenReleaseIds, setHiddenReleaseIds] = useState<string[]>([])

  useArtistRefresh(ticker)
  const [tradeOpen, setTradeOpen] = useState(false)

  const initialChartHistory = useMemo(
    () =>
      (profile.price_history ?? []).map(p => ({
        price: p.price,
        timestamp: p.t,
      })),
    [profile.price_history]
  )

  const livePriceHistory = useLivePriceHistory(
    ticker,
    profile.id,
    selectedPeriod,
    initialChartHistory
  )
  const lastLivePrice = livePriceHistory.length > 0
    ? livePriceHistory[livePriceHistory.length - 1]!.price
    : profile.price

  const liveStats = useLiveMarketStats(ticker, profile.id, {
    price:           profile.price,
    change_1h:       profile.change_1h,
    change_24h:      profile.change_24h,
    change_7d:       profile.change_7d,
    volume_24h:      profile.volume_24h,
    total_forecasts: profile.total_forecasts,
    holders:         profile.holders,
    market_cap:      profile.market_cap,
  }, lastLivePrice)

  // Release markers on the chart's x-axis. These were hardcoded to [] here, so
  // albums/singles showed on the full artist page but never in this panel —
  // which is what most mobile users actually open (tapping a card on home).
  const visibleReleases = useMemo(
    () => ((profile.releases ?? []) as Array<{ id: string }>).filter(r => !hiddenReleaseIds.includes(r.id)),
    [profile.releases, hiddenReleaseIds]
  )

  const toggleRelease = (id: string) =>
    setHiddenReleaseIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )

  const dataPoints = livePriceHistory.flatMap(p => {
    const d = new Date(p.timestamp)
    return isNaN(d.getTime()) ? [] : [{ index: p.price, timestamp: d.toISOString() }]
  })

  return (
    <div>
      <div className="border-b border-zinc-800">
        <div className="px-3">
          <SXProfileHeader
            className="!pt-0"
            name={profile.name}
            id={ticker}
            picture={profile.photo_url || null}
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
            releases={visibleReleases as never[]}
            hiddenReleaseIds={hiddenReleaseIds}
            onToggleRelease={toggleRelease}
            instagram={profile.social_instagram || null}
            twitter={profile.social_x || null}
            tiktok={profile.social_tiktok || null}
            spotify_url={profile.social_spotify || null}
            appleMusic={profile.social_applemusic || null}
            youtube={profile.social_youtube || null}
            twitch={profile.social_twitch || null}
          />
        </div>
        <SXPriceChart
          data={livePriceHistory}
          height={300}
          onPeriodChange={(period: TimePeriod) => setSelectedPeriod(period)}
          initialPeriod={selectedPeriod}
          onHoverValueChange={setHoverPrice}
          releases={visibleReleases as never[]}
          allReleases={(profile.releases ?? []) as never[]}
          hiddenReleaseIds={hiddenReleaseIds}
          onToggleRelease={toggleRelease}
          hideYAxis
        />
      </div>
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
      <div className="px-3 pt-4 pb-4 border-b border-zinc-800">
        <SXMarketStatsRow
          totalForecastsUsd={liveStats.total_forecasts}
          volume24hUsd={liveStats.volume_24h}
          holders={liveStats.holders}
          change1h={liveStats.change_1h}
          change24h={liveStats.change_24h}
          change7d={liveStats.change_7d}
        />
      </div>
      <MobileTradeDrawer
        isOpen={tradeOpen}
        onClose={() => setTradeOpen(false)}
        spotifyId={ticker}
        profileName={profile.name}
        livePrice={lastLivePrice}
      />
      <div className="px-3">
        <MobileOpenPosition
          spotifyId={ticker}
          livePrice={lastLivePrice}
        />
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
        <SXOrderbookDetailsAccordion profileName={profile.name} onClaimOpen={() => {}} />
        {(profile.releases?.length ?? 0) > 0 && (
          <div className="pb-0"><SXReleases releases={(profile.releases ?? []) as never[]} /></div>
        )}
        {(profile.top_tracks?.length ?? 0) > 0 && (
          <div className="pb-0"><SXTopTracks tracks={(profile.top_tracks ?? []) as never[]} /></div>
        )}
        {(profile.top_cities?.length ?? 0) > 0 && (
          <div className="pb-0"><SXTopCities cities={(profile.top_cities ?? []) as never[]} /></div>
        )}
        {(profile.events?.length ?? 0) > 0 && (
          <div className="pb-0"><SXArtistTours events={(profile.events ?? []) as never[]} artistName={profile.name} /></div>
        )}
        <div id="comments"><CommentSection spotifyId={ticker} /></div>
      </div>
    </div>
  )
}

function PanelSkeleton() {
  return (
    <div>
      <div className="border-b border-zinc-800">
        {/* Header — mirrors SXProfileHeader (pt-2 pb-8, flex-col gap-4) */}
        <div className="px-3 pt-2 pb-8 flex flex-col gap-4 animate-pulse">
          {/* Row 1: avatar + name + social icons */}
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-zinc-800 flex-shrink-0" />
            <div className="h-5 w-44 rounded bg-zinc-800" />
            <div className="h-4 w-4 rounded bg-zinc-800 flex-shrink-0" />
            <div className="h-4 w-4 rounded bg-zinc-800 flex-shrink-0" />
          </div>
          {/* Row 2: price + "points" */}
          <div className="flex items-center gap-2">
            <div className="h-7 w-20 rounded bg-zinc-800" />
            <div className="h-5 w-14 rounded bg-zinc-800" />
          </div>
          {/* Row 3: % change + raw change */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded bg-zinc-800 flex-shrink-0" />
              <div className="h-4 w-14 rounded bg-zinc-800" />
            </div>
            <div className="h-4 w-14 rounded bg-zinc-800" />
          </div>
        </div>

        {/* Chart — full width, 320px (h-80) */}
        <div className="h-80 w-full bg-zinc-900 animate-pulse" />

        {/* Period tabs — real elements, not placeholders */}
        <div className="flex items-center justify-between px-3 py-6">
          <div className="flex items-center gap-6">
            {(['1H', '1D', '1W', '1M', 'ALL'] as const).map((p, i) => (
              <CSXText key={p} variant="body2" color={i === 4 ? 'STWhite' : 'STMuted'}>
                {p}
              </CSXText>
            ))}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/sonotrade_glyph_square_transparent.png"
            alt="Sonotrade"
            draggable={false}
            style={{ height: '1.125rem', width: 'auto', filter: 'grayscale(1)', opacity: 0.3, userSelect: 'none' }}
          />
        </div>
      </div>

      {/* About section */}
      <div className="px-3 pt-4 flex flex-col gap-3 animate-pulse">
        <div className="flex items-center justify-between py-6">
          <div className="h-5 w-14 rounded bg-zinc-800" />
          <div className="h-4 w-4 rounded bg-zinc-800" />
        </div>
        <div className="h-3 w-full rounded bg-zinc-800" />
        <div className="h-3 w-full rounded bg-zinc-800" />
        <div className="h-3 w-4/5 rounded bg-zinc-800" />
        <div className="h-3 w-3/4 rounded bg-zinc-800" />
        <div className="flex flex-wrap gap-2 mt-1">
          {[88, 128, 64, 72].map((w, i) => (
            <div key={i} className="h-6 rounded-md bg-zinc-800" style={{ width: w }} />
          ))}
        </div>
      </div>
    </div>
  )
}

export function MobileProfilePanel() {
  const { activeId, closeProfile } = useProfilePanel()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(false)
  // Minting a market for an unlisted search result — shows the self-drawing
  // glyph (same loader as app/loading.tsx) instead of the panel skeleton.
  const [minting, setMinting] = useState(false)
  const [fetchError, setFetchError] = useState(false)
  const [shouldRender, setShouldRender] = useState(false)
  const [isExiting, setIsExiting] = useState(false)
  const prevIdRef = useRef<string | null>(null)
  const [claimProfileName, setClaimProfileName] = useState<string | null>(null)

  useEffect(() => {
    const handler = (e: Event) => {
      const name = (e as CustomEvent<{ profileName: string }>).detail.profileName
      setClaimProfileName(name)
    }
    window.addEventListener('pauv:claimProfile', handler)
    return () => window.removeEventListener('pauv:claimProfile', handler)
  }, [])
  // Open / close lifecycle
  useEffect(() => {
    if (activeId) {
      setIsExiting(false)
      setShouldRender(true)
      prevIdRef.current = activeId
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    } else if (prevIdRef.current) {
      // activeId was cleared — trigger exit animation then unmount
      setIsExiting(true)
      document.body.style.overflow = ''
      const t = setTimeout(() => {
        setShouldRender(false)
        setIsExiting(false)
        prevIdRef.current = null
      }, SLIDE_MS)
      return () => clearTimeout(t)
    }
  }, [activeId])

  const handleClose = useCallback(() => {
    closeProfile()
  }, [closeProfile])

  // Fetch profile whenever activeId changes. An id with no profile is an
  // unlisted search result: mint its market in place (glyph loader up while
  // that runs) instead of erroring — the panel must open for ANY artist the
  // search surfaces, signed in or not, same as the web artist page.
  useEffect(() => {
    if (!activeId) { setProfile(null); setFetchError(false); setMinting(false); return }
    let cancelled = false
    setLoading(true)
    setProfile(null)
    setFetchError(false)
    setMinting(false)

    // slim=true drops the embedded price_history (~60KB/tap) — the chart
    // fetches its ≤240-point series from /api/markets/[ticker]/history via
    // useLivePriceHistory's empty-seed self-heal.
    // The cache-buster matters on the post-mint refetches: /api/profile sends
    // `s-maxage=30`, so the pre-mint empty response is CDN-cached and would
    // otherwise be served back verbatim after the row exists.
    const fetchProfile = async (bustCache: boolean): Promise<Profile | null> => {
      try {
        const bust = bustCache ? `&t=${Date.now()}` : ''
        const r = await fetch(`/api/profile/${encodeURIComponent(activeId)}?slim=true${bust}`, bustCache ? { cache: 'no-store' } : undefined)
        const data = await r.json()
        // price_history already arrives in the canonical { price, t } shape
        // (historyFromDataPoints in lib/data.ts) — pass it through untouched.
        return (data.profile as Profile) ?? null
      } catch {
        return null
      }
    }

    ;(async () => {
      const existing = await fetchProfile(false)
      if (cancelled) return
      setLoading(false)
      if (existing) { setProfile(existing); return }

      setMinting(true)
      const minted = await ensureArtistListed(activeId)
      if (cancelled) return
      if (!minted.ok) { setMinting(false); setFetchError(true); return }
      for (let i = 0; i < MINT_POLL_MAX; i++) {
        const p = await fetchProfile(true)
        if (cancelled) return
        if (p) { setProfile(p); setMinting(false); return }
        await new Promise(r => setTimeout(r, MINT_POLL_MS))
        if (cancelled) return
      }
      setMinting(false)
      setFetchError(true)
    })()

    return () => { cancelled = true }
  }, [activeId])

  if (!shouldRender) return null

  return (
    <>
      <style>{`.profile-panel-scroll::-webkit-scrollbar{display:none}.profile-panel-scroll{scrollbar-width:none}`}</style>

      <div
        className="profile-panel-scroll"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: 'rgb(10,10,10)',
          overflowY: 'auto',
          overflowX: 'hidden',
          willChange: 'transform',
          animation: isExiting
            ? `profilePanelOut ${SLIDE_MS}ms cubic-bezier(0.55,0,1,0.45) forwards`
            : `profilePanelIn ${SLIDE_MS}ms cubic-bezier(0.16,1,0.3,1) forwards`,
        }}
      >
        {/* Back button */}
        <div
          style={{
            position: 'sticky',
            top: '0rem',
            zIndex: 10,
            background: 'rgb(10,10,10)',
            display: 'flex',
            alignItems: 'center',
            paddingTop: 'max(env(safe-area-inset-top), 0.75rem)',
            paddingBottom: '0.5rem',
            paddingLeft: '0rem',
            paddingRight: '0.75rem',
          }}
        >
          <button
            onClick={handleClose}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '2.25rem', height: '2.25rem',
              background: 'none', border: 'none',
              cursor: 'pointer', color: '#fff', padding: '0rem',
            }}
            aria-label="Go back"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div style={{ paddingBottom: '6rem' }}>
          {loading && <PanelSkeleton />}
          {minting && <SXPageLoading minHeightClassName="min-h-[70vh]" aria-label="Listing artist" />}
          {!loading && !minting && fetchError && (
            <div className="flex flex-col items-center justify-center gap-3 px-6 pt-20">
              <CSXText variant="body2" color="STSecondary">
                Failed to load profile. Please try again.
              </CSXText>
              <button
                onClick={handleClose}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <CSXText variant="body2" color="STSecondary">Go back</CSXText>
              </button>
            </div>
          )}
          {!loading && profile && (
            <ProfilePanelContent profile={profile} ticker={activeId ?? prevIdRef.current ?? ''} />
          )}
        </div>
      </div>

      {/* Claim modal — sibling of the panel div, same pattern as AuthModal in MobileHeader */}
      {claimProfileName && (
        <ClaimModal profileName={claimProfileName} onClose={() => setClaimProfileName(null)} />
      )}
    </>
  )
}
