'use client'

import { useEffect, useRef, useState } from 'react'
import { CSXText } from './core/CSXText'

interface Event {
  id: string | string[]
  url?: string
  date: string
  name: string
  venue: string
  location: string
}

interface SXArtistToursProps {
  events: Event[]
  artistName: string
}

const PER_PAGE = 3

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function formatEventDate(dateStr: string): { month: string; day: string } {
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return { month: '—', day: '—' }
    return {
      month: MONTHS[d.getMonth()],
      day: String(d.getDate()).padStart(2, '0'),
    }
  } catch {
    return { month: '—', day: '—' }
  }
}

function cleanUrl(url?: string): string | undefined {
  if (!url) return undefined
  if (url.includes("('") || url.includes('(",)')) return undefined
  return url
}

export function SXArtistTours({ events, artistName }: SXArtistToursProps) {
  // Computed after mount, not during render. The server and the browser render
  // at different instants, so a render-time Date.now() gives them different
  // "upcoming" sets and React reports a hydration mismatch. Null until the
  // effect runs, which renders the same empty list the server produced.
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => { setNow(Date.now()) }, [])
  const upcoming = (now === null ? [] : events)
    .filter(e => {
      try { return new Date(e.date).getTime() >= (now ?? 0) } catch { return false }
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const [page, setPage] = useState(0)
  const dirRef = useRef<'left' | 'right'>('right')
  const [animKey, setAnimKey] = useState(0)

  const go = (next: number, dir: 'left' | 'right') => {
    dirRef.current = dir
    setPage(next)
    setAnimKey(k => k + 1)
  }

  if (upcoming.length === 0) {
    return (
      <div>
        {/* Header */}
        <div className="py-4 flex items-center justify-between">
          <CSXText variant="subtitle" color="STWhite">Upcoming Shows</CSXText>
        </div>
        <div className="pt-3">
          <CSXText variant="body2" color="STSecondary">
            No upcoming shows
          </CSXText>
        </div>
      </div>
    )
  }

  const totalPages = Math.ceil(upcoming.length / PER_PAGE)
  const display = upcoming.slice(page * PER_PAGE, (page + 1) * PER_PAGE)

  return (
    <div>
      <style>{`
        @keyframes tours-slide-right { from { transform: translateX(32px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes tours-slide-left  { from { transform: translateX(-32px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .tours-slide-right { animation: tours-slide-right 0.25s cubic-bezier(0.25,0.46,0.45,0.94) both; }
        .tours-slide-left  { animation: tours-slide-left  0.25s cubic-bezier(0.25,0.46,0.45,0.94) both; }
      `}</style>

      {/* Header */}
      <div className="py-4 flex items-center justify-between">
        <CSXText variant="subtitle" color="STWhite">Upcoming Shows</CSXText>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              aria-label="Previous slide"
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
              aria-label="Next slide"
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

      {/* Event list */}
      <div
        key={animKey}
        className={dirRef.current === 'right' ? 'tours-slide-right' : 'tours-slide-left'}
      >
        {display.map((event, i) => {
          const { month, day } = formatEventDate(event.date)
          const href = cleanUrl(event.url)
          const isHeadline = event.name.trim().toLowerCase() === artistName.trim().toLowerCase()
          const title = isHeadline ? event.venue : event.name
          const subtitle = `${event.venue} · ${event.location}`

          const inner = (
            <div className="flex items-center gap-3 py-4 group">
              {/* Date box */}
              <div
                className="flex-shrink-0 rounded flex flex-col items-center justify-center"
                style={{ width: '2.75rem', height: '2.75rem', background: '#27272a' }}
              >
                <div className="text-xs font-medium uppercase tracking-wider leading-none" style={{ color: 'var(--st-muted)', fontFamily: 'var(--font-geist-sans)' }}>{month}</div>
                <div className="text-base font-semibold leading-tight" style={{ color: 'var(--st-white)', fontFamily: 'var(--font-geist-sans)' }}>{day}</div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="truncate text-sm font-medium" style={{ color: 'var(--st-white)', fontFamily: 'var(--font-geist-sans)' }}>
                  {title}
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--st-muted)', flexShrink: 0 }}>
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                  </svg>
                  <span className="truncate text-xs" style={{ color: 'var(--st-muted)', fontFamily: 'var(--font-geist-sans)' }}>
                    {subtitle}
                  </span>
                </div>
              </div>

              {/* Tickets arrow */}
              {href && (
                <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-xs" style={{ color: 'var(--st-muted)' }}>Tickets</span>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style={{ color: 'var(--st-muted)' }}>
                    <path d="M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
                  </svg>
                </div>
              )}
            </div>
          )

          return href ? (
            <a key={i} href={href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'block' }}>
              {inner}
            </a>
          ) : (
            <div key={i}>{inner}</div>
          )
        })}
      </div>
    </div>
  )
}
