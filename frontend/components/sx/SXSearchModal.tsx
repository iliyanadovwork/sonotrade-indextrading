'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CSXText } from '@/components/sx/core/CSXText'
import { supabaseImage } from '@/lib/supabaseImage'
import { ensureArtistListed } from '@/lib/list-artist'
import { fmtVolume, fmtIndexPrice } from '@/lib/format'

interface Artist {
  id: string
  name: string
  index_price: number | null
  current_index_value?: number | null
  change_1m: number | null
  image_url?: string | null
  volume?: number | null
  /** false = on Spotify but no market yet — clicking lists it first. */
  listed?: boolean
}

interface SXSearchModalProps {
  onClose: () => void
}

function formatVolume(value: number | null | undefined): string {
  // Keeps the 'Vol. 0' zero-case this surface renders; the magnitude itself is
  // lib/format's, so the B/M/K thresholds cannot drift from the rest of the app.
  if (!value) return 'Vol. 0'
  return `Vol. ${fmtVolume(value, { decimals: 1, smallDecimals: 0 })}`
}

interface SearchResultCardProps {
  artist: Artist
  active: boolean
  pressed: boolean
  isListing: boolean
  onNavigate: (spotifyId: string) => void
  onPressedChange: (id: string | null) => void
}

function SearchResultCard({ artist, active, pressed, isListing, onNavigate, onPressedChange }: SearchResultCardProps) {
  const price = artist.index_price ?? artist.current_index_value
  const changeVal = artist.change_1m ?? 0
  const isPositive = changeVal >= 0
  const unlisted = artist.listed === false
  const priceLabel = unlisted
    ? (isListing ? 'Listing…' : 'Not listed')
    : price != null ? fmtIndexPrice(price) : '—'
  return (
    <li className="w-full">
      <div
        className={`flex flex-col gap-1 p-2 cursor-pointer rounded ${active ? 'bg-white/[0.06]' : 'hover:bg-white/[0.06]'}`}
        style={{
          transition: 'background-color 150ms, transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          transform: pressed ? 'scale(0.96)' : 'scale(1)',
          transformOrigin: 'center',
        }}
        onClick={() => onNavigate(artist.id)}
        onPointerDown={() => onPressedChange(artist.id)}
        onPointerUp={() => onPressedChange(null)}
        onPointerLeave={() => onPressedChange(null)}
      >
        <div className="aspect-square w-full overflow-hidden rounded bg-zinc-800" style={{ opacity: unlisted ? 0.55 : 1, transition: 'opacity 150ms' }}>
          {artist.image_url
            ? <img src={supabaseImage(artist.image_url, 96)} alt={artist.name} className="h-full w-full object-cover" loading="lazy" decoding="async" /> // eslint-disable-line @next/next/no-img-element
            : <div className="h-full w-full flex items-center justify-center"><span className="text-2xl font-semibold text-zinc-500 select-none">{artist.name.charAt(0).toUpperCase()}</span></div>
          }
        </div>
        <div className="flex flex-col gap-0.5 pt-0.5">
          <div className="truncate">
            <CSXText variant="body2Medium" color="STWhite">{artist.name}</CSXText>
          </div>
          <div className="flex items-center justify-between">
            <CSXText variant="body2" color="STSecondary">
              {priceLabel}
            </CSXText>
            <div className={`flex items-center gap-1 shrink-0${unlisted ? ' hidden' : ''}`}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 18" width="12" height="12" className="shrink-0" style={{ color: `var(--${isPositive ? 'st-positive' : 'st-chart-negative'})`, transform: `rotate(${isPositive ? '0deg' : '180deg'}) translateY(1px)` }}>
                <path fill="currentColor" d="m12 0 10.392 14.25H1.608z" />
              </svg>
              <span className="whitespace-nowrap tabular-nums text-xs" style={{ color: `var(--${isPositive ? 'st-positive' : 'st-chart-negative'})` }}>
                {Math.abs(changeVal).toFixed(2)}%
              </span>
            </div>
          </div>
          <CSXText variant="body3" color="STMuted">
            {unlisted ? 'Tap to start trading' : formatVolume(artist.volume)}
          </CSXText>
        </div>
      </div>
    </li>
  )
}

export function SXSearchModal({ onClose }: SXSearchModalProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Artist[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [visible, setVisible] = useState(false)
  const [pressedId, setPressedId] = useState<string | null>(null)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    inputRef.current?.focus()
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    setActiveIndex(-1)
    if (!query.trim()) { setResults([]); return }

    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`)
        const data = await r.json()
        const mapped: Artist[] = (data.results ?? []).map((a: any) => ({
          id: a.id,
          name: a.name,
          index_price: a.index_price ?? null,
          current_index_value: a.current_index_value ?? null,
          change_1m: a.change_1m ?? null,
          volume: a.volume ?? null,
          image_url: a.image_url ?? null,
          listed: a.listed !== false,
        }))
        setResults(mapped)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }, 200)

    return () => clearTimeout(timer)
  }, [query])

  const handleClose = () => {
    setVisible(false)
    setTimeout(onClose, 200)
  }

  const [listingId, setListingId] = useState<string | null>(null)

  const navigate = async (spotifyId: string) => {
    const artist = results.find(r => r.id === spotifyId)
    // Unlisted artists have no market yet — create one, then open it. The
    // market opens at today's price with no history, and the scraper starts
    // tracking it on its next run.
    if (artist && artist.listed === false) {
      setListingId(spotifyId)
      const result = await ensureArtistListed(spotifyId)
      setListingId(null)
      if (!result.ok) {
        // Listing requires a session. Send them to sign-in rather than having
        // the tap do nothing visible.
        if (result.reason === 'auth_required') {
          handleClose()
          router.replace(`${window.location.pathname}?auth=signin`, { scroll: false })
        }
        return
      }
    }
    router.push(`/artist/${encodeURIComponent(spotifyId)}`)
    handleClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { handleClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && activeIndex >= 0 && results[activeIndex]) navigate(results[activeIndex].id)
  }

  return (
    <div className="fixed inset-0 z-[1100] flex flex-col items-center pt-32" onClick={handleClose}>
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: 'rgba(0,0,0,0.90)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 200ms ease',
          willChange: 'opacity',
        }}
      />
      <div
        className="relative w-full max-w-7xl flex flex-col min-h-0 flex-1 px-4"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(6px)',
          transition: 'opacity 80ms ease, transform 80ms ease',
          willChange: 'opacity, transform',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search bar */}
        <div className="flex items-center gap-3 px-4 bg-[rgb(10,10,10)] border border-zinc-800 rounded-full max-w-2xl mx-auto w-full flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500 shrink-0">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search markets..."
            className="flex-1 bg-transparent text-white text-sm py-3.5 placeholder-zinc-500 focus:outline-none"
          />
        </div>

        {/* Results */}
        {(results.length > 0 || loading) && (
          <ul className="mt-4 pb-8 overflow-y-auto grid gap-2 list-none m-0 p-0 -mx-2 min-h-0" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(11rem, 1fr))' }}>
            {loading
              ? Array.from({ length: 12 }).map((_, i) => (
                  <li key={i} className="w-full">
                    <div className="flex flex-col gap-1 p-2">
                      <div className="aspect-square w-full rounded bg-zinc-800 animate-pulse" />
                      <div className="flex flex-col gap-0.5 pt-0.5">
                        <div className="h-[1.125rem] w-3/4 rounded bg-zinc-800 animate-pulse" />
                        <div className="h-[0.75rem] w-1/3 rounded bg-zinc-800 animate-pulse" />
                        <div className="h-[0.75rem] w-1/3 rounded bg-zinc-800 animate-pulse" />
                      </div>
                    </div>
                  </li>
                ))
              : results.map((artist, i) => (
                  <SearchResultCard
                    key={artist.id}
                    artist={artist}
                    active={i === activeIndex}
                    pressed={pressedId === artist.id}
                    isListing={listingId === artist.id}
                    onNavigate={navigate}
                    onPressedChange={setPressedId}
                  />
                ))}
          </ul>
        )}

        {query.trim() && !loading && results.length === 0 && (
          <p className="mt-4 text-sm text-zinc-500">No profiles found</p>
        )}
      </div>
    </div>
  )
}
