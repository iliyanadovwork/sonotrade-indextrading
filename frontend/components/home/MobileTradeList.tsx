'use client'

import { useEffect, useState } from 'react'
import { SXSparkline } from '@/components/sx/SXSparkline'
import { CSXText } from '@/components/sx/core/CSXText'
import { supabaseImage } from '@/lib/supabaseImage'
import { SXCategoryTagStrip, getCategorySort, type CategoryTagId } from '@/components/sx/SXCategoryTagStrip'
import { SortDropdown } from '@/components/shared/SortDropdown'
import { ViewToggle } from '@/components/shared/ViewToggle'
import { useProfilePanel } from '@/context/ProfilePanelContext'
import { TrendArrow } from '@/components/sx/core/TrendArrow'
import { HoldersIcon, formatGridHolders } from '@/components/sx/core/HoldersLabel'
import { fmtVolumeUSD, fmtIndexPrice } from '@/lib/format'


interface TradeProfile {
  id: string
  name: string
  industry?: string | null
  index_price: number | null
  change_1d: number | null
  change_1m: number | null
  change_1w: number | null
  volume: number | null
  holders?: number | null
  image_url?: string | null
}

type SparkPoint = { value: number; timestamp: number }

const SORT_OPTIONS = [
  { label: 'Price',   col: 'index_price' },
  { label: 'Change',  col: 'change_1m' },
  { label: 'Volume',  col: 'volume' },
  { label: 'Holders', col: 'holders' },
]

function fmtVol(v: number | null | undefined): string {
  return `Vol. ${fmtVolumeUSD(v, { decimals: 1, smallDecimals: 0 })}`
}

/* ─── Mobile grid card (matches SXDiscoverGrid GridCard design) ─── */

export interface MobileGridProfile {
  id: string
  name: string
  index_price: number | null
  change_1m: number | null
  volume: number | null
  holders?: number | null
  image_url?: string | null
  /** false = on Spotify but no market yet — opening it lists it first. */
  listed?: boolean
}

function MobileGridCardSkeleton() {
  return (
    <div style={{ padding: '0.5rem' }}>
      <div className="aspect-square w-full rounded-sm bg-[#131313] animate-pulse" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', paddingTop: '0.25rem' }}>
        <div className="h-[1.125rem] w-3/4 rounded bg-[#131313] animate-pulse" />
        <div className="h-3 w-1/2 rounded bg-[#131313] animate-pulse" />
      </div>
    </div>
  )
}

export function MobileGridCard({ artist, index = 0 }: { artist: MobileGridProfile; index?: number }) {
  const { openProfile } = useProfilePanel()
  // Unlisted results open the panel immediately too — MobileProfilePanel
  // detects the missing market, mints it, and shows the glyph loader while
  // the listing completes. Gating the tap on the mint (or on a session, as
  // this used to) made unlisted results feel broken.
  const openArtist = () => openProfile(artist.id)
  const [pressed, setPressed] = useState(false)
  const [visible, setVisible] = useState(false)
  const isPositive = (artist.change_1m ?? 0) >= 0
  const changeColor = `var(--${isPositive ? 'st-positive' : 'st-chart-negative'})`
  const delay = Math.min(index * 40, 500)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
        transition: `opacity 600ms ease-out ${delay}ms, transform 600ms ease-out ${delay}ms`,
        // CSS-only virtualization: offscreen cards skip layout + paint.
        // 'auto 240px' = remembered size once rendered, estimate before.
        contentVisibility: 'auto',
        containIntrinsicSize: 'auto 15rem',
      }}
    >
      <div
        onClick={openArtist}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerLeave={() => setPressed(false)}
        role="link"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter') void openArtist() }}
        style={{
          display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0.5rem',
          cursor: 'pointer', borderRadius: '0.25rem',
          background: pressed ? '#131313' : 'transparent',
          transform: pressed ? 'scale(0.94)' : 'scale(1)',
          transformOrigin: 'center',
          transition: 'background-color 150ms, transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        {/* Square image — the 1M change sits over its bottom-right corner,
            same as the desktop GridCard. */}
        <div className="relative aspect-square w-full overflow-hidden rounded-sm bg-zinc-800">
          {artist.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={supabaseImage(artist.image_url, 96)} alt={artist.name} loading="lazy" decoding="async" className="h-full w-full object-cover" onError={e => { e.currentTarget.style.display = 'none' }} />
          ) : (
            <div className="h-full w-full flex items-center justify-center bg-zinc-800">
              <span className="text-2xl font-semibold text-zinc-500 select-none">{artist.name.charAt(0).toUpperCase()}</span>
            </div>
          )}
          {artist.listed !== false && (
            <>
              <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 35%, rgba(0,0,0,0.65) 100%)' }} />
              <div
                className="absolute flex items-center gap-1 shrink-0"
                style={{ bottom: '0.5rem', right: '0.5rem', zIndex: 10, filter: 'drop-shadow(0 0.125rem 0.375rem rgba(0,0,0,0.9))' }}
              >
                <TrendArrow positive={isPositive} size={11} nudge={false} style={{ alignSelf: 'center', marginTop: '0.0625rem' }} />
                <span className="whitespace-nowrap tabular-nums text-xs" style={{ color: changeColor, fontFamily: 'var(--font-inter)' }}>
                  {Math.abs(artist.change_1m ?? 0).toFixed(2)}%
                </span>
              </div>
            </>
          )}
        </div>
        {/* Text */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
            <div className="truncate" style={{ minWidth: '0rem' }}>
              <CSXText variant="body2Medium" color="STWhite">{artist.name}</CSXText>
            </div>
            <div style={{ flexShrink: 0 }}>
              <CSXText variant="body2Medium" color="STWhite">
                <span style={{ fontFamily: 'var(--font-inter)' }}>
                  {/* No market yet — its index is seeded on tap, so "0.00" here
                      would read as a real (worthless) price. */}
                  {artist.listed === false
                    ? 'Not listed'
                    : artist.index_price != null
                      ? fmtIndexPrice(artist.index_price)
                      : '—'}
                </span>
              </CSXText>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
            {/* Only when we actually have a count — /api/search doesn't return
                one, and "0 holders" there would be a lie rather than a zero. */}
            {artist.holders != null && (
              <CSXText variant="body2" color="STSecondary">
                <span className="flex min-w-0 items-center gap-1" style={{ fontFamily: 'var(--font-inter)' }}>
                  <HoldersIcon />
                  <span className="truncate">{formatGridHolders(artist.holders)}</span>
                </span>
              </CSXText>
            )}
            <CSXText variant="body3" color="STMuted">
              {artist.listed === false ? 'Tap to start trading' : fmtVol(artist.volume)}
            </CSXText>
          </div>
        </div>
      </div>
    </div>
  )
}

export function MobileGrid({ profiles, loading }: { profiles: MobileGridProfile[]; loading: boolean }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', columnGap: '0rem', rowGap: '0.375rem', width: '100%', boxSizing: 'border-box' }}>
      {loading
        ? Array.from({ length: 10 }).map((_, i) => <MobileGridCardSkeleton key={i} />)
        : profiles.map((a, i) => <MobileGridCard key={a.id} artist={a} index={i} />)
      }
    </div>
  )
}

/* ─── List view ─── */

function ArtistRowSkeleton() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem 0', borderBottom: '1px solid #1a1a1a' }}>
      <div style={{ width: '2.625rem', height: '2.625rem', borderRadius: '50%', background: '#1e1e1e', flexShrink: 0 }} className="animate-pulse" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        <div style={{ height: '0.875rem', width: '7.5rem', borderRadius: '0.25rem', background: '#1e1e1e' }} className="animate-pulse" />
        <div style={{ height: '0.6875rem', width: '4.5rem', borderRadius: '0.25rem', background: '#1e1e1e' }} className="animate-pulse" />
      </div>
      <div style={{ width: '5rem', height: '1.875rem', borderRadius: '0.25rem', background: '#1e1e1e', marginRight: '0.5rem' }} className="animate-pulse" />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3125rem' }}>
        <div style={{ height: '0.875rem', width: '2.75rem', borderRadius: '0.25rem', background: '#1e1e1e' }} className="animate-pulse" />
        <div style={{ height: '0.6875rem', width: '3.25rem', borderRadius: '0.25rem', background: '#1e1e1e' }} className="animate-pulse" />
      </div>
    </div>
  )
}

function ArtistRow({ artist, sparkline }: { artist: TradeProfile; sparkline?: SparkPoint[] }) {
  const { openProfile } = useProfilePanel()
  const isPositive = (artist.change_1d ?? 0) >= 0
  const changeColor = isPositive ? 'var(--st-positive)' : 'var(--st-chart-negative)'

  return (
    <div
      onClick={() => openProfile(artist.id)}
      style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem 0', borderBottom: '1px solid #1a1a1a', cursor: 'pointer' }}
    >
      <div style={{ width: '2.625rem', height: '2.625rem', borderRadius: '50%', background: '#1e1e1e', flexShrink: 0, position: 'relative', overflow: 'hidden', border: '1px solid #2a2a2a' }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.625rem', color: '#52525b', fontWeight: 600 }}>
          {artist.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
        </div>
        {artist.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={supabaseImage(artist.image_url, 384)} alt={artist.name} loading="lazy" decoding="async" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.currentTarget.style.display = 'none' }} />
        )}
      </div>

      <div style={{ flex: 1, minWidth: '0rem', display: 'flex', flexDirection: 'column', gap: '0.1875rem' }}>
        <span style={{ fontFamily: 'var(--font-geist-sans)', fontSize: '0.9375rem', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.015em' }}>
          {artist.name}
        </span>
        <span style={{ fontFamily: 'var(--font-inter)', fontSize: '0.75rem', color: '#71717a' }}>
          {fmtVol(artist.volume)}
        </span>
      </div>

      <div style={{ width: '5rem', height: '1.875rem', flexShrink: 0, marginRight: '0.5rem' }}>
        <SXSparkline
          data={
            sparkline && sparkline.length > 0
              ? sparkline
              : artist.index_price != null
                ? [{ value: artist.index_price, timestamp: 0 }, { value: artist.index_price, timestamp: 1 }]
                : []
          }
          positive={isPositive}
          style={{ width: '5rem', height: '1.875rem' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem', flexShrink: 0 }}>
        <span style={{ fontFamily: 'var(--font-inter)', fontSize: '0.9375rem', fontWeight: 600, color: '#fff' }}>
          {artist.index_price != null ? fmtIndexPrice(artist.index_price) : '—'}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.1875rem' }}>
          <TrendArrow positive={isPositive} size={13} nudge={false} />
          <span style={{ fontFamily: 'var(--font-inter)', fontSize: '0.75rem', fontWeight: 500, color: changeColor }}>
            {artist.change_1d != null ? `${Math.abs(artist.change_1d).toFixed(2)}%` : '—'}
          </span>
        </div>
      </div>
    </div>
  )
}

/* ─── Main component ─── */

interface MobileTradeListProps {
  profiles: TradeProfile[]
  sparklines: Record<string, SparkPoint[]>
  loading: boolean
  availableSubcategories: string[]
  activeSubcategory: string
  onSubcategoryChange: (cat: string) => void
  sortColumn: string
  sortDirection: 'asc' | 'desc'
  onSortColumnChange: (col: string) => void
  onSortDirectionChange: (dir: 'asc' | 'desc') => void
  viewMode: 'table' | 'grid'
  onViewModeChange: (mode: 'table' | 'grid') => void
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
}

export function MobileTradeList({
  profiles, sparklines, loading,
  onSubcategoryChange,
  sortColumn, sortDirection, onSortColumnChange, onSortDirectionChange,
  viewMode, onViewModeChange,
  hasMore, loadingMore, onLoadMore,
}: MobileTradeListProps) {
  const [activeTag, setActiveTag] = useState<CategoryTagId>('all')
  return (
    <div style={{ marginTop: '1.75rem' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <div className="flex flex-col gap-0.5">
          <h2 className="m-0 p-0">
            <CSXText variant="subtitle" color="STWhite">Forecast</CSXText>
          </h2>
          <CSXText variant="body2" color="STSecondary">All markets on Sonotrade</CSXText>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', paddingTop: '0.125rem', flexShrink: 0 }}>
          <SortDropdown
            options={SORT_OPTIONS}
            column={sortColumn}
            direction={sortDirection}
            defaultColumn="index_price"
            onColumnChange={onSortColumnChange}
            onDirectionChange={onSortDirectionChange}
            triggerStyle={{ padding: '0.609375rem 0.625rem', lineHeight: '0.875rem' }}
          />
          {/* List / Grid toggle — same theme as desktop */}
          <ViewToggle value={viewMode} onChange={onViewModeChange} />
        </div>
      </div>

      {/* Category strip (Trending, Biggest Gainers, …) — drives the sort */}
      <div style={{ marginBottom: '0.625rem' }}>
        <SXCategoryTagStrip
          active={activeTag}
          onSelect={(t) => {
            setActiveTag(t)
            if (t === 'all') onSubcategoryChange('all')
            const s = getCategorySort(t)
            onSortColumnChange(s.col)
            onSortDirectionChange(s.dir)
          }}
        />
      </div>


      {/* Content */}
      {viewMode === 'grid' ? (
        <div style={{ marginTop: '0.5rem', marginLeft: '-0.25rem', marginRight: '-0.25rem' }}>
          <MobileGrid profiles={profiles} loading={loading} />
        </div>
      ) : (
        <div style={{ marginTop: '0.5rem' }}>
          {loading
            ? Array.from({ length: 10 }).map((_, i) => <ArtistRowSkeleton key={i} />)
            : profiles.map(a => <ArtistRow key={a.id} artist={a} sparkline={sparklines[a.id]} />)
          }
        </div>
      )}

      {/* Load more */}
      {!loading && hasMore && (
        <button
          onClick={onLoadMore}
          disabled={loadingMore}
          style={{
            width: '100%', marginTop: '1rem', padding: '0.875rem 0',
            border: '1px solid #2a2a2a', borderRadius: '0.625rem',
            background: 'transparent', color: '#71717a',
            fontFamily: 'var(--font-geist-sans)', fontSize: '0.875rem', fontWeight: 500,
            cursor: loadingMore ? 'not-allowed' : 'pointer',
          }}
        >
          {loadingMore ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  )
}
