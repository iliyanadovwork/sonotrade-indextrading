'use client'

import { useRef, useState } from 'react'
import { CSXText } from './core/CSXText'

interface Release {
  id: string
  name: string
  url?: string
  type?: string
  image?: string
  date?: string
  label?: string
  tracks?: number
}

interface SXReleasesProps {
  releases: Release[]
}

const PER_PAGE = 3

function formatDate(dateStr?: string): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return ''
    return d.getFullYear().toString()
  } catch { return '' }
}

export function SXReleases({ releases }: SXReleasesProps) {
  const [page, setPage] = useState(0)
  const dirRef = useRef<'left' | 'right'>('right')
  const [animKey, setAnimKey] = useState(0)

  // After the hooks — releases fills in live via /api/artists/refresh, and an
  // early return above the hooks crashes React when the list appears.
  if (!releases || releases.length === 0) return null

  const totalPages = Math.ceil(releases.length / PER_PAGE)
  const display = releases.slice(page * PER_PAGE, (page + 1) * PER_PAGE)

  const go = (next: number, dir: 'left' | 'right') => {
    dirRef.current = dir
    setPage(next)
    setAnimKey(k => k + 1)
  }

  return (
    <div>
      <style>{`
        @keyframes releases-slide-right { from { transform: translateX(32px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes releases-slide-left  { from { transform: translateX(-32px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .releases-slide-right { animation: releases-slide-right 0.25s cubic-bezier(0.25,0.46,0.45,0.94) both; }
        .releases-slide-left  { animation: releases-slide-left  0.25s cubic-bezier(0.25,0.46,0.45,0.94) both; }
      `}</style>

      {/* Header */}
      <div className="pt-6 pb-4 flex items-center justify-between">
        <CSXText variant="subtitle" color="STWhite">Releases</CSXText>
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
            <span style={{ fontSize: '0.75rem', color: 'var(--st-secondary)', fontFamily: 'var(--font-inter)', minWidth: '2rem', textAlign: 'center' }}>
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

      {/* Release list */}
      <div
        key={animKey}
        className={dirRef.current === 'right' ? 'releases-slide-right' : 'releases-slide-left'}
      >
        {display.map((release, i) => {
          const year = formatDate(release.date)
          const inner = (
            <div className="flex items-center gap-3 py-4 group hover:bg-zinc-800/30 px-4 -mx-4 rounded-lg transition-colors">
              {/* Album art */}
              <div className="flex-shrink-0 rounded overflow-hidden" style={{ width: '2.75rem', height: '2.75rem', background: '#27272a' }}>
                {release.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={release.image}
                    alt={release.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: '#52525b' }}>
                      <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6M9 13h4"/>
                    </svg>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div
                  className="truncate text-sm font-medium"
                  style={{ color: 'var(--st-white)', fontFamily: 'var(--font-inter)' }}
                >
                  {release.name}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {release.type && (
                    <span className="text-xs" style={{ color: 'var(--st-secondary)', fontFamily: 'var(--font-inter)' }}>
                      {release.type.charAt(0) + release.type.slice(1).toLowerCase()}
                    </span>
                  )}
                  {year && release.type && (
                    <span style={{ color: '#3f3f46', fontSize: '0.625rem' }}>·</span>
                  )}
                  {year && (
                    <span className="text-xs" style={{ color: 'var(--st-secondary)', fontFamily: 'var(--font-inter)' }}>
                      {year}
                    </span>
                  )}
                  {release.tracks != null && (
                    <>
                      <span style={{ color: '#3f3f46', fontSize: '0.625rem' }}>·</span>
                      <span className="text-xs" style={{ color: 'var(--st-secondary)', fontFamily: 'var(--font-inter)' }}>
                        {release.tracks} {release.tracks === 1 ? 'track' : 'tracks'}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )

          return release.url ? (
            <a key={i} href={release.url} target="_blank" rel="noopener noreferrer" className="active:scale-[0.96] transition-transform duration-100" style={{ textDecoration: 'none', display: 'block' }}>
              {inner}
            </a>
          ) : (
            <div key={i} className="active:scale-[0.96] transition-transform duration-100">{inner}</div>
          )
        })}
      </div>
    </div>
  )
}
