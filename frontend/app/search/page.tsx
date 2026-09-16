'use client'

import { useEffect, useRef, useState } from 'react'
import { MobileGrid, MobileGridProfile } from '@/components/home/MobileTradeList'
import { TAG_GROUPS } from '@/lib/tagGroups'

interface BrowseProfile extends MobileGridProfile {
  industry?: string | null
}

export default function SearchPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<MobileGridProfile[] | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [activeCategory, setActiveCategory] = useState('All')
  const [industries, setIndustries] = useState<string[]>([])
  const [browseProfiles, setBrowseProfiles] = useState<BrowseProfile[]>([])
  const [browseLoading, setBrowseLoading] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    fetch('/api/trade?limit=1000&offset=0&sort_by=current_index_value&sort_dir=desc')
      .then(r => r.json())
      .then(data => {
        const artists = data.artists ?? []
        const raw: string[] = artists
          .map((a: { industry?: string | null }) => a.industry)
          .filter((v: string | null | undefined): v is string => !!v)
        const unique = [...new Set(raw)]
        const consumed = new Set<string>()
        const ordered: string[] = []
        for (const group of TAG_GROUPS) {
          const present = group.filter(ind => unique.includes(ind))
          if (present.length === 0) continue
          present.forEach(ind => consumed.add(ind))
          ordered.push(present[0])
        }
        for (const ind of unique.sort()) {
          if (!consumed.has(ind)) ordered.push(ind)
        }
        setIndustries(ordered.sort((a, b) => a.localeCompare(b)))
        setBrowseProfiles(artists.map((a: any) => ({
          id: a.id, name: a.name,
          industry: a.industry ?? null,
          index_price: a.index_price ?? null,
          change_1m: a.change_1m ?? null,
          volume: a.volume ?? null,
          holders: a.holders ?? null,
          image_url: a.image_url ?? null,
        })))
        setBrowseLoading(false)
      })
      .catch(() => setBrowseLoading(false))
  }, [])

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
          })))
        })
        .catch(() => setSearchResults([]))
        .finally(() => setSearchLoading(false))
    }, 220)
    return () => clearTimeout(t)
  }, [query])

  const allCategories = ['All', ...industries]
  const filteredProfiles = activeCategory === 'All'
    ? browseProfiles
    : browseProfiles.filter(a => a.industry === activeCategory)

  return (
    <div className="flex flex-col min-h-screen bg-[rgb(10,10,10)] text-white pb-24">
      {/* Search bar + button */}
      <div style={{ padding: '1rem 0.75rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem',
          background: '#111', border: '1px solid #2a2a2a', borderRadius: '0.625rem',
          padding: '0 0.75rem', height: '2.75rem',
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#52525b', flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search markets..."
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: '#fff', fontSize: '0.9375rem', fontFamily: 'var(--font-geist-sans)',
            }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', color: '#52525b', cursor: 'pointer', padding: '0rem', display: 'flex' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>
        <button
          onClick={() => { if (query.trim()) inputRef.current?.blur() }}
          style={{
            height: '2.75rem', padding: '0 0.875rem', borderRadius: '0.625rem',
            border: '1px solid #2a2a2a', background: 'transparent',
            color: '#a1a1aa', fontSize: '0.875rem', fontFamily: 'var(--font-geist-sans)',
            fontWeight: 500, cursor: 'pointer', flexShrink: 0,
          }}
        >
          Search
        </button>
      </div>

      {/* Industry tags — only show when not searching */}
      {!query.trim() && (
        <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
          <div
            className="scrollbar-hide"
            style={{ display: 'flex', gap: '0.375rem', overflowX: 'auto', padding: '0 0.75rem 0.75rem' }}
          >
            {allCategories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  flexShrink: 0, padding: '0.375rem 0.75rem', borderRadius: '62.4375rem',
                  border: `1px solid ${activeCategory === cat ? '#fff' : '#2a2a2a'}`,
                  background: activeCategory === cat ? '#fff' : 'transparent',
                  color: activeCategory === cat ? '#000' : '#a1a1aa',
                  fontSize: '0.8125rem', fontWeight: activeCategory === cat ? 600 : 400,
                  cursor: 'pointer', fontFamily: 'var(--font-geist-sans)',
                  transition: 'all 150ms ease',
                }}
              >
                {cat}
              </button>
            ))}
          </div>
          <div style={{ position: 'absolute', top: '0rem', right: '0rem', bottom: '0rem', width: '2.5rem', background: 'linear-gradient(to left, rgb(10,10,10), transparent)', pointerEvents: 'none' }} />
        </div>
      )}

      {/* Grid — matches trade page mobile grid 1:1 */}
      <div className="px-3">
        {query.trim() ? (
          <MobileGrid profiles={searchResults ?? []} loading={searchLoading} />
        ) : (
          <MobileGrid profiles={filteredProfiles} loading={browseLoading} />
        )}
      </div>
    </div>
  )
}
