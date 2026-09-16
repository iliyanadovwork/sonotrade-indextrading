'use client'

import { useEffect, useLayoutEffect, useRef, useState, useMemo } from 'react'
import { MobileGrid, MobileGridProfile } from '@/components/home/MobileTradeList'
import { SXCategoryTagStrip, getCategorySort, type CategoryTagId } from '@/components/sx/SXCategoryTagStrip'
import { SortDropdown, SortOption } from '@/components/shared/SortDropdown'
import { TAG_GROUPS } from '@/lib/tagGroups'
import { preloadImage } from '@/lib/imageCache'

// ── Icons (same as TagSidebar) ───────────────────────────────────────────────
const S = 13
const ALL_MARKETS_ICON = (
  <svg xmlns="http://www.w3.org/2000/svg" width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>
  </svg>
)
const INDUSTRY_ICONS: Record<string, React.ReactNode> = {
  'Streamer':      <svg xmlns="http://www.w3.org/2000/svg" width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>,
  'Politician':    <svg xmlns="http://www.w3.org/2000/svg" width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  'Entrepreneur':  <svg xmlns="http://www.w3.org/2000/svg" width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  'Influencer':    <svg xmlns="http://www.w3.org/2000/svg" width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>,
  'Podcaster':     <svg xmlns="http://www.w3.org/2000/svg" width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>,
  'Comedian':      <svg xmlns="http://www.w3.org/2000/svg" width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>,
  'Musician':      <svg xmlns="http://www.w3.org/2000/svg" width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>,
  'Athlete':       <svg xmlns="http://www.w3.org/2000/svg" width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M4.93 4.93 19.07 19.07"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
  'Actor':         <svg xmlns="http://www.w3.org/2000/svg" width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  'Entertainment': <svg xmlns="http://www.w3.org/2000/svg" width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>,
  'Media':         <svg xmlns="http://www.w3.org/2000/svg" width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
  'Rapper':        <svg xmlns="http://www.w3.org/2000/svg" width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>,
  'Public Speaker':<svg xmlns="http://www.w3.org/2000/svg" width={S} height={S} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
}

interface BrowseProfile extends MobileGridProfile {
  industry?: string | null
}

const SORT_OPTIONS: SortOption<string>[] = [
  { label: 'Price',  col: 'index_price' },
  { label: 'Change', col: 'change_1m' },
  { label: 'Volume', col: 'volume' },
]

interface SearchDrawerProps {
  isOpen: boolean
  onClose: () => void
  initialCategory?: string
}

// ── Sidebar category list (markup intentionally distinct from TagSidebar) ────
interface SubcategoryListProps {
  primary: string
  subs: string[]
  activeCategory: string
  onSelect: (cat: string) => void
}

function SubcategoryList({ primary, subs, activeCategory, onSelect }: SubcategoryListProps) {
  return (
    <div className="flex flex-col gap-px pb-1">
      {subs.map(sub => (
        <button
          key={`${primary}-${sub}`}
          onClick={() => { onSelect(sub) }}
          className="flex h-9 w-full items-center rounded-full pr-4 text-left transition-colors duration-150"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: activeCategory === sub ? '#fff' : '#71717a' }}
        >
          <span style={{ fontFamily: 'var(--font-geist-sans)', fontSize: '0.75rem', fontWeight: 500, position: 'relative', top: '0.0625rem', paddingLeft: '2.3125rem' }}>{sub}</span>
        </button>
      ))}
    </div>
  )
}

interface CategoryGroupProps {
  primary: string
  industries: string[]
  count: number
  subs: string[]
  activeCategory: string
  isExpanded: boolean
  onSelect: (cat: string) => void
  onToggleExpand: () => void
}

function CategoryGroup({ primary, industries: inds, count, subs, activeCategory, isExpanded, onSelect, onToggleExpand }: CategoryGroupProps) {
  const active = inds.includes(activeCategory)
  return (
    <div>
      <div className="flex items-center rounded-full transition-colors duration-200 ease-out" style={{ background: active ? 'rgba(255,255,255,0.08)' : 'transparent' }}>
        <button
          onClick={() => onSelect(inds[0]!)}
          className="flex flex-1 h-12 items-center gap-3 pl-3 pr-1 outline-none min-w-0"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: active ? '#fff' : '#71717a' }}
        >
          {INDUSTRY_ICONS[primary] && <span className="shrink-0">{INDUSTRY_ICONS[primary]}</span>}
          <span style={{ fontFamily: 'var(--font-geist-sans)', fontSize: '0.875rem', fontWeight: 500, position: 'relative', top: '0.0625rem', minWidth: '0rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {primary}
            <span className="tabular-nums" style={{ color: '#52525b', marginLeft: '0.25rem', fontSize: '0.625rem', verticalAlign: 'middle' }}>({count})</span>
          </span>
        </button>
        {subs.length > 0 && (
          <button
            onClick={onToggleExpand}
            className="flex h-12 w-9 shrink-0 items-center justify-center rounded-full transition-colors"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: isExpanded ? '#fff' : '#71717a' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 200ms ease-out', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}>
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </button>
        )}
      </div>
      <div
        className={`grid transition-all duration-300 ease-in-out ${isExpanded && subs.length > 0 ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
        aria-hidden={!isExpanded}
      >
        <div className="overflow-hidden">
          <SubcategoryList primary={primary} subs={subs} activeCategory={activeCategory} onSelect={onSelect} />
        </div>
      </div>
    </div>
  )
}

export function SearchDrawer({ isOpen, onClose, initialCategory }: SearchDrawerProps) {
  const [shouldRender, setShouldRender] = useState(false)
  const [visible, setVisible] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<MobileGridProfile[] | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [activeCategory, setActiveCategory] = useState('all')
  const [activeTag, setActiveTag] = useState<CategoryTagId>('all')
  const [sortColumn, setSortColumn] = useState('index_price')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [browseProfiles, setBrowseProfiles] = useState<BrowseProfile[]>([])
  const [browseLoading, setBrowseLoading] = useState(true)
  const fetchedRef = useRef(false)

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarVisible, setSidebarVisible] = useState(false)
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const [subsByIndustry, setSubsByIndustry] = useState<Record<string, string[]>>({})
  const [sidebarAtTop, setSidebarAtTop] = useState(true)
  const [sidebarAtBottom, setSidebarAtBottom] = useState(false)
  const sidebarNavRef = useRef<HTMLElement | null>(null)

  // Computed category counts from browseProfiles
  const industryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const p of browseProfiles) {
      if (p.industry) counts[p.industry] = (counts[p.industry] ?? 0) + 1
    }
    return counts
  }, [browseProfiles])

  // Build display items (same logic as TagSidebar)
  const displayItems = useMemo(() => {
    if (Object.keys(industryCounts).length === 0) return []
    const consumed = new Set<string>()
    const items: { primary: string; industries: string[]; count: number; subs: string[] }[] = []
    for (const group of TAG_GROUPS) {
      const present = group.filter(ind => ind in industryCounts)
      if (present.length === 0) continue
      present.forEach(ind => consumed.add(ind))
      const count = present.reduce((s, ind) => s + (industryCounts[ind] ?? 0), 0)
      items.push({ primary: present[0]!, industries: present, count, subs: [...new Set(present.flatMap(ind => subsByIndustry[ind] ?? []))] })
    }
    for (const ind of Object.keys(industryCounts).sort()) {
      if (!consumed.has(ind)) items.push({ primary: ind, industries: [ind], count: industryCounts[ind] ?? 0, subs: subsByIndustry[ind] ?? [] })
    }
    return items.sort((a, b) => a.primary.localeCompare(b.primary))
  }, [industryCounts, subsByIndustry])

  const drawerRef = useRef<HTMLDivElement>(null)
  const sidebarRef = useRef<HTMLDivElement>(null)

  const openSidebar = () => {
    setSidebarOpen(true)
  }
  const closeSidebar = () => {
    setSidebarVisible(false)
    setTimeout(() => setSidebarOpen(false), 300)
  }
  const selectCategory = (cat: string) => {
    setActiveCategory(cat)
    closeSidebar()
  }

  // Mount / unmount with animation
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true)
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    } else {
      setVisible(false)
      const t = setTimeout(() => setShouldRender(false), 350)
      return () => clearTimeout(t)
    }
  }, [isOpen])

  // Force reflow before starting main drawer transition
  useLayoutEffect(() => {
    if (!shouldRender || !isOpen) return
    drawerRef.current?.getBoundingClientRect()
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [shouldRender, isOpen])

  // Force reflow before starting sidebar transition
  useLayoutEffect(() => {
    if (!sidebarOpen) return
    sidebarRef.current?.getBoundingClientRect()
    const id = requestAnimationFrame(() => setSidebarVisible(true))
    return () => cancelAnimationFrame(id)
  }, [sidebarOpen])

  // Reset + focus when opened
  useEffect(() => {
    if (isOpen) {
      setActiveCategory(initialCategory ?? 'all')
      const t = setTimeout(() => inputRef.current?.focus(), 400)
      return () => clearTimeout(t)
    } else {
      setQuery('')
      setSearchResults(null)
      setActiveCategory('all')
      setSortColumn('index_price')
      setSortDir('desc')
    }
  }, [isOpen, initialCategory])

  // Escape key
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  useEffect(() => {
    const nav = sidebarNavRef.current
    if (!nav) return
    const check = () => {
      const canScroll = nav.scrollHeight > nav.clientHeight + 1
      setSidebarAtTop(nav.scrollTop <= 1)
      setSidebarAtBottom(!canScroll || nav.scrollHeight - nav.scrollTop <= nav.clientHeight + 1)
    }
    check()
    nav.addEventListener('scroll', check, { passive: true })
    const ro = new ResizeObserver(check)
    ro.observe(nav)
    return () => {
      nav.removeEventListener('scroll', check)
      ro.disconnect()
    }
  }, [sidebarOpen])

  // Fetch browse data once — lazily, only after the drawer is first
  // opened. Previously this fired on every home-page mount even though
  // the drawer was hidden, pulling ~35kB of `/api/trade?limit=1000`
  // data and a `subcategories?grouped=true` payload into the initial
  // page load for users who never open search. `fetchedRef` still
  // ensures we don't refetch on every subsequent open.
  useEffect(() => {
    if (!isOpen) return
    if (fetchedRef.current) return
    fetchedRef.current = true
    fetch('/api/subcategories?grouped=true')
      .then(r => r.json())
      .then(data => { if (data.byIndustry) setSubsByIndustry(data.byIndustry) })
      .catch(() => {})
    fetch('/api/trade?limit=1000&offset=0&sort_by=current_index_value&sort_dir=desc')
      .then(r => r.json())
      .then(data => {
        const artists = data.artists ?? []
        const profiles = artists.map((a: any) => ({
          id: a.id, name: a.name,
          industry: a.industry ?? null,
          index_price: a.index_price ?? null,
          change_1m: a.change_1m ?? null,
          volume: a.volume ?? null,
          holders: a.holders ?? null,
          image_url: a.image_url ?? null,
        }))
        setBrowseProfiles(profiles)
        // Preload all profile images into browser cache as soon as data arrives
        profiles.forEach((p: { image_url: string | null }) => { if (p.image_url) preloadImage(p.image_url) })
        setBrowseLoading(false)
      })
      .catch(() => setBrowseLoading(false))
  }, [isOpen])

  // Debounced search
  useEffect(() => {
    const q = query.trim()
    if (!q) { setSearchResults(null); setSearchLoading(false); return }
    setSearchLoading(true)
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`)
        .then(r => r.json())
        .then(data => {
          setSearchResults((data.results ?? []).map((a: any) => ({
            id: a.id, name: a.name,
            index_price: a.index_price ?? null,
            change_1m: a.change_1m ?? null,
            volume: a.volume ?? null,
            image_url: a.image_url ?? null,
            listed: a.listed !== false,
          })))
        })
        .catch(() => setSearchResults([]))
        .finally(() => setSearchLoading(false))
    }, 220)
    return () => clearTimeout(t)
  }, [query])

  const filtered = activeCategory === 'all'
    ? browseProfiles
    : browseProfiles.filter(a => a.industry === activeCategory)

  const sorted = query.trim()
    ? (searchResults ?? [])
    : [...filtered].sort((a, b) => {
        const av = (a[sortColumn as keyof MobileGridProfile] as number | null) ?? -Infinity
        const bv = (b[sortColumn as keyof MobileGridProfile] as number | null) ?? -Infinity
        return sortDir === 'desc' ? bv - av : av - bv
      })

  if (!shouldRender) return null

  return (
    <div className="fixed inset-0 z-[1200]">
      {/* Full-page sheet */}
      <div
        ref={drawerRef}
        className="absolute inset-0 flex flex-col overflow-hidden"
        style={{
          background: 'rgb(10,10,10)',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 340ms cubic-bezier(0.16, 1, 0.3, 1)',
          pointerEvents: 'auto',
        }}
      >
        {/* Back button row */}
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 0.75rem 0.25rem',
            paddingTop: 'max(env(safe-area-inset-top), 0.75rem)',
            flexShrink: 0,
          }}
        >
          <button
            onClick={onClose}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '2.25rem', height: '2.25rem',
              background: 'none', border: 'none',
              cursor: 'pointer', flexShrink: 0,
              color: '#fff',
            }}
            aria-label="Close search"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </button>
          <button
            onClick={openSidebar}
            aria-label="Browse categories"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '2.25rem', height: '2.25rem', background: 'none', border: 'none', cursor: 'pointer', color: '#71717a', padding: '0rem', flexShrink: 0 }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Search bar row */}
        <div style={{ padding: '0.25rem 0.75rem 0.625rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          <div
            className="flex flex-1 items-center gap-2 rounded-full px-4"
            style={{ height: '2.25rem', background: '#131313', color: 'var(--st-secondary)' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0" aria-hidden="true">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search markets…"
              className="flex-1 bg-transparent border-none outline-none text-white text-[0.8125rem] font-normal tracking-[-0.025em] placeholder:text-[0.8125rem]"
              style={{ fontFamily: 'var(--font-geist-sans)' }}
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="flex items-center hover:text-white"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0rem', color: 'var(--st-secondary)' }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>
          <SortDropdown
            options={SORT_OPTIONS}
            column={sortColumn}
            direction={sortDir}
            defaultColumn="index_price"
            onColumnChange={setSortColumn}
            onDirectionChange={setSortDir}
          />
        </div>

        {/* Category strip (Trending, Biggest Gainers, …) — drives the sort */}
        {!query.trim() && (
          <div style={{ flexShrink: 0, padding: '0 0.75rem 0.5rem' }}>
            <SXCategoryTagStrip
              active={activeTag}
              onSelect={(t) => {
                setActiveTag(t)
                if (t === 'all') setActiveCategory('all')
                const s = getCategorySort(t)
                setSortColumn(s.col)
                setSortDir(s.dir)
              }}
            />
          </div>
        )}

        {/* Scrollable grid */}
        <div className="flex-1 overflow-x-hidden overflow-y-auto scrollbar-hide">
          <div className="px-2 pb-8">
            <MobileGrid
              profiles={sorted}
              loading={query.trim() ? searchLoading : browseLoading}
            />
          </div>
        </div>

        {/* Category sidebar — slides in from left over the content */}
        {sidebarOpen && (
          <>
            {/* Backdrop */}
            <div
              onClick={closeSidebar}
              style={{
                position: 'absolute', inset: 0,
                background: 'rgba(0,0,0,0.5)',
                opacity: sidebarVisible ? 1 : 0,
                transition: 'opacity 300ms ease',
                zIndex: 20,
              }}
            />
            {/* Panel */}
            <div
              ref={sidebarRef}
              style={{
                position: 'absolute', top: '0rem', left: '0rem', bottom: '0rem',
                width: '75%', maxWidth: '17.5rem',
                background: 'rgb(10,10,10)',
                zIndex: 21,
                display: 'flex', flexDirection: 'column',
                overflow: 'hidden',
                transform: sidebarVisible ? 'translateX(0)' : 'translateX(-100%)',
                transition: 'transform 300ms cubic-bezier(0.16,1,0.3,1)',
                borderRight: '1px solid #1a1a1a',
              }}
            >
              <div style={{ paddingTop: 'max(env(safe-area-inset-top), 1rem)', paddingBottom: '0.5rem', paddingLeft: '0.75rem', paddingRight: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <span style={{ fontFamily: 'var(--font-geist-sans)', fontSize: '0.8125rem', fontWeight: 600, color: '#71717a', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Browse</span>
                <button onClick={closeSidebar} aria-label="Close" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '2rem', height: '2rem', background: 'none', border: 'none', cursor: 'pointer', color: '#71717a', padding: '0rem' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
              <nav ref={sidebarNavRef} style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '0 0.5rem 1.5rem', scrollbarWidth: 'none' }}
                className="[&::-webkit-scrollbar]:hidden">

                {/* All Markets */}
                <button
                  onClick={() => selectCategory('all')}
                  className="flex h-12 w-full shrink-0 items-center gap-3 rounded-full pl-3 pr-4 outline-none transition-colors duration-200 ease-out"
                  style={{ background: activeCategory === 'all' ? 'rgba(255,255,255,0.08)' : 'transparent', color: activeCategory === 'all' ? '#fff' : '#71717a' }}
                >
                  <span className="shrink-0">{ALL_MARKETS_ICON}</span>
                  <span style={{ fontFamily: 'var(--font-geist-sans)', fontSize: '0.875rem', fontWeight: 500, position: 'relative', top: '0.0625rem' }}>
                    All Markets
                    <span className="tabular-nums" style={{ color: '#52525b', marginLeft: '0.25rem', fontSize: '0.625rem', verticalAlign: 'middle' }}>({browseProfiles.length})</span>
                  </span>
                </button>

                {/* Category groups */}
                {displayItems.map(({ primary, industries: inds, count, subs }) => (
                  <CategoryGroup
                    key={primary}
                    primary={primary}
                    industries={inds}
                    count={count}
                    subs={subs}
                    activeCategory={activeCategory}
                    isExpanded={expandedCategory === primary}
                    onSelect={selectCategory}
                    onToggleExpand={() => setExpandedCategory(expandedCategory === primary ? null : primary)}
                  />
                ))}
              </nav>
              <div className="pointer-events-none absolute top-0 left-0 right-0 h-16 transition-opacity duration-200" style={{ background: 'linear-gradient(to top, transparent, rgb(10,10,10))', opacity: sidebarAtTop ? 0 : 1, zIndex: 1 }} />
              <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-16 transition-opacity duration-200" style={{ background: 'linear-gradient(to bottom, transparent, rgb(10,10,10))', opacity: sidebarAtBottom ? 0 : 1, zIndex: 1 }} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
