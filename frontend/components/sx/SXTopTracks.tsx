'use client'

import { useRef, useState } from 'react'
import { CSXText } from './core/CSXText'

interface TopTrack {
  id: string
  name: string
  album?: string
  image?: string
  url?: string
  artists?: string[] | string
  duration?: number
  playcount?: number
  contentRating?: string
}

interface SXTopTracksProps {
  tracks: TopTrack[]
}

const PER_PAGE = 3

function formatPlaycount(count?: number): string {
  if (count == null) return ''
  if (count >= 1_000_000_000) return `${(count / 1_000_000_000).toFixed(1)}B streams`
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M streams`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K streams`
  return `${count} streams`
}

export function SXTopTracks({ tracks }: SXTopTracksProps) {
  const [page, setPage] = useState(0)
  const dirRef = useRef<'left' | 'right'>('right')
  const [animKey, setAnimKey] = useState(0)

  // After the hooks — tracks fill in live via /api/artists/refresh, and an
  // early return above the hooks crashes React when the list appears.
  if (!tracks || tracks.length === 0) return null

  const totalPages = Math.ceil(tracks.length / PER_PAGE)
  const display = tracks.slice(page * PER_PAGE, (page + 1) * PER_PAGE)

  const go = (next: number, dir: 'left' | 'right') => {
    dirRef.current = dir
    setPage(next)
    setAnimKey(k => k + 1)
  }

  return (
    <div>
      <style>{`
        @keyframes slide-in-right { from { transform: translateX(32px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes slide-in-left  { from { transform: translateX(-32px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .tracks-slide-right { animation: slide-in-right 0.25s cubic-bezier(0.25,0.46,0.45,0.94) both; }
        .tracks-slide-left  { animation: slide-in-left  0.25s cubic-bezier(0.25,0.46,0.45,0.94) both; }
      `}</style>

      {/* Header */}
      <div className="pt-6 pb-4 flex items-center justify-between">
        <CSXText variant="subtitle" color="STWhite">Top Tracks</CSXText>
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

      {/* Track list */}
      <div
        key={animKey}
        className={dirRef.current === 'right' ? 'tracks-slide-right' : 'tracks-slide-left'}
      >
        {display.map((track, i) => {
          const trackUrl = track.url || (track.id ? `https://open.spotify.com/track/${track.id}` : undefined)
          
          const inner = (
            <div className="flex items-center gap-3 py-4 group hover:bg-zinc-800/30 px-4 -mx-4 rounded-lg transition-colors">
              {/* Album art */}
              <div className="flex-shrink-0 rounded overflow-hidden" style={{ width: '2.75rem', height: '2.75rem', background: '#27272a' }}>
                {track.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={track.image}
                    alt={track.album ?? track.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: '#52525b' }}>
                      <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                    </svg>
                  </div>
                )}
              </div>

              {/* Track info */}
              <div className="flex-1 min-w-0">
                <div
                  className="truncate text-sm font-medium"
                  style={{ color: 'var(--st-white)', fontFamily: 'var(--font-inter)' }}
                >
                  {track.name}
                </div>
                {track.artists && (Array.isArray(track.artists) ? track.artists.length > 0 : track.artists) && (
                  <div
                    className="truncate text-xs mt-0.5"
                    style={{ color: 'var(--st-secondary)', fontFamily: 'var(--font-inter)' }}
                  >
                    {Array.isArray(track.artists) ? track.artists.join(', ') : track.artists}
                  </div>
                )}
              </div>

              {/* Playcount */}
              {track.playcount != null && (
                <div
                  className="flex-shrink-0 text-xs tabular-nums"
                  style={{ color: 'var(--st-secondary)', fontFamily: 'var(--font-inter)' }}
                >
                  {formatPlaycount(track.playcount)}
                </div>
              )}
            </div>
          )

          return trackUrl ? (
            <a key={track.id ?? i} href={trackUrl} target="_blank" rel="noopener noreferrer" className="active:scale-[0.96] transition-transform duration-100" style={{ textDecoration: 'none', display: 'block' }}>
              {inner}
            </a>
          ) : (
            <div key={track.id ?? i} className="active:scale-[0.96] transition-transform duration-100">{inner}</div>
          )
        })}
      </div>
    </div>
  )
}
