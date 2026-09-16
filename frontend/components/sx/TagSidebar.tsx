'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { CSXText } from './core/CSXText'
import { useTagContext } from './TagProvider'
import { TAG_GROUPS } from '@/lib/tagGroups'

export { TAG_GROUPS }

const S = 13

const ALL_MARKETS_ICON = (
  <svg xmlns="http://www.w3.org/2000/svg" width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect width="7" height="7" x="3" y="3" rx="1" /><rect width="7" height="7" x="14" y="3" rx="1" /><rect width="7" height="7" x="14" y="14" rx="1" /><rect width="7" height="7" x="3" y="14" rx="1" />
  </svg>
)

const INDUSTRY_ICONS: Record<string, React.ReactNode> = {
  'Streamer':      <svg xmlns="http://www.w3.org/2000/svg" width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>,
  'Politician':    <svg xmlns="http://www.w3.org/2000/svg" width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>,
  'Entrepreneur':  <svg xmlns="http://www.w3.org/2000/svg" width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="12" y1="2" x2="12" y2="22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
  'Commentator':   <svg xmlns="http://www.w3.org/2000/svg" width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
  'Influencer':    <svg xmlns="http://www.w3.org/2000/svg" width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>,
  'YouTuber':      <svg xmlns="http://www.w3.org/2000/svg" width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z" /><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" /></svg>,
  'Podcaster':     <svg xmlns="http://www.w3.org/2000/svg" width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>,
  'Comedian':      <svg xmlns="http://www.w3.org/2000/svg" width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /></svg>,
  'Musician':      <svg xmlns="http://www.w3.org/2000/svg" width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>,
  'Athlete':       <svg xmlns="http://www.w3.org/2000/svg" width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M4.93 4.93 19.07 19.07" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>,
  'Actor':         <svg xmlns="http://www.w3.org/2000/svg" width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  'Entertainment': <svg xmlns="http://www.w3.org/2000/svg" width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>,
  'Media':          <svg xmlns="http://www.w3.org/2000/svg" width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>,
  'Rapper':         <svg xmlns="http://www.w3.org/2000/svg" width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>,
  'Public Speaker': <svg xmlns="http://www.w3.org/2000/svg" width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
}

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round"
      style={{ transition: 'transform 200ms ease-out', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

interface SubcategoryListProps {
  subs: string[]
  selectedSubcategory: string | null
  setSelectedSubcategory: (sub: string | null) => void
}

function SubcategoryList({ subs, selectedSubcategory, setSelectedSubcategory }: SubcategoryListProps) {
  return (
    <div className="flex flex-col gap-px pb-1">
      {subs.map(sub => {
        const isActiveSub = selectedSubcategory === sub
        return (
          <button
            key={sub}
            onClick={() => setSelectedSubcategory(isActiveSub ? null : sub)}
            className={`flex h-9 w-full items-center rounded-full pr-4 text-left transition-colors duration-150 ${
              isActiveSub
                ? 'bg-white/[0.06] text-white'
                : 'hover:bg-white/[0.04] hover:text-white'
            }`}
          >
            <span className="text-xs font-medium" style={{ position: 'relative', top: '0.0625rem', paddingLeft: '2.3125rem' }}>{sub}</span>
          </button>
        )
      })}
    </div>
  )
}

interface CategoryGroupProps {
  primary: string
  industries: string[]
  count: number
  subs: string[]
  href: string
  pathname: string
  selectedSubcategory: string | null
  setSelectedSubcategory: (sub: string | null) => void
  isExpanded: boolean
  setExpandedCategory: (cat: string | null) => void
}

function CategoryGroup({ primary, industries, count, subs, href, pathname, selectedSubcategory, setSelectedSubcategory, isExpanded, setExpandedCategory }: CategoryGroupProps) {
  const active = industries.some(ind => pathname === `/tag/${encodeURIComponent(ind)}`)
  const activeNoSub = active && !selectedSubcategory

  return (
    <div>
      <div className={`flex items-center rounded-full transition-colors duration-200 ease-out ${
        activeNoSub ? 'bg-white/[0.08]' : 'hover:bg-white/[0.08]'
      }`}>
        <Link
          href={href}
          onClick={() => { setSelectedSubcategory(null); setExpandedCategory(primary) }}
          className={`flex flex-1 h-12 items-center gap-3 pl-3 pr-1 outline-none min-w-0 ${
            activeNoSub ? 'text-white' : 'hover:text-white'
          }`}
        >
          {INDUSTRY_ICONS[primary] && <span className="shrink-0">{INDUSTRY_ICONS[primary]}</span>}
          <CSXText variant="body2Medium" color={activeNoSub ? 'STWhite' : 'STSecondary'}>
            <span style={{ position: 'relative', top: '0.0625rem' }}>
              {primary}{count != null && <span className="tabular-nums" style={{ color: '#52525b', marginLeft: '0.25rem', fontSize: '0.625rem', verticalAlign: 'middle' }}>({count.toLocaleString()})</span>}
            </span>
          </CSXText>
        </Link>
        {subs.length > 0 && (
          <button
            onClick={() => setExpandedCategory(isExpanded ? null : primary)}
            className={`flex h-12 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${
              isExpanded ? 'text-white' : 'hover:text-white'
            }`}
            aria-label={isExpanded ? `Collapse ${primary}` : `Expand ${primary}`}
          >
            <ChevronDown open={isExpanded} />
          </button>
        )}
      </div>

      <div
        className={`grid transition-all duration-300 ease-in-out ${isExpanded && subs.length > 0 ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
        aria-hidden={!isExpanded}
      >
        <div className="overflow-hidden">
          <SubcategoryList subs={subs} selectedSubcategory={selectedSubcategory} setSelectedSubcategory={setSelectedSubcategory} />
        </div>
      </div>
    </div>
  )
}

export function TagSidebar() {
  const pathname = usePathname()
  const { selectedSubcategory, setSelectedSubcategory } = useTagContext()

  const categoryFromPath = pathname.startsWith('/tag/') ? decodeURIComponent(pathname.slice(5)) : 'all'
  const isAll = categoryFromPath === 'all'
  const categoryGroup = TAG_GROUPS.find(g => g.includes(categoryFromPath))
  const categoryPrimary = categoryGroup?.[0] ?? categoryFromPath

  const [expandedCategory, setExpandedCategory] = useState<string | null>(isAll ? null : categoryPrimary)
  const [subsByIndustry, setSubsByIndustry] = useState<Record<string, string[]>>({})
  const [industryCounts, setIndustryCounts] = useState<Record<string, number>>({})
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [atTop, setAtTop] = useState(true)
  const [atBottom, setAtBottom] = useState(false)
  const navRef = useRef<HTMLElement | null>(null)

  // Fetch once on mount — this component persists across navigations
  useEffect(() => {
    fetch('/api/subcategories?grouped=true')
      .then(r => r.json())
      .then(data => { if (data.byIndustry) setSubsByIndustry(data.byIndustry) })
      .catch(() => {})
    fetch('/api/industry-counts')
      .then(r => r.json())
      .then(data => {
        if (data.counts) setIndustryCounts(data.counts)
        if (data.total != null) setTotalCount(data.total)
      })
      .catch(() => {})
  }, [])

  // Sync expanded tab and reset subcategory when the URL category changes
  const prevCategoryRef = useRef(categoryFromPath)
  useEffect(() => {
    if (prevCategoryRef.current === categoryFromPath) return
    prevCategoryRef.current = categoryFromPath
    setSelectedSubcategory(null)
    setExpandedCategory(isAll ? null : categoryPrimary)
  }, [categoryFromPath, categoryPrimary, isAll, setSelectedSubcategory])

  // Build merged display items
  const displayItems = (() => {
    if (Object.keys(industryCounts).length === 0) return []
    const consumed = new Set<string>()
    const items: { primary: string; industries: string[]; count: number; subs: string[] }[] = []

    for (const group of TAG_GROUPS) {
      const present = group.filter(ind => ind in industryCounts)
      if (present.length === 0) continue
      present.forEach(ind => consumed.add(ind))
      const count = present.reduce((sum, ind) => sum + (industryCounts[ind] ?? 0), 0)
      const allSubs = [...new Set(present.flatMap(ind => subsByIndustry[ind] ?? []))]
      items.push({ primary: present[0], industries: present, count, subs: allSubs })
    }

    for (const ind of Object.keys(industryCounts).sort()) {
      if (!consumed.has(ind)) {
        items.push({ primary: ind, industries: [ind], count: industryCounts[ind] ?? 0, subs: subsByIndustry[ind] ?? [] })
      }
    }

    return items.sort((a, b) => a.primary.localeCompare(b.primary))
  })()

  useEffect(() => {
    const nav = navRef.current
    if (!nav) return
    const check = () => {
      const canScroll = nav.scrollHeight > nav.clientHeight + 1
      setAtTop(nav.scrollTop <= 1)
      setAtBottom(!canScroll || nav.scrollHeight - nav.scrollTop <= nav.clientHeight + 1)
    }
    check()
    nav.addEventListener('scroll', check, { passive: true })
    const ro = new ResizeObserver(check)
    ro.observe(nav)
    return () => {
      nav.removeEventListener('scroll', check)
      ro.disconnect()
    }
  }, [])

  return (
    <aside style={{ position: 'sticky', top: '6.25rem', alignSelf: 'flex-start' }} className="w-[13.75rem] flex-shrink-0 pr-6 pt-8 relative">
      <nav ref={navRef} className="flex w-full flex-col gap-0.5 py-1 overflow-y-auto [&::-webkit-scrollbar]:hidden" style={{ maxHeight: 'calc(100vh - 8.75rem)', scrollbarWidth: 'none', color: 'var(--st-secondary)' }}>

        <Link
          href="/tag/all"
          onClick={() => { setSelectedSubcategory(null); setExpandedCategory(null) }}
          className={`flex h-12 w-full shrink-0 items-center gap-3 rounded-full pl-3 pr-4 outline-none transition-colors duration-200 ease-out ${
            pathname === '/tag/all'
              ? 'bg-white/[0.08] text-white'
              : 'hover:bg-white/[0.08] hover:text-white'
          }`}
        >
          <span className="shrink-0">{ALL_MARKETS_ICON}</span>
          <CSXText variant="body2Medium" color={pathname === '/tag/all' ? 'STWhite' : 'STSecondary'}>
            <span style={{ position: 'relative', top: '0.0625rem' }}>
              All Markets{totalCount != null && <span className="tabular-nums" style={{ color: '#52525b', marginLeft: '0.25rem', fontSize: '0.625rem', verticalAlign: 'middle' }}>({totalCount.toLocaleString()})</span>}
            </span>
          </CSXText>
        </Link>

        {displayItems.map(({ primary, industries, count, subs }) => {
          const href = `/tag/${encodeURIComponent(primary)}`
          return (
            <CategoryGroup
              key={href}
              primary={primary}
              industries={industries}
              count={count}
              subs={subs}
              href={href}
              pathname={pathname}
              selectedSubcategory={selectedSubcategory}
              setSelectedSubcategory={setSelectedSubcategory}
              isExpanded={expandedCategory === primary}
              setExpandedCategory={setExpandedCategory}
            />
          )
        })}
      </nav>
      <div className="pointer-events-none absolute top-0 left-0 right-0 h-16 transition-opacity duration-200" style={{ background: 'linear-gradient(to top, transparent, rgb(10,10,10))', opacity: atTop ? 0 : 1 }} />
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-16 transition-opacity duration-200" style={{ background: 'linear-gradient(to bottom, transparent, rgb(10,10,10))', opacity: atBottom ? 0 : 1 }} />
    </aside>
  )
}
