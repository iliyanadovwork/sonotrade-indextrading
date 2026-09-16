'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { CSXText } from './core/CSXText'
import { TrendArrow } from './core/TrendArrow'
import { HoldersIcon, formatGridHolders } from './core/HoldersLabel'
import type { SXColorToken } from './core/sx-color-tokens'
import { SXTable, TableBody, TableCell, TableCellText, TableHead, TableHeader, TableRow } from './SXTable'
import { fmtVolumeUSD, fmtChange, fmtIndexPrice } from '@/lib/format'
import { supabaseImage } from '@/lib/supabaseImage'


interface Profile {
  id: string
  name: string
  industry?: string
  info_subcategory?: string | null
  index_price: number | null
  change_1m: number | null
  volume: number | null
  holders?: number | null
  image_url?: string | null
}

function GridCard({ artist, index = 0 }: { artist: Profile; index?: number }) {
  const router = useRouter()
  const isPositive = (artist.change_1m ?? 0) >= 0
  const changeColor = `var(--${isPositive ? 'st-positive' : 'st-chart-negative'})`
  const [pressed, setPressed] = useState(false)
  const [visible, setVisible] = useState(false)

  // Saved (bookmarked) markets — shared with the featured cards via the same
  // localStorage key so a save persists across surfaces and reloads.
  const [isSaved, setIsSaved] = useState(false)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('pauv:savedMarkets')
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot hydrate from localStorage
      if (raw) setIsSaved((JSON.parse(raw) as string[]).includes(artist.id))
    } catch { /* ignore */ }
  }, [artist.id])
  const toggleSaved = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    try {
      const raw = localStorage.getItem('pauv:savedMarkets')
      const set = new Set(raw ? (JSON.parse(raw) as string[]) : [])
      if (set.has(artist.id)) set.delete(artist.id)
      else set.add(artist.id)
      localStorage.setItem('pauv:savedMarkets', JSON.stringify([...set]))
      setIsSaved(set.has(artist.id))
    } catch { /* ignore */ }
  }

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <li className="w-full" style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(20px)',
      transition: `opacity 600ms ease-out ${Math.min(index * 40, 500)}ms, transform 600ms ease-out ${Math.min(index * 40, 500)}ms`,
      // CSS-only virtualization: offscreen cards skip layout + paint.
      contentVisibility: 'auto',
      // Estimate for offscreen (content-visibility) cards. MUST track the real
      // rendered card height (~244.5px = 17rem @ the 14.4px root): Safari uses
      // this estimate for every offscreen row while Chrome lays out the real
      // box, so an inaccurate value here makes the PAGE HEIGHT differ between
      // engines (was 'auto 21.25rem' = the old 340px, ~61px/row too tall ->
      // Safari pages ran ~257px taller than Chrome).
      containIntrinsicSize: 'auto 17rem',
    }}>
      <div
        className="group flex flex-col gap-1 p-2 cursor-pointer hover:bg-[#131313] rounded md:rounded-lg"
        style={{ transition: 'background-color 150ms, transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1)', transform: pressed ? 'scale(0.94)' : 'scale(1)', transformOrigin: 'center' }}
        onClick={() => router.push(`/artist/${encodeURIComponent(artist.id)}`)}
        role="link" tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter') router.push(`/artist/${encodeURIComponent(artist.id)}`) }}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerLeave={() => setPressed(false)}
      >
        <div className="relative w-full">
          <div className="relative aspect-square w-full overflow-hidden rounded-sm md:rounded-lg bg-zinc-800">
            {artist.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={supabaseImage(artist.image_url, 384)} alt={artist.name} loading="lazy" decoding="async" className="h-full w-full object-cover transition-all duration-200 ease-out" />
            ) : (
              <div className="h-full w-full flex items-center justify-center bg-zinc-800">
                <span className="text-2xl font-semibold text-zinc-500 select-none">{artist.name.charAt(0).toUpperCase()}</span>
              </div>
            )}
            <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 35%, rgba(0,0,0,0.65) 100%)' }} />
            <button
              type="button"
              aria-label={isSaved ? 'Remove from saved' : 'Save'}
              aria-pressed={isSaved}
              onClick={toggleSaved}
              className={`hover:bg-zinc-800 transition-[opacity,background-color] duration-200 cursor-pointer absolute top-2 right-2 ${isSaved ? '' : 'opacity-0 group-hover:opacity-100'}`}
              style={{ cursor: 'pointer', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.4)', borderRadius: '50%', padding: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isSaved ? '#ffffff' : '#a1a1aa', zIndex: 20, filter: 'drop-shadow(0 0.125rem 0.5rem rgba(0,0,0,0.9))' }}
            >
              <svg viewBox="0 0 24 24" width={12.6} height={12.6} fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            </button>
            <div
              className="absolute flex items-center gap-1 shrink-0"
              style={{ bottom: '0.5rem', right: '0.5rem', zIndex: 10, filter: 'drop-shadow(0 0.125rem 0.375rem rgba(0,0,0,0.9))' }}
            >
              <TrendArrow positive={isPositive} />
              <span className="whitespace-nowrap tabular-nums text-xs" style={{ color: changeColor, fontFamily: 'var(--font-inter)' }}>
                {Math.abs(artist.change_1m ?? 0).toFixed(2)}%
              </span>
            </div>
          </div>
        </div>
        <div className="flex w-full flex-col gap-0.5 pt-0.5">
          <div className="flex items-center justify-between gap-2">
            <div className="truncate min-w-0">
              <CSXText variant="body2Medium" color="STWhite">{artist.name}</CSXText>
            </div>
            <div className="shrink-0">
              <CSXText variant="body2Medium" color="STWhite">
                <span style={{ fontFamily: 'var(--font-inter)' }}>
                  {artist.index_price !== null ? fmtIndexPrice(artist.index_price) : '—'}
                </span>
              </CSXText>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <CSXText variant="body2" color="STSecondary">
              <span className="flex min-w-0 items-center gap-1" style={{ fontFamily: 'var(--font-inter)' }}>
                <HoldersIcon />
                <span className="truncate">{formatGridHolders(artist.holders)}</span>
              </span>
            </CSXText>
            <CSXText variant="body3" color="STMuted">{`Vol. ${fmtVolumeUSD(artist.volume, { decimals: 1, smallDecimals: 0 })}`}</CSXText>
          </div>
        </div>
      </div>
    </li>
  )
}

const SKELETON_ROWS = 2

function GridSkeleton() {
  return (
    <li className="w-full">
      <div className="flex flex-col gap-1 p-2">
        <div className="aspect-square w-full rounded-sm bg-[#131313] animate-pulse" />
        <div className="flex flex-col gap-0.5 pt-0.5">
          <div className="h-[1.125rem] mt-[0.1875rem] mb-[0.1875rem] w-3/4 rounded bg-[#131313] animate-pulse" />
          <div className="h-[0.75rem] mt-[0.1875rem] mb-[0.1875rem] w-1/2 rounded bg-[#131313] animate-pulse" />
        </div>
      </div>
    </li>
  )
}


function changeColor(value: number | null): SXColorToken {
  if (value === null || value === undefined) return 'STSecondary'
  if (value >= 0) return 'STChartPositive'
  return 'STChartNegative'
}

export function SXDiscoverGrid({
  subcategory,
  filterSubcategory,
  sortBy = 'current_index_value',
  sortDir = 'desc',
  limit = 100,
  artists: externalProfiles,
  loading: externalLoading,
  viewMode = 'grid',
  leadingSlot,
  columns,
}: {
  subcategory?: string
  filterSubcategory?: string
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  limit?: number
  artists?: Profile[]
  loading?: boolean
  viewMode?: 'grid' | 'table'
  /** Optional element rendered as the first grid cell, spanning 3×2 (e.g. a slideshow). */
  leadingSlot?: ReactNode
  /** Fixed number of columns. When omitted, the grid auto-fills based on a 176px min width. */
  columns?: number
}) {
  const router = useRouter()
  const [internalProfiles, setInternalProfiles] = useState<Profile[]>([])
  const [internalLoading, setInternalLoading] = useState(true)
  const isExternal = externalProfiles !== undefined

  useEffect(() => {
    if (isExternal) return
    setInternalLoading(true)
    setInternalProfiles([])
    const base = `/api/trade?limit=${limit}&offset=0&sort_by=${sortBy}&sort_dir=${sortDir}`
    let url: string
    if (filterSubcategory) {
      url = `${base}&subcategory=${encodeURIComponent(filterSubcategory)}`
    } else {
      url = subcategory ? `${base}&category=${encodeURIComponent(subcategory)}` : base
    }
    fetch(url)
      .then(r => r.json())
      .then(data => { if (data.artists) setInternalProfiles(data.artists) })
      .catch(console.error)
      .finally(() => setInternalLoading(false))
  }, [subcategory, filterSubcategory, sortBy, sortDir, limit, isExternal])

  const profiles = isExternal ? externalProfiles! : internalProfiles
  const loading = isExternal ? (externalLoading ?? false) : internalLoading
  const showSkeletons = loading
  // Two rows of the actual grid. `columns` is fixed for the Spotlight (4) and
  // the forecast list (7); the auto-fill variant has no column count to read,
  // so it keeps a flat estimate.
  const skeletonCount = columns ? columns * SKELETON_ROWS : 20
  const gridKey = subcategory ?? '__all__'

  if (viewMode === 'table') {
    return (
      <div key={gridKey} className="border-b border-zinc-800">
        <SXTable variant="bloomberg" className="w-full table-fixed">
          <colgroup>
            <col style={{ width: '4%' }} />
            <col style={{ width: '32%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '16%' }} />
          </colgroup>
          <TableHeader>
            <TableRow className="border-zinc-800 hover:bg-[#131313]">
              <TableHead className="h-8 pl-0 pr-3 text-center tabular-nums whitespace-nowrap">#</TableHead>
              <TableHead className="h-8 px-3 text-left whitespace-nowrap">PUBLIC FIGURE</TableHead>
              <TableHead className="h-8 px-3 text-right whitespace-nowrap">Index</TableHead>
              <TableHead className="h-8 px-3 text-right whitespace-nowrap">1M %</TableHead>
              <TableHead className="h-8 px-3 text-right whitespace-nowrap">VOLUME</TableHead>
              <TableHead className="h-8 pl-3 pr-0 text-right whitespace-nowrap">HOLDERS</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {showSkeletons
              ? Array.from({ length: 12 }).map((_, i) => (
                <TableRow key={i} className="border-zinc-800">
                  <TableCell plain className="pl-0 pr-3 text-center"><div className="h-3 w-4 rounded bg-zinc-800 animate-pulse mx-auto" /></TableCell>
                  <TableCell plain className="px-3"><div className="flex items-center gap-3"><div className="h-6 w-6 rounded-full bg-zinc-800 animate-pulse flex-shrink-0" /><div className="h-3 flex-1 rounded bg-zinc-800 animate-pulse" /></div></TableCell>
                  {Array.from({ length: 4 }).map((_, j) => (
                    <TableCell key={j} plain className={`text-right ${j === 3 ? 'pl-3 pr-0' : 'px-3'}`}><div className="ml-auto h-3 w-16 rounded bg-zinc-800 animate-pulse" /></TableCell>
                  ))}
                </TableRow>
              ))
              : profiles.length === 0
              ? (
                <TableRow className="border-zinc-800">
                  <TableCell colSpan={6} className="text-center py-8" textColor="STMuted">No results found</TableCell>
                </TableRow>
              )
              : profiles.map((a, i) => (
                <TableRow key={a.id} className="border-zinc-800 hover:bg-[#131313] cursor-pointer" onClick={() => router.push(`/artist/${encodeURIComponent(a.id)}`)}>
                  <TableCell className="pl-0 pr-3 text-center tabular-nums whitespace-nowrap" textColor="STMuted">
                    <span style={{ fontFamily: 'var(--font-inter)' }}>{i + 1}</span>
                  </TableCell>
                  <TableCell plain className="min-w-0 px-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="relative h-6 w-6 flex-shrink-0">
                        <div className="h-6 w-6 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500 text-[0.5rem] font-medium select-none">
                          {a.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        {a.image_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={supabaseImage(a.image_url, 96)} alt={a.name} loading="lazy" decoding="async" className="absolute inset-0 h-6 w-6 rounded-full object-cover" onError={e => { e.currentTarget.style.display = 'none' }} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 flex items-center gap-2 overflow-hidden">
                        <span className="truncate shrink-0 max-w-[55%]">
                          <TableCellText variant="body1" color="STWhite">{a.name}</TableCellText>
                        </span>
                        {a.industry && (
                          <span className="shrink-0 rounded px-1.5 py-0.5 text-[0.625rem] font-medium leading-none whitespace-nowrap" style={{ background: 'rgba(255,255,255,0.06)', color: '#71717a' }}>{a.industry}</span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-3 text-right tabular-nums whitespace-nowrap">
                    <span style={{ fontFamily: 'var(--font-inter)' }}>{a.index_price != null ? fmtIndexPrice(a.index_price) : '-'}</span>
                  </TableCell>
                  <TableCell className="px-3 text-right whitespace-nowrap" textColor={changeColor(a.change_1m)}>
                    <span style={{ fontFamily: 'var(--font-inter)' }}>{fmtChange(a.change_1m)}</span>
                  </TableCell>
                  <TableCell className="px-3 text-right tabular-nums whitespace-nowrap" textColor="STSecondary">
                    <span style={{ fontFamily: 'var(--font-inter)' }}>{fmtVolumeUSD(a.volume)}</span>
                  </TableCell>
                  <TableCell className="pl-3 pr-0 text-right tabular-nums whitespace-nowrap" textColor="STSecondary">
                    <span style={{ fontFamily: 'var(--font-inter)' }}>{a.holders != null ? (a.holders as number).toLocaleString('en-US') : '-'}</span>
                  </TableCell>
                </TableRow>
              ))
            }
          </TableBody>
        </SXTable>
      </div>
    )
  }

  return (
    <ul key={loading ? `${gridKey}-loading` : gridKey} className="-mx-2 m-0 list-none p-0 grid gap-2" style={{ gridTemplateColumns: columns ? `repeat(${columns}, minmax(0, 1fr))` : 'repeat(auto-fill, minmax(11rem, 1fr))' }}>
      {showSkeletons
        ? Array.from({ length: skeletonCount }).map((_, i) => <GridSkeleton key={i} />)
        : profiles.length === 0 && !loading
        ? (
          <li className="col-span-full py-16 text-center">
            <CSXText variant="body2" color="STSecondary">No results found</CSXText>
          </li>
        )
        : (
          <>
            {leadingSlot && (
              <li style={{ gridColumn: 'span 3', gridRow: 'span 2', minHeight: '25rem' }}>
                <div className="p-2" style={{ height: '100%' }}>{leadingSlot}</div>
              </li>
            )}
            {profiles.map((a, i) => <GridCard key={a.id} artist={a} index={i} />)}
          </>
        )
      }
    </ul>
  )
}
