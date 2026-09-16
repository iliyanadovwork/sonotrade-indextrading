'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SXSectionHeading } from './SXSectionHeading'
import { CSXText } from './core/CSXText'
import { cn } from './utils'
import { fetchJsonDeduped } from '@/lib/fetch-dedup'
import { supabaseImage } from '@/lib/supabaseImage'
import { TrendArrow } from './core/TrendArrow'
import { fmtIndexPrice } from '@/lib/format'

export interface SidebarListProfile {
  id: string
  name: string
  industry?: string
  index_price: number | null
  change_1d: number | null
  change_1m: number | null
  data_points?: Array<{ value: number; price: number; timestamp: number }>
  image_url?: string | null
}

function ProfileRow({
  profile,
  change,
}: {
  profile: SidebarListProfile
  change: number | null
}) {
  const router = useRouter()
  const changeColor =
    change == null ? 'STSecondary' : change >= 0 ? 'STPositive' : 'STChartNegative'

  return (
    <button
      type="button"
      onClick={() => router.push(`/artist/${encodeURIComponent(profile.id)}`)}
      className="group relative w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-zinc-600 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(10,10,10)] transition-transform duration-100 active:scale-[0.96]"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-x-3 inset-y-0.5 rounded-lg bg-[#131313] opacity-0 transition-opacity group-hover:opacity-100"
      />
      <span className="relative z-10 flex w-full items-center gap-3 py-3">
        {profile.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={supabaseImage(profile.image_url, 96)}
            alt={profile.name}
            width={36}
            height={36}
            loading="lazy"
            decoding="async"
            className="h-9 w-9 flex-shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="h-8 w-8 flex-shrink-0 rounded-full bg-zinc-700" />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-px">
          <div className="min-w-0 truncate">
            <CSXText variant="subtitle2" color="STWhite">
              {profile.name}
            </CSXText>
          </div>
          <CSXText variant="body2" color="STSecondary">
            Index
          </CSXText>
        </div>
        <div className="flex gap-2 flex-shrink-0 flex-col items-end text-right">
          <CSXText variant="body2" color="STSecondary">
            <span style={{ fontFamily: 'var(--font-inter)' }}>{profile.index_price !== null
              ? fmtIndexPrice(profile.index_price)
              : '—'}</span>
          </CSXText>
          {change !== null ? (
            <div className="flex items-center gap-1">
              <TrendArrow positive={change >= 0} />
              <span className="text-xs font-medium leading-none tracking-[-0.025em] tabular-nums" style={{ color: `var(--${change >= 0 ? 'st-positive' : 'st-chart-negative'})`, fontFamily: 'var(--font-inter)' }}>
                {Math.abs(change).toFixed(2)}%
              </span>
            </div>
          ) : (
            <CSXText variant="cardPriceChange" color="STSecondary">—</CSXText>
          )}
        </div>
      </span>
    </button>
  )
}

function ProfileRowSkeleton() {
  return (
    <div className="flex w-full items-center gap-3 py-3">
      <div className="h-9 w-9 flex-shrink-0 animate-pulse rounded-full bg-zinc-900" />
      <div className="flex min-w-0 flex-1 flex-col gap-px">
        <div className="h-[1.125rem] mt-[0.1875rem] mb-[0.1875rem] w-28 animate-pulse rounded bg-zinc-900" />
        <div className="h-[0.75rem] mt-[0.1875rem] mb-[0.1875rem] w-12 animate-pulse rounded bg-zinc-900" />
      </div>
      <div className="flex flex-col items-end gap-px">
        <div className="h-[1.125rem] mt-[0.1875rem] mb-[0.1875rem] w-16 animate-pulse rounded bg-zinc-900" />
        <div className="h-[0.75rem] mt-[0.1875rem] mb-[0.1875rem] w-10 animate-pulse rounded bg-zinc-900" />
      </div>
    </div>
  )
}

const TRADE_API = '/api/trade'

export type SXSidebarProfileListProps = {
  title: string
  subtitle: string
  sortBy: 'change_1d' | 'change_1m' | 'volume'
  sortDir?: 'asc' | 'desc'
  /** Max rows returned from API (default 8). */
  fetchLimit?: number
  /** Rows to render after load. */
  displayCount: number
  className?: string
  /** Dotted rule below the list (e.g. biggest gainers block). */
  bottomDivider?: boolean
}

export function SXSidebarProfileList({
  title,
  subtitle,
  sortBy,
  sortDir = 'desc',
  fetchLimit = 15,
  displayCount,
  className,
  bottomDivider,
}: SXSidebarProfileListProps) {
  const [profiles, setProfiles] = useState<SidebarListProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const dirRef = useRef<'left' | 'right'>('right')
  const [animKey, setAnimKey] = useState(0)

  useEffect(() => {
    const q = new URLSearchParams({
      limit: String(fetchLimit),
      offset: '0',
      sort_by: sortBy,
      sort_dir: sortDir,
    })
    const url = `${TRADE_API}?${q.toString()}`
    fetchJsonDeduped<{ artists?: SidebarListProfile[] }>(url)
      .then(data => {
        if (data.artists) setProfiles(data.artists)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [fetchLimit, sortBy, sortDir])

  const totalPages = Math.ceil(profiles.length / displayCount)
  const startIdx = page * displayCount
  const rows = profiles.slice(startIdx, startIdx + displayCount)

  const go = (next: number, dir: 'left' | 'right') => {
    dirRef.current = dir
    setPage(next)
    setAnimKey(k => k + 1)
  }

  return (
    <div className={cn('flex flex-col', className)} style={bottomDivider ? { borderBottom: '1px solid #27272a' } : undefined}>
      <style>{`
        @keyframes sidebar-slide-right { from { transform: translateX(24px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes sidebar-slide-left  { from { transform: translateX(-24px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .sidebar-slide-right { animation: sidebar-slide-right 0.25s cubic-bezier(0.25,0.46,0.45,0.94) both; }
        .sidebar-slide-left  { animation: sidebar-slide-left  0.25s cubic-bezier(0.25,0.46,0.45,0.94) both; }
      `}</style>

      <div className="flex items-center justify-between mb-3">
        <SXSectionHeading title={title} subtitle={subtitle} className="pb-0" />
        {!loading && totalPages > 1 && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              aria-label="Previous page"
              disabled={page === 0}
              onClick={() => go(page - 1, 'left')}
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
                <path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
              </svg>
            </button>
            <span style={{ fontSize: '0.75rem', color: 'var(--st-muted)', fontFamily: 'var(--font-geist-sans)', minWidth: '2rem', textAlign: 'center' }}>
              {page + 1} of {totalPages}
            </span>
            <button
              aria-label="Next page"
              disabled={page >= totalPages - 1}
              onClick={() => go(page + 1, 'right')}
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
                <path d="M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
              </svg>
            </button>
          </div>
        )}
      </div>

      <div
        key={animKey}
        className={cn(
          'flex flex-col',
          dirRef.current === 'right' ? 'sidebar-slide-right' : 'sidebar-slide-left'
        )}
      >
        {loading
          ? Array.from({ length: displayCount }).map((_, i) => <ProfileRowSkeleton key={i} />)
          : rows.map(a => <ProfileRow key={a.id} profile={a} change={a.change_1d} />)}
      </div>
    </div>
  )
}
