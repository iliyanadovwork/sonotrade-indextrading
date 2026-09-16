'use client'

import React, { useEffect, useState, useRef } from 'react'
import { usePageVisible } from '@/lib/hooks/usePageVisible'
import { CSXText } from './core/CSXText'
import { TrendArrow } from './core/TrendArrow'

interface Album {
  id: string
  name: string
  image: string
  artist: string
  date: string
  url: string
  artistChange?: number | null
}

const SLIDE_DURATION = 5000

export function SXAlbumSlideshow() {
  const [albums, setAlbums] = useState<Album[]>([])
  const [loading, setLoading] = useState(true)
  const [allLoaded, setAllLoaded] = useState(false)
  const [current, setCurrent] = useState(0)
  const [paused, setPaused] = useState(false)
  const pageVisible = usePageVisible()
  const [cdOut, setCdOut] = useState(false)
  const [prevImageUrl, setPrevImageUrl] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentRef = useRef(0)
  const albumsRef = useRef<Album[]>([])

  useEffect(() => { albumsRef.current = albums }, [albums])

  const changeTo = React.useCallback((idx: number) => {
    const prev = albumsRef.current[currentRef.current]
    if (prev?.image) setPrevImageUrl(prev.image)
    currentRef.current = idx
    setCurrent(idx)
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
    fadeTimerRef.current = setTimeout(() => setPrevImageUrl(null), 700)
  }, [])

  useEffect(() => {
    fetch('/api/latest-albums')
      .then(r => r.json())
      .then(async data => {
        if (data.albums) {
          // Show first album immediately
          setAlbums(data.albums)
          setLoading(false)

          // One discover read for every album — the URL carries no per-album
          // parameter, so this used to issue N identical requests.
          let artists: Array<{ name: string; change_1m: number | null }> = []
          try {
            const artistRes = await fetch(`/api/discover?limit=100&offset=0&sort_by=current_index_value&sort_dir=desc`)
            const artistData: { artists?: Array<{ name: string; change_1m: number | null }> } = await artistRes.json()
            artists = artistData.artists ?? []
          } catch {
            // Leave changes unresolved — the arrow/percentage just doesn't render.
          }
          // Name matching only resolves artists inside this top-100 window;
          // anyone ranked below it silently shows no change.
          const changeByName = new Map(artists.map(a => [a.name, a.change_1m ?? null]))
          setAlbums((data.albums as Album[]).map(album => ({
            ...album,
            artistChange: changeByName.get(album.artist) ?? null,
          })))
          setAllLoaded(true)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!allLoaded || albums.length < 2 || paused || !pageVisible) return
    timerRef.current = setInterval(() => {
      changeTo((currentRef.current + 1) % albumsRef.current.length)
    }, SLIDE_DURATION)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [allLoaded, albums.length, paused, pageVisible, changeTo])

  const goTo = (idx: number, fromArrow = false) => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (fromArrow && paused) {
      // Slide CD out, swap album, slide back in
      setCdOut(true)
      setTimeout(() => {
        changeTo(idx)
        setCdOut(false)
      }, 350)
    } else {
      changeTo(idx)
    }
    if (!paused) {
      timerRef.current = setInterval(() => {
        changeTo((currentRef.current + 1) % albumsRef.current.length)
      }, SLIDE_DURATION)
    }
  }

  const sharedStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    minHeight: '18.75rem',
    borderRadius: '0.5rem',
    backgroundColor: '#111111',
    overflow: 'hidden',
    position: 'relative',
  }

  if (loading) {
    return <div style={sharedStyle} className="animate-pulse" />
  }

  if (albums.length === 0) return null

  const album = albums[current]

  return (
    <div
      style={{ ...sharedStyle, cursor: 'pointer', display: 'flex', transition: 'all 0.3s ease' }}
      className="select-none"
      onMouseEnter={() => {
        setPaused(true)
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
      }}
      onMouseLeave={() => {
        setPaused(false)
      }}
      onClick={() => album.url && window.open(album.url, '_blank')}
    >
      {/* Nav arrows — top right corner, anchored to outer container */}
      {albums.length > 1 && (
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', position: 'absolute', top: '1rem', right: '1rem', zIndex: 20, filter: 'drop-shadow(0 0.125rem 0.5rem rgba(0,0,0,0.9))' }}
          onClick={e => e.stopPropagation()}
        >
          <button
            aria-label="Previous album"
            onClick={() => goTo((currentRef.current - 1 + albums.length) % albums.length, true)}
            className="hover:bg-zinc-800 transition-colors cursor-pointer"
            style={{ cursor: 'pointer', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.4)', borderRadius: '50%', padding: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a1a1aa' }}
          >
            <svg viewBox="0 0 24 24" width={12.6} height={12.6} fill="currentColor">
              <path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
            </svg>
          </button>
          <span style={{ fontSize: '0.625rem', color: 'rgba(255,255,255,0.45)', fontFamily: 'var(--font-inter)', minWidth: '1.75rem', textAlign: 'center' }}>
            {current + 1}/{albums.length}
          </span>
          <button
            aria-label="Next album"
            onClick={() => goTo((currentRef.current + 1) % albums.length, true)}
            className="hover:bg-zinc-800 transition-colors cursor-pointer"
            style={{ cursor: 'pointer', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.4)', borderRadius: '50%', padding: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a1a1aa' }}
          >
            <svg viewBox="0 0 24 24" width={12.6} height={12.6} fill="currentColor">
              <path d="M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
            </svg>
          </button>
        </div>
      )}

      {/* Album cover - full width by default, 2/3 width on hover */}
      <div 
        style={{ 
          flex: paused ? '0 0 66.666%' : '1 1 100%',
          position: 'relative', 
          overflow: 'hidden',
          transition: 'flex 0.3s ease'
        }}
      >
        <style>{`
          @keyframes album-fade-in  { from { opacity: 0 } to { opacity: 1 } }
          @keyframes album-fade-out { from { opacity: 1 } to { opacity: 0 } }
        `}</style>

        {/* Outgoing image — fades out */}
        {prevImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`prev-${prevImageUrl}`}
            src={prevImageUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{ animation: 'album-fade-out 0.7s ease forwards' }}
          />
        )}

        {/* Incoming image — fades in */}
        {album.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={album.image}
            src={album.image}
            alt={album.name}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ animation: 'album-fade-in 0.7s ease forwards' }}
          />
        ) : (
          <div className="absolute inset-0 bg-zinc-800" />
        )}

        {/* Gradient overlay */}
        <div
          className="absolute inset-0"
          style={{ backgroundImage: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.1) 100%)' }}
        />


        {/* Content */}
        <div className="absolute inset-0 flex flex-col justify-between p-6">
          {/* Header at top left */}
          <div>
            <CSXText variant="subtitle" color="STWhite">Latest Albums</CSXText>
          </div>

          {/* Album info at bottom (matches home image-slide text theme + spacing) */}
          <div className="flex flex-col" style={{ gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-inter)', fontSize: '1.375rem', fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>
                {album.name}
              </span>
              {album.artistChange !== null && album.artistChange !== undefined && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.1875rem' }}>
                  <TrendArrow positive={album.artistChange >= 0} size={13} />
                  <span style={{ fontFamily: 'var(--font-inter)', fontSize: '0.75rem', fontWeight: 500, color: album.artistChange >= 0 ? 'var(--st-positive)' : 'var(--st-chart-negative)' }}>
                    {Math.abs(album.artistChange).toFixed(2)}%
                  </span>
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', flexWrap: 'wrap' }}>
              <span className="font-sans m-0 indent-0 p-0 text-xs font-normal leading-normal tracking-[-0.025em]" style={{ color: 'var(--st-secondary)' }}>
                {album.artist}
              </span>
              <span className="font-sans m-0 indent-0 p-0 text-xs font-normal leading-normal tracking-[-0.025em]" style={{ color: 'var(--st-secondary)' }}>
                {new Date(album.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
              </span>
            </div>

            {/* Dot indicators (matches home) */}
            {albums.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', paddingTop: '0.125rem' }} onClick={e => e.stopPropagation()}>
                {albums.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => goTo(i)}
                    className="transition-all duration-300"
                    style={{
                      width: i === current ? 20 : 5,
                      height: '0.3125rem',
                      borderRadius: '0.1875rem',
                      background: i === current ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)',
                      border: 'none',
                      padding: '0rem',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right side - CD semi-circle (only visible on hover) */}
      <div
        style={{
          flex: paused ? '0 0 33.333%' : '0 0 0%',
          position: 'relative',
          overflow: 'hidden',
          transition: 'flex 0.3s ease',
        }}
      >
        {/* Monogram background */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          aria-hidden
          src="/images/monogram.png"
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: 0.9,
            transform: 'scale(1.4)',
            pointerEvents: 'none',
          }}
        />
        
        {/* CD disc - slides in on hover */}
        <div
          style={{
            position: 'absolute',
            right: '0rem',
            top: '50%',
            width: '220%',
            aspectRatio: '1',
            borderRadius: '50%',
            boxShadow: '0 0 3.125rem rgba(0,0,0,0.8), 0 0 0 0.0625rem rgba(255,255,255,0.08)',
            transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: (paused && !cdOut) ? 'translateY(-50%) translateX(0)' : 'translateY(-50%) translateX(-100%)',
            zIndex: 1,
            overflow: 'hidden',
          }}
        >
          {/* Black grooved disc — spins */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: `repeating-radial-gradient(
                circle at center,
                #181818 0px,
                #181818 1.5px,
                #2a2a2a 1.5px,
                #2a2a2a 3px
              )`,
            }}
          />

          {/* Metallic white sweep — static light source */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: `conic-gradient(
                from 200deg at 50% 50%,
                transparent 0deg,
                transparent 8deg,
                rgba(255,255,255,0.65) 18deg,
                rgba(255,255,255,0.12) 30deg,
                transparent 44deg,
                transparent 188deg,
                rgba(255,255,255,0.07) 200deg,
                transparent 214deg,
                transparent 360deg
              )`,
              mixBlendMode: 'screen',
              pointerEvents: 'none',
            }}
          />

          {/* Rim highlight ring */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: `radial-gradient(circle at 50% 50%, transparent 84%, rgba(255,255,255,0.18) 86%, rgba(255,255,255,0.06) 89%, transparent 92%)`,
              pointerEvents: 'none',
            }}
          />

          {/* Center label */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '28%',
              height: '28%',
              borderRadius: '50%',
              background: 'radial-gradient(circle at 38% 36%, rgba(255,255,255,0.22) 0%, #0d0d0d 55%)',
              boxShadow: 'inset 0 0 0.375rem rgba(0,0,0,0.8)',
              zIndex: 2,
            }}
          />
        </div>
      </div>
    </div>
  )
}
