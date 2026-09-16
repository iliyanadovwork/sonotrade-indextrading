'use client'

import { useRef, useState, useEffect } from 'react'

export type CategoryTagId =
  | 'all'
  | 'trending'
  | 'gainers'
  | 'dips'
  | 'high_volume'
  | 'high_index'
  | 'rising'
  | 'volatile'
  | 'stable'

export type CategorySort = { col: string; dir: 'asc' | 'desc' }

const TAGS: { id: CategoryTagId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'trending', label: 'Trending' },
  { id: 'gainers', label: 'Biggest Gainers' },
  { id: 'dips', label: 'Biggest Dips' },
  { id: 'high_volume', label: 'High Volume' },
  { id: 'high_index', label: 'Top Index' },
  { id: 'rising', label: 'Rising' },
  { id: 'volatile', label: 'Most Volatile' },
  { id: 'stable', label: 'Most Stable' },
]

/** Maps a category tag to a sort column + direction (mirrors /discover). */
export function getCategorySort(tag: CategoryTagId): CategorySort {
  switch (tag) {
    case 'trending':
    case 'high_volume':
      return { col: 'volume', dir: 'desc' }
    case 'gainers':
    case 'rising':
      return { col: 'change_1m', dir: 'desc' }
    case 'dips':
      return { col: 'change_1m', dir: 'asc' }
    // Stability/volatility rank by |change| — a plain change_1m sort made
    // "Most Stable" identical to "Biggest Dips" (all red) and "Most
    // Volatile" identical to "Biggest Gainers". abs_change_1m is a virtual
    // sort the /api/trade + /api/discover routes rank in JS.
    case 'volatile':
      return { col: 'abs_change_1m', dir: 'desc' }
    case 'stable':
      return { col: 'abs_change_1m', dir: 'asc' }
    case 'high_index':
      return { col: 'index_price', dir: 'desc' }
    default:
      return { col: 'index_price', dir: 'desc' }
  }
}

/** Horizontal, scrollable category chip strip — mirrors the /discover tag strip. */
export function SXCategoryTagStrip({
  active,
  onSelect,
}: {
  active: CategoryTagId
  onSelect: (t: CategoryTagId) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(true)

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    setCanLeft(el.scrollLeft > 0)
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1)
  }

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    handleScroll()
    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [])

  const scroll = (dir: 'left' | 'right') =>
    scrollRef.current?.scrollBy({ left: dir === 'right' ? 240 : -240, behavior: 'smooth' })

  return (
    <div className="relative flex items-center">
      {canLeft && (
        <button onClick={() => scroll('left')} className="absolute left-0 z-10 h-full px-2 bg-gradient-to-r from-[rgba(10,10,10,1)] to-transparent text-zinc-400 hover:text-white">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="14" height="14" fill="currentColor"><path d="m9.59 14 6.7 6.7 1.42-1.4-5.3-5.3 5.3-5.3-1.41-1.4L9.59 14Z" /></svg>
        </button>
      )}
      <div ref={scrollRef} onScroll={handleScroll} className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {TAGS.map(t => {
          const isActive = active === t.id
          return (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              className="font-sans m-0 indent-0 p-0 text-[0.8125rem] font-normal leading-normal tracking-[-0.025em] flex items-center gap-1.5 rounded-full px-4 py-[0.4375rem] flex-shrink-0 transition-all duration-150 active:scale-[0.93]"
              style={{
                background: isActive ? '#ffffff' : '#131313',
                color: isActive ? '#000000' : 'var(--st-secondary)',
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>
      {canRight && (
        <button onClick={() => scroll('right')} className="absolute right-0 z-10 h-full px-2 bg-gradient-to-l from-[rgba(10,10,10,1)] to-transparent text-zinc-400 hover:text-white">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="14" height="14" fill="currentColor"><path d="m18.41 14-6.7 6.7-1.42-1.4 5.3-5.3-5.3-5.3 1.41-1.4 6.71 6.7Z" /></svg>
        </button>
      )}
    </div>
  )
}
