'use client'

import { useParams } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { CSXText } from '@/components/sx/core/CSXText'
import { SXDiscoverGrid } from '@/components/sx/SXDiscoverGrid'
import { useTagContext } from '@/components/sx/TagProvider'
import { TAG_GROUPS } from '@/components/sx/TagSidebar'
import { ViewToggle } from '@/components/shared/ViewToggle'
import { SXSearchModal } from '@/components/sx/SXSearchModal'

const SORT_OPTIONS = [
  { label: 'Price',    value: 'current_index_value' },
  { label: 'Change',   value: 'change_1m' },
  { label: 'Volume',   value: 'volume' },
  { label: 'Holders',  value: 'holders' },
] as const
type SortValue = typeof SORT_OPTIONS[number]['value']

export default function TagPage() {
  const params = useParams()
  const { selectedSubcategory } = useTagContext()

  const category = decodeURIComponent(params.category as string)
  const isAll = category === 'all'
  const categoryGroup = TAG_GROUPS.find(g => g.includes(category))
  const categoryPrimary = categoryGroup?.[0] ?? category
  const categoryFilter = categoryGroup ? categoryGroup.join(',') : category

  const [sortBy, setSortBy] = useState<SortValue>('current_index_value')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [sortOpen, setSortOpen] = useState(false)
  const sortRef = useRef<HTMLDivElement>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    if (!sortOpen) return
    const handler = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [sortOpen])

  const heading = selectedSubcategory ?? (isAll ? 'All Markets' : categoryPrimary)

  return (
    <div className="flex-1 min-w-0 border-l border-st-border pl-8 pt-8 md:pt-2 pb-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="m-0 p-0">
          <CSXText variant="subtitle" color="STWhite">{heading}</CSXText>
        </h2>

        <div className="flex items-center gap-2 flex-shrink-0">
          <ViewToggle value={viewMode} onChange={setViewMode} />

          <div
            className="flex cursor-pointer items-center gap-2 rounded-full border border-zinc-800 bg-transparent px-4 py-[0.5625rem]"
            onClick={() => setSearchOpen(true)}
            style={{ width: '13.75rem', color: 'var(--st-secondary)' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0" aria-hidden="true">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span className="font-sans m-0 indent-0 p-0 text-[0.8125rem] font-normal leading-normal tracking-[-0.025em]">Search markets…</span>
          </div>

          <div ref={sortRef} className="relative flex-shrink-0">
          <button
            onClick={() => setSortOpen(o => !o)}
            className="font-sans m-0 indent-0 p-0 text-[0.8125rem] font-normal leading-normal tracking-[-0.025em] flex items-center gap-1.5 rounded-full border border-zinc-800 px-4 py-[0.5625rem] hover:border-zinc-600 hover:text-white transition-colors active:scale-[0.93]"
            style={{ color: 'var(--st-secondary)' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 6h18M7 12h10M11 18h2" />
            </svg>
            Sort{sortBy !== 'current_index_value' && <span style={{ color: '#a1a1aa' }}>: {SORT_OPTIONS.find(o => o.value === sortBy)?.label}</span>}
          </button>

          {sortOpen && (
            <div className="absolute right-0 top-full mt-1.5 z-50 min-w-[10rem] rounded-lg border border-zinc-800 bg-black py-1 shadow-xl">
              <p className="px-4 pt-1 pb-1 text-[0.625rem] font-medium uppercase tracking-widest text-zinc-600" style={{ fontFamily: 'var(--font-geist-sans)' }}>Sort by</p>
              {SORT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setSortBy(opt.value)}
                  className={`flex w-full items-center px-4 py-2 text-sm transition-colors ${
                    sortBy === opt.value ? 'text-white bg-white/[0.06]' : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                  }`}
                  style={{ fontFamily: 'var(--font-geist-sans)' }}
                >
                  {opt.label}
                  {sortBy === opt.value && (
                    <svg className="ml-auto" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </button>
              ))}
              <div className="my-1 border-t border-zinc-800" />
              <p className="px-4 pt-1 pb-1 text-[0.625rem] font-medium uppercase tracking-widest text-zinc-600" style={{ fontFamily: 'var(--font-geist-sans)' }}>Order</p>
              {(['desc', 'asc'] as const).map(dir => (
                <button
                  key={dir}
                  onClick={() => { setSortDir(dir); setSortOpen(false) }}
                  className={`flex w-full items-center px-4 py-2 text-sm transition-colors ${
                    sortDir === dir ? 'text-white bg-white/[0.06]' : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                  }`}
                  style={{ fontFamily: 'var(--font-geist-sans)' }}
                >
                  {dir === 'desc' ? 'Descending' : 'Ascending'}
                  {sortDir === dir && (
                    <svg className="ml-auto" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        </div>
      </div>

      <SXDiscoverGrid
        subcategory={isAll ? undefined : categoryFilter}
        filterSubcategory={selectedSubcategory && !isAll ? selectedSubcategory : undefined}
        sortBy={sortBy}
        sortDir={sortDir}
        limit={100}
        viewMode={viewMode}
      />

      {searchOpen && <SXSearchModal onClose={() => setSearchOpen(false)} />}
    </div>
  )
}
