'use client'

import { memo, useCallback, useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useIsMobile } from '@/lib/useIsMobile'
import { supabaseImage } from '@/lib/supabaseImage'
import type { SlideProfile } from '@/components/sx/useSXTopGainerSlides'
import { MobileTradeList } from '@/components/home/MobileTradeList'
import { SXTable, TableBody, TableCell, TableCellText, TableHead, TableHeader, TableRow } from '@/components/sx/SXTable'
import { SXSparkline } from '@/components/sx/SXSparkline'
import { SXMarketMovers } from '@/components/sx/SXMarketMovers'
import { SXTopGainerWidget } from '@/components/sx/SXTopGainerWidget'
import { CSXButton } from '@/components/sx/core/CSXButton'
import { CSXText } from '@/components/sx/core/CSXText'
import type { SXColorToken } from '@/components/sx/core/CSXText'
import { SXSidebarProfileList } from '@/components/sx/SXSidebarProfileList'
import { SXFeaturedCards } from '@/components/sx/SXFeaturedCards'
import { SXSearchModal } from '@/components/sx/SXSearchModal'
import { SXDiscoverGrid } from '@/components/sx/SXDiscoverGrid'
import { SXAlbumSlideshow } from '@/components/sx/SXAlbumSlideshow'

import { SXCategoryTagStrip, getCategorySort, type CategoryTagId } from '@/components/sx/SXCategoryTagStrip'
import { fmtVolumeUSD, fmtChange, fmtIndexPrice } from '@/lib/format'
import { ViewToggle } from '@/components/shared/ViewToggle'
import { SortDropdown } from '@/components/shared/SortDropdown'

interface TradeProfile {
  id: string
  name: string
  industry?: string
  info_subcategory?: string | null
  index_price: number | null
  change_1h: number | null
  change_1d: number | null
  change_1w: number | null
  change_1m: number | null
  volume: number | null
  holders?: number | null
  data_points?: Array<{ value: number; price: number; timestamp: number }>
  image_url?: string | null
}

type SortColumn = 'name' | 'index_price' | 'change_1h' | 'change_1d' | 'change_1w' | 'change_1m' | 'volume' | 'holders'

const PAGE_SIZE = 100

/** Fixed column widths for Trade table — `table-fixed` + colgroup keeps layout stable when data changes. */
const TRADE_TABLE_COLGROUP = (
  <colgroup>
    <col style={{ width: '4%' }} />
    <col style={{ width: '22%' }} />
    <col style={{ width: '10%' }} />
    <col style={{ width: '8%' }} />
    <col style={{ width: '8%' }} />
    <col style={{ width: '8%' }} />
    <col style={{ width: '10%' }} />
    <col style={{ width: '8%' }} />
    <col style={{ width: '22%' }} />
  </colgroup>
)

const SORT_OPTIONS: { label: string; col: SortColumn }[] = [
  { label: 'Price',    col: 'index_price' },
  { label: 'Change',   col: 'change_1m' },
  { label: 'Volume',   col: 'volume' },
  { label: 'Holders',  col: 'holders' },
]

const BACKEND_COLUMN_MAP: Record<SortColumn, string> = {
  index_price: 'current_index_value',
  change_1h: 'change_1h',
  change_1d: 'change_1d',
  change_1w: 'change_1w',
  change_1m: 'change_1m',
  name: 'artist_name',
  volume: 'volume',
  holders: 'holders',
}

function changeColorToken(value: number | null): SXColorToken | string {
  if (value === null || value === undefined) return 'STSecondary'
  if (value >= 0) return 'STChartPositive'
  return 'STChartNegative'
}



type SparkPoint = { value: number; timestamp: number }

/**
 * One table row, memoized so per-row work (avatar, four change cells,
 * sparkline SVG) only re-runs when that row's data or sparkline changes —
 * not on every unrelated HomeClient state update (search modal toggle,
 * load-more spinner, etc.) across all 100 rows.
 */
const HomeTableRow = memo(function HomeTableRow({
  a,
  spark,
  onOpen,
}: {
  a: TradeProfile & { rank: number }
  spark: SparkPoint[] | undefined
  onOpen: (id: string) => void
}) {
  return (
    <TableRow className="group relative border-b-0 cursor-pointer hover:bg-transparent [&>td:not(:first-child)]:relative [&>td:not(:first-child)]:z-10" onClick={() => onOpen(a.id)}>

      <TableCell plain className="pl-0 pr-3 text-left tabular-nums whitespace-nowrap">
        <span aria-hidden className="pointer-events-none absolute -inset-x-3 inset-y-0.5 rounded-lg bg-[#131313] opacity-0 transition-opacity group-hover:opacity-100" />
        <span className="relative z-10 text-xs" style={{ fontFamily: 'var(--font-inter)', color: 'var(--st-muted)' }}>{a.rank}</span>
      </TableCell>
      <TableCell plain className="min-w-0 px-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative h-6 w-6 flex-shrink-0">
            <div className="h-6 w-6 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500 text-[0.5rem] font-medium select-none">
              {a.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            {a.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={supabaseImage(a.image_url, 96)}
                alt={a.name}
                className="absolute inset-0 h-6 w-6 rounded-full object-cover"
                loading="lazy"
                decoding="async"
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />
            )}
          </div>
          <div className="min-w-0 flex-1 flex items-center gap-2 overflow-hidden">
            <span className="truncate shrink-0 max-w-[55%]">
              <TableCellText variant="body1" color="STWhite">
                {a.name}
              </TableCellText>
            </span>
            {a.industry && (
              <span className="shrink-0 rounded px-1.5 py-0.5 text-[0.625rem] font-medium leading-none whitespace-nowrap" style={{ background: 'rgba(255,255,255,0.06)', color: '#71717a' }}>
                {a.industry}
              </span>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell className="px-3 text-right tabular-nums whitespace-nowrap"><span style={{ fontFamily: 'var(--font-inter)' }}>{a.index_price != null ? fmtIndexPrice(a.index_price) : '-'}</span></TableCell>
      <TableCell className="px-3 text-right whitespace-nowrap" textColor={changeColorToken(a.change_1d)}>
        <span style={{ fontFamily: 'var(--font-inter)', letterSpacing: '0rem' }}>{fmtChange(a.change_1d)}</span>
      </TableCell>
      <TableCell className="px-3 text-right whitespace-nowrap" textColor={changeColorToken(a.change_1w)}>
        <span style={{ fontFamily: 'var(--font-inter)', letterSpacing: '0rem' }}>{fmtChange(a.change_1w)}</span>
      </TableCell>
      <TableCell className="px-3 text-right whitespace-nowrap" textColor={changeColorToken(a.change_1m)}>
        <span style={{ fontFamily: 'var(--font-inter)', letterSpacing: '0rem' }}>{fmtChange(a.change_1m)}</span>
      </TableCell>
      <TableCell className="px-3 text-right tabular-nums whitespace-nowrap" textColor="STSecondary">
        <span style={{ fontFamily: 'var(--font-inter)' }}>{fmtVolumeUSD(a.volume)}</span>
      </TableCell>
      <TableCell className="px-3 text-right tabular-nums whitespace-nowrap" textColor="STSecondary">
        <span style={{ fontFamily: 'var(--font-inter)' }}>{a.holders != null ? a.holders.toLocaleString('en-US') : '-'}</span>
      </TableCell>
      <TableCell plain className="pl-3 pr-0 text-right pointer-events-none">
        <div style={{ width: '6rem', height: '2rem', marginLeft: 'auto', marginTop: '0.25rem', marginBottom: '0.25rem' }}>
          <SXSparkline
            data={spark ?? []}
            positive={a.change_1w !== null ? a.change_1w >= 0 : undefined}
          />
        </div>
      </TableCell>
    </TableRow>
  )
})

export default function HomeClient({ initialHeroProfile = null }: { initialHeroProfile?: SlideProfile | null }) {
  const router = useRouter()
  const openProfile = useCallback((id: string) => {
    router.push(`/artist/${encodeURIComponent(id)}`)
  }, [router])
  const isMobile = useIsMobile()
  const [profiles, setProfiles] = useState<TradeProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [sortColumn, setSortColumn] = useState<SortColumn>('index_price')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [activeSubcategory, setActiveSubcategory] = useState<string>('all')
  const [activeTag, setActiveTag] = useState<CategoryTagId>('all')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('grid')
  const [sparklines, setSparklines] = useState<Record<string, SparkPoint[]>>({})

  // Single batch call replaces N per-ticker fetches. With PAGE_SIZE=100
  // that's 100 round-trips → 1, plus the batch endpoint sets a 30s
  // public Cache-Control so repeats hit CDN/browser cache.
  const fetchSparklines = async (tickers: string[]) => {
    if (!tickers.length) return
    try {
      // points=48: grid sparklines are 96px wide — 48 points is already
      // sub-2px resolution. Full-res (240pt) series made this response
      // ~1.4MB for 100 artists; thinned it's ~280KB.
      const url = `/api/markets/batch-history?slugs=${tickers.map(encodeURIComponent).join(',')}&window=all&points=48`
      // credentials:'omit' drops the chunked Supabase auth cookies on this
      // request. The endpoint is anonymous (uses SUPABASE_ANON_KEY server-
      // side, doesn't read user session) so cookies aren't needed. Stops
      // CloudFront 431 (Request Header Fields Too Large) when many slugs
      // are bundled into the URL and a freshly-signed-in user's chunked
      // sb-* cookies push total request headers past CloudFront's limit.
      const res = await fetch(url, { credentials: 'omit' })
      if (!res.ok) return
      const map = (await res.json()) as Record<string, { price: number; timestamp: string }[]>
      const mapped: Record<string, SparkPoint[]> = {}
      for (const [ticker, pts] of Object.entries(map)) {
        if (Array.isArray(pts) && pts.length > 0) {
          mapped[ticker] = pts.map(p => ({
            value: p.price,
            timestamp: new Date(p.timestamp).getTime(),
          }))
        }
      }
      setSparklines(prev => ({ ...prev, ...mapped }))
      // TODO(feature): Public Figures grid sparklines — re-enable with grid.
      // setGridSparklines(prev => ({ ...prev, ...mapped }))
    } catch {
      // Non-critical — sparklines just stay empty on failure.
    }
  }

  useEffect(() => {
    setLoading(true)
    setProfiles([])
    setSparklines({})
    setOffset(0)
    setHasMore(true)
    fetchProfiles(0, BACKEND_COLUMN_MAP[sortColumn], sortDirection, activeSubcategory)
  }, [sortColumn, sortDirection, activeSubcategory])

  const fetchProfiles = async (currentOffset: number, sortBy: string, sortDir: 'asc' | 'desc', subcategory: string = 'all') => {
    const subcategoryParam = subcategory !== 'all' ? `&subcategory=${encodeURIComponent(subcategory)}` : ''
    const url = `/api/trade?limit=${PAGE_SIZE}&offset=${currentOffset}&sort_by=${sortBy}&sort_dir=${sortDir}${subcategoryParam}`
    let res: Response | null = null
    for (let attempt = 0; attempt < 4; attempt++) {
      if (attempt > 0) await new Promise(r => setTimeout(r, 1000 * attempt))
      try { res = await fetch(url) } catch { continue }
      if (res.ok) break
      if (res.status !== 429 && res.status < 500) break
    }
    if (!res) {
      // All four attempts threw before getting a response.
      setLoading(false)
      setLoadingMore(false)
      return
    }
    try {
      const data = await res.json()
      if (data.artists) {
        setProfiles(prev => currentOffset === 0 ? data.artists : [...prev, ...data.artists])
        setHasMore(data.artists.length === PAGE_SIZE)
        setOffset(currentOffset + data.artists.length)
        fetchSparklines(data.artists.map((a: TradeProfile) => a.id))
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  const loadMore = () => {
    setLoadingMore(true)
    fetchProfiles(offset, BACKEND_COLUMN_MAP[sortColumn], sortDirection, activeSubcategory)
  }

  // Spotlight (album slideshow + discover cards) is its own result set —
  // fetched once with the default ranking and pinned, so tag/subcategory
  // presses in the forecast section below never reload it.
  const [spotlightProfiles, setSpotlightProfiles] = useState<TradeProfile[]>([])
  const [spotlightLoading, setSpotlightLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/trade?limit=8&offset=0&sort_by=current_index_value&sort_dir=desc`)
      .then(r => r.json())
      .then(data => {
        if (data.artists) {
          setSpotlightProfiles(data.artists.map((a: TradeProfile, i: number) => ({ ...a, rank: i + 1 })))
        }
      })
      .catch(() => {})
      .finally(() => setSpotlightLoading(false))
  }, [])

  const [availableSubcategories, setAvailableSubcategories] = useState<string[]>([])

  useEffect(() => {
    fetch('/api/subcategories')
      .then(r => r.json())
      .then(data => { if (data.subcategories) setAvailableSubcategories(data.subcategories) })
      .catch(() => {})
  }, [])

  const profilesWithRank = useMemo(() => {
    return profiles.map((profile, i) => ({ ...profile, rank: i + 1 }))
  }, [profiles])

  const displayedProfiles = profilesWithRank

  const handleSort = (col: SortColumn) => {
    if (sortColumn === col) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(col)
      setSortDirection('desc')
    }
  }

  const indicator = (col: SortColumn) => sortColumn === col ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ''

  const th = (label: string, col: SortColumn, align: 'text-left' | 'text-right' = 'text-right') => (
    <TableHead
      className={`h-8 px-3 cursor-pointer hover:opacity-80 select-none whitespace-nowrap tabular-nums ${align}`}
      onClick={() => handleSort(col)}
    >
      {label}
      {indicator(col)}
    </TableHead>
  )

  return (
    <main data-nosnippet className="flex flex-1 w-full flex-col bg-[rgb(10,10,10)] text-white pt-0 md:pt-2 pb-20 md:pb-0">
      <div className="w-full max-w-[92.5rem] mx-auto">
      {/* Two-column section */}
      <div className="flex" style={{ minHeight: '26.25rem' }}>
          <div className="flex-1 md:[flex:0_0_73%] min-w-0 flex flex-col md:mr-12">
            <SXTopGainerWidget initialHeroProfile={initialHeroProfile} />
            <div className="px-3 md:px-0">
              <SXFeaturedCards headerTitle="Discover" disableAutoAdvance />
            </div>
          </div>

          {!isMobile && (
            <div className="flex-1 min-w-0 rounded-xl flex flex-col gap-0">
              <SXSidebarProfileList
                title="Biggest gainers"
                subtitle="Last 24 hours"
                sortBy="change_1d"
                sortDir="desc"
                fetchLimit={20}
                displayCount={6}
                className="mb-0"
              />
              <SXMarketMovers displayCount={6} />
            </div>
          )}
      </div>

      {/* Mobile trade list */}
      {isMobile && <div className="px-3">
        <MobileTradeList
          profiles={displayedProfiles}
          sparklines={sparklines}
          loading={loading}
          availableSubcategories={availableSubcategories}
          activeSubcategory={activeSubcategory}
          onSubcategoryChange={(cat) => setActiveSubcategory(cat)}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSortColumnChange={(col) => setSortColumn(col as SortColumn)}
          onSortDirectionChange={setSortDirection}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onLoadMore={loadMore}
        />
      </div>}

      {/* Latest albums slideshow + discover cards (web only) */}
      {!isMobile && (
        <div className="mt-6 md:mt-12">
          <div className="flex items-center justify-between mb-4">
            <div className="flex flex-col gap-0.5">
              <h2 className="m-0 p-0">
                <CSXText variant="subtitle" color="STWhite">Spotlight</CSXText>
              </h2>
              <CSXText variant="body2" color="STSecondary">Latest releases and trending markets</CSXText>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            {/* Near-square (height = 96% of width) sized by its own width —
                keeps the slideshow height stable while the discover cards
                next to it load in. */}
            <div className="flex-[0_0_38%] min-w-0 my-2 mr-3 aspect-[25/24]">
              <SXAlbumSlideshow />
            </div>
            <div className="flex-1 min-w-0">
              <SXDiscoverGrid artists={spotlightProfiles} loading={spotlightLoading} columns={4} />
            </div>
          </div>
        </div>
      )}

      {/* Desktop forecast section */}
      {!isMobile && <div>
      <>
        {/* Header row with search */}
        {(
          <div className="flex items-start mt-6 md:mt-12 justify-between gap-8 mb-4">
            <div className="flex flex-col gap-0.5">
              <h2 className="m-0 p-0">
                <CSXText variant="subtitle" color="STWhite">Forecast</CSXText>
              </h2>
              <CSXText variant="body2" color="STSecondary">All markets on Sonotrade</CSXText>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0 pt-1">
              {/* View toggle */}
              <ViewToggle value={viewMode} onChange={setViewMode} />

              {/* Search */}
              <div
                className="flex cursor-pointer items-center gap-2 rounded-full px-4 py-[0.5625rem]"
                onClick={() => setIsSearchOpen(true)}
                style={{ width: '22.5rem', background: '#131313', color: 'var(--st-secondary)' }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="flex-shrink-0"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <span className="font-sans m-0 indent-0 p-0 text-[0.8125rem] font-normal leading-normal tracking-[-0.025em]">Search markets…</span>
              </div>

              {/* Sort button */}
              <SortDropdown
                options={SORT_OPTIONS}
                column={sortColumn}
                direction={sortDirection}
                defaultColumn="index_price"
                onColumnChange={setSortColumn}
                onDirectionChange={setSortDirection}
              />
            </div>
          </div>
        )}

        {/* Category strip (Trending, Biggest Gainers, …) — drives the sort */}
        <div style={{ marginBottom: '0.75rem' }}>
          <SXCategoryTagStrip
            active={activeTag}
            onSelect={(t) => {
              setActiveTag(t)
              const s = getCategorySort(t)
              setSortColumn(s.col as SortColumn)
              setSortDirection(s.dir)
            }}
          />
        </div>


        {viewMode === 'grid' ? (
          <>
            <SXDiscoverGrid artists={displayedProfiles} loading={loading} columns={7} />
            {!loading && hasMore && (
              <div className="mt-4 w-full">
                <CSXButton
                  variant="outline"
                  size="compact"
                  label={loadingMore ? 'Loading...' : 'Load more'}
                  onClick={loadMore}
                  disabled={loadingMore}
                  textColor="STSecondary"
                  style={{ width: '100%', paddingTop: '0.75rem', paddingBottom: '0.75rem' }}
                />
              </div>
            )}
          </>
        ) : loading ? (
          <div className="border-b border-zinc-800">
            <SXTable variant="bloomberg" className="w-full table-fixed">
              {TRADE_TABLE_COLGROUP}
              <TableHeader className="[&_tr]:border-b-0">
                <TableRow className="border-b-0 hover:bg-zinc-900">
                  <TableHead className="h-8 pl-0 pr-3 text-left tabular-nums whitespace-nowrap">#</TableHead>
                  {th('PUBLIC FIGURE', 'name', 'text-left')}
                  {th('Index', 'index_price')}
                  {th('1D %', 'change_1d')}
                  {th('1W %', 'change_1w')}
                  {th('1M %', 'change_1m')}
                  {th('VOLUME', 'volume')}
                  {th('HOLDERS', 'holders')}
                  <TableHead className="h-8 pl-3 pr-0 text-right whitespace-nowrap">CHART</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 12 }).map((_, i) => (
                  <TableRow key={i} className="border-b-0">
                    <TableCell plain className="pl-0 pr-3 text-left"><div className="h-3 w-4 rounded bg-zinc-800 animate-pulse" /></TableCell>
                    <TableCell plain className="min-w-0 px-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="h-6 w-6 flex-shrink-0 rounded-full bg-zinc-800 animate-pulse" />
                        <div className="h-3 min-w-0 flex-1 rounded bg-zinc-800 animate-pulse" />
                      </div>
                    </TableCell>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j} plain className="px-3 text-right tabular-nums whitespace-nowrap">
                        <div className="ml-auto h-3 rounded bg-zinc-800 animate-pulse" style={{ width: `${40 + (j * 11) % 30}px` }} />
                      </TableCell>
                    ))}
                    <TableCell plain className="pl-3 pr-0 text-right"><div className="w-24 rounded bg-zinc-800 animate-pulse ml-auto" style={{ height: '2rem', marginTop: '0.25rem', marginBottom: '0.25rem' }} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </SXTable>
          </div>
        ) : (
          <>
            <div className="border-b border-zinc-800 bg-[rgb(10,10,10)]">
              <SXTable variant="bloomberg" className="w-full table-fixed">
                {TRADE_TABLE_COLGROUP}
                <TableHeader className="[&_tr]:border-b-0">
                  <TableRow className="border-b-0 hover:bg-zinc-900">
                    <TableHead className="h-8 pl-0 pr-3 text-left tabular-nums whitespace-nowrap">#</TableHead>
                    {th('PUBLIC FIGURE', 'name', 'text-left')}
                    {th('Index', 'index_price')}
                    {th('1D %', 'change_1d')}
                    {th('1W %', 'change_1w')}
                    {th('1M %', 'change_1m')}
                    {th('VOLUME', 'volume')}
                    {th('HOLDERS', 'holders')}
                    <TableHead className="h-8 pl-3 pr-0 text-right whitespace-nowrap">CHART</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profilesWithRank.length === 0 ? (
                    <TableRow className="border-b-0">
                      <TableCell colSpan={8} className="text-center py-8" textColor="STMuted">
                        No market data available
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayedProfiles.map((a) => (
                      <HomeTableRow key={a.id} a={a} spark={sparklines[a.id]} onOpen={openProfile} />
                    ))
                  )}
                </TableBody>
              </SXTable>
            </div>
            {hasMore && (
              <div className="mt-4 w-full">
                <CSXButton
                  variant="outline"
                  size="compact"
                  label={loadingMore ? 'Loading...' : 'Load more'}
                  onClick={loadMore}
                  disabled={loadingMore}
                  textColor="STSecondary"
                  style={{ width: '100%', paddingTop: '0.75rem', paddingBottom: '0.75rem' }}
                />
              </div>
            )}
          </>
        )}
      </>
      </div>}

      </div>
      {!isMobile && <div className="pb-32" />}
      {isSearchOpen && <SXSearchModal onClose={() => setIsSearchOpen(false)} />}
    </main>
  )
}
