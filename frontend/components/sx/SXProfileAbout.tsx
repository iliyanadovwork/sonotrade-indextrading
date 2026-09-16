'use client'

import { memo, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useIsMobile } from '@/lib/useIsMobile'
import { usePageVisible } from '@/lib/hooks/usePageVisible'
import { CSXText } from './core/CSXText'
import { CSXAccordion } from './core/CSXAccordion'
import { HeroImageLayers } from './HeroImageLayers'
import { decodeHtml } from '@/lib/decodeHtml'
import { fmtCompact, fmtNumber } from '@/lib/format'

interface TopCity {
  city: string
  country?: string
  numberOfListeners?: number
}

interface SXProfileAboutProps {
  biography?: string | null
  image_url?: string | null
  name?: string | null
  gallery?: string[]
  followers?: number | null
  monthly_listeners?: number | null
  top_cities?: TopCity[]
  facebook?: string | null
  instagram?: string | null
  twitter?: string | null
  tiktok?: string | null
  spotify_id?: string | null
  industry?: string | null
  info_location?: string | null
  info_subcategory?: string | null
  info_active_since?: string | null
  info_language?: string | null
  view_count?: number | null
  holders?: number | null
}

function Slideshow({ images, name, square = false }: { images: string[]; name: string; square?: boolean }) {
  const [idx, setIdx] = useState(0)
  const [dir, setDir] = useState<'left' | 'right'>('left')
  const [timerKey, setTimerKey] = useState(0)
  const touchStartX = useRef<number | null>(null)
  const pageVisible = usePageVisible()

  useEffect(() => {
    if (images.length <= 1 || !pageVisible) return
    const id = setInterval(() => {
      setDir('left')
      setIdx(i => (i + 1) % images.length)
    }, 5000)
    return () => clearInterval(id)
  }, [images.length, timerKey, pageVisible])

  const goTo = (next: boolean) => {
    if (images.length <= 1) return
    setDir(next ? 'left' : 'right')
    setIdx(i => (next ? i + 1 : i - 1 + images.length) % images.length)
    setTimerKey(k => k + 1)
  }

  if (images.length === 0) return null

  return (
    <>
      <style>{`
        @keyframes about-slide-right { from { transform: translateX(40px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes about-slide-left  { from { transform: translateX(-40px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .about-slide-right { animation: about-slide-right 0.32s cubic-bezier(0.25,0.46,0.45,0.94) both; }
        .about-slide-left  { animation: about-slide-left  0.32s cubic-bezier(0.25,0.46,0.45,0.94) both; }
      `}</style>
      <div
        className={`relative w-full overflow-hidden group${square ? '' : ' bg-black'}`}
        style={square ? { aspectRatio: '1' } : { height: '20rem' }}
        onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX }}
        onTouchEnd={(e) => {
          if (touchStartX.current == null) return
          const dx = e.changedTouches[0].clientX - touchStartX.current
          if (Math.abs(dx) > 40) goTo(dx < 0)
          touchStartX.current = null
        }}
      >
        <div key={idx} className={dir === 'left' ? 'about-slide-right' : 'about-slide-left'} style={{ position: 'absolute', inset: square ? 16 : 0, borderRadius: square ? 12 : 0, overflow: 'hidden' }}>
          <HeroImageLayers src={images[idx]} alt={`${name} gallery ${idx + 1}`} fit={square} />
        </div>

        {images.length > 1 && (
          <>
            <button
              type="button"
              className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 group/btn"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                goTo(false)
              }}
            >
              <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover/btn:scale-110" style={{ filter: 'drop-shadow(0 0.125rem 0.375rem rgba(0,0,0,0.9))' }}>
                <path d="M15 18l-6-6 6-6"/>
              </svg>
            </button>
            <button
              type="button"
              className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 group/btn"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                goTo(true)
              }}
            >
              <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover/btn:scale-110" style={{ filter: 'drop-shadow(0 0.125rem 0.375rem rgba(0,0,0,0.9))' }}>
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </button>
          </>
        )}
      </div>
    </>
  )
}

function AboutModal({ images, image_url, bio, name, followers, monthly_listeners, top_cities, facebook, instagram, twitter, tiktok, spotify_id, isOpen, onClose }: {
  images: string[]
  image_url?: string | null
  bio: string
  name: string
  followers?: number | null
  monthly_listeners?: number | null
  top_cities?: TopCity[]
  facebook?: string | null
  instagram?: string | null
  twitter?: string | null
  tiktok?: string | null
  spotify_id?: string | null
  isOpen: boolean
  onClose: () => void
}) {
  const [visible, setVisible] = useState(false)
  const isMobile = useIsMobile()

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
    } else {
      // Drive the close animation in response to the external `isOpen` prop.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(false)
    }
  }, [isOpen])

  // Lock body scroll while the mobile drawer is open (mirrors SearchDrawer).
  useEffect(() => {
    if (!isMobile || !isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [isMobile, isOpen])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const socials = [
    { label: 'Facebook', url: facebook, icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
    )},
    { label: 'Instagram', url: instagram, icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none"/></svg>
    )},
    { label: 'X', url: twitter, icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
    )},
    { label: 'TikTok', url: tiktok, icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.88a8.16 8.16 0 0 0 4.77 1.52V7a4.85 4.85 0 0 1-1-.31z"/></svg>
    )},
  ].filter(s => s.url)

  // ── Mobile: full-height slide-up drawer (mirrors SearchDrawer) ──
  if (isMobile) {
    return createPortal(
      <div className="fixed inset-0 z-[10002]" onClick={onClose}>
        <div
          className="absolute inset-0 flex flex-col overflow-hidden"
          style={{
            background: 'rgb(10,10,10)',
            transform: visible ? 'translateY(0)' : 'translateY(100%)',
            transition: 'transform 340ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Back button row */}
          <div
            style={{
              display: 'flex', alignItems: 'center',
              paddingTop: 'max(env(safe-area-inset-top), 0.75rem)',
              paddingBottom: '0.5rem',
              paddingLeft: '0rem',
              paddingRight: '0.75rem',
              flexShrink: 0,
            }}
          >
            <button
              onClick={onClose}
              aria-label="Close"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '2.25rem', height: '2.25rem', background: 'none', border: 'none', cursor: 'pointer', color: '#fff', padding: '0rem' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
            {images.length > 0 ? (
              <Slideshow images={images} name={name} />
            ) : image_url ? (
              <div className="relative w-full overflow-hidden bg-black" style={{ height: '17.5rem' }}>
                <HeroImageLayers src={image_url} alt={`${name} cover`} />
              </div>
            ) : null}

            <div className="flex flex-col gap-6 px-4 pt-6 pb-12">
              {(followers != null || monthly_listeners != null) && (
                <div className="grid grid-cols-2 gap-4">
                  {followers != null && (
                    <div>
                      <div className="text-base font-semibold" style={{ color: 'var(--st-white)', fontFamily: 'var(--font-inter)' }}>{fmtNumber(followers, 0)}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--st-muted)', fontFamily: 'var(--font-inter)' }}>Followers</div>
                    </div>
                  )}
                  {monthly_listeners != null && (
                    <div>
                      <div className="text-base font-semibold" style={{ color: 'var(--st-white)', fontFamily: 'var(--font-inter)' }}>{fmtNumber(monthly_listeners, 0)}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--st-muted)', fontFamily: 'var(--font-inter)' }}>Monthly Listeners</div>
                    </div>
                  )}
                </div>
              )}

              {bio && (
                <div>
                  <div className="mb-2"><CSXText variant="subtitle" color="STWhite">About</CSXText></div>
                  <div className="text-xs leading-relaxed tracking-[-0.025em]" style={{ color: 'var(--st-secondary)', fontFamily: 'var(--font-inter)' }}>{bio}</div>
                </div>
              )}

              {(top_cities?.length ?? 0) > 0 && (
                <div>
                  <div className="mb-3"><CSXText variant="subtitle" color="STWhite">Top Cities</CSXText></div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    {top_cities!.map((c, i) => (
                      <div key={i}>
                        <div className="text-xs font-medium" style={{ color: 'var(--st-white)', fontFamily: 'var(--font-inter)' }}>
                          {c.city}{c.country ? `, ${c.country}` : ''}
                        </div>
                        {c.numberOfListeners != null && (
                          <div className="text-xs tabular-nums" style={{ color: 'var(--st-muted)', fontFamily: 'var(--font-inter)' }}>
                            {fmtCompact(c.numberOfListeners)} listeners
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(socials.length > 0 || spotify_id) && (
                <div className="grid grid-cols-2 gap-2">
                  {spotify_id && (
                    <a
                      href={`https://open.spotify.com/artist/${spotify_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs transition-opacity hover:opacity-70"
                      style={{ color: 'var(--st-white)', fontFamily: 'var(--font-inter)', textDecoration: 'none' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                      </svg>
                      Spotify
                    </a>
                  )}
                  {socials.map(s => (
                    <a
                      key={s.label}
                      href={s.url!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs transition-opacity hover:opacity-70"
                      style={{ color: 'var(--st-white)', fontFamily: 'var(--font-inter)', textDecoration: 'none' }}
                    >
                      {s.icon}
                      {s.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>,
      document.body
    )
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[10002] flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop overlay with fade */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: 'rgba(0,0,0,0.75)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 200ms ease',
          willChange: 'opacity',
        }}
      />

      {/* Modal content */}
      <div
        className="relative flex flex-col rounded-xl overflow-hidden"
        style={{
          width: '36.25rem',
          maxWidth: 'calc(100vw - 1rem)',
          maxHeight: '85vh',
          background: '#111',
          border: '1px solid #27272a',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(6px)',
          transition: 'opacity 80ms ease, transform 80ms ease',
          willChange: 'opacity, transform',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-50 flex items-center justify-center rounded-full shadow-md"
          style={{ width: '1.75rem', height: '1.75rem', background: 'rgba(0,0,0,0.6)', color: 'var(--st-white)', border: '1px solid #3f3f46' }}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>

        {/* Gallery — fixed at top */}
        {images.length > 0 ? (
          <Slideshow images={images} name={name} />
        ) : image_url ? (
          <div className="relative w-full overflow-hidden rounded-t-xl bg-black flex-shrink-0" style={{ height: '20rem' }}>
            <HeroImageLayers src={image_url} alt={`${name} cover`} />
          </div>
        ) : null}

        {/* Content row — sizes to left column, capped */}
        <div className="p-6 flex gap-0 items-stretch overflow-hidden">
          {/* Left column: stats + cities + socials */}
          <div className="flex flex-col gap-4 flex-shrink-0 pr-8 overflow-y-auto" style={{ maxHeight: '26.25rem', scrollbarWidth: 'none' }}>
            {followers != null && (
              <div>
                <div className="text-base font-semibold" style={{ color: 'var(--st-white)', fontFamily: 'var(--font-inter)' }}>{fmtNumber(followers, 0)}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--st-muted)', fontFamily: 'var(--font-inter)' }}>Followers</div>
              </div>
            )}
            {monthly_listeners != null && (
              <div>
                <div className="text-base font-semibold" style={{ color: 'var(--st-white)', fontFamily: 'var(--font-inter)' }}>{fmtNumber(monthly_listeners, 0)}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--st-muted)', fontFamily: 'var(--font-inter)' }}>Monthly Listeners</div>
              </div>
            )}
            {(top_cities?.length ?? 0) > 0 && (
              <div className="flex flex-col gap-3" style={{ marginTop: '1.25rem', marginBottom: '1.25rem' }}>
                {top_cities!.map((c, i) => (
                  <div key={i}>
                    <div className="text-xs font-medium" style={{ color: 'var(--st-white)', fontFamily: 'var(--font-inter)' }}>
                      {c.city}{c.country ? `, ${c.country}` : ''}
                    </div>
                    {c.numberOfListeners != null && (
                      <div className="text-xs tabular-nums" style={{ color: 'var(--st-muted)', fontFamily: 'var(--font-inter)' }}>
                        {fmtCompact(c.numberOfListeners)} listeners
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {socials.length > 0 && (
              <div className="flex flex-col gap-2 mt-auto">
                {socials.map(s => (
                  <a
                    key={s.label}
                    href={s.url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs transition-opacity hover:opacity-70"
                    style={{ color: 'var(--st-white)', fontFamily: 'var(--font-inter)', textDecoration: 'none' }}
                  >
                    {s.icon}
                    {s.label}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Right column: About text + Spotify — matches left col height via items-stretch */}
          <div className="flex-1 min-w-0 pl-8 flex flex-col" style={{ borderLeft: '1px solid #27272a', maxHeight: '26.25rem' }}>
            <div className="mb-3 flex-shrink-0"><CSXText variant="subtitle" color="STWhite">About</CSXText></div>
            <div
              className="flex-1 min-h-0 text-xs leading-relaxed tracking-[-0.025em] overflow-y-auto"
              style={{ color: 'var(--st-secondary)', fontFamily: 'var(--font-inter)', scrollbarWidth: 'none' }}
            >
              {bio}
            </div>
            {spotify_id && (
              <a
                href={`https://open.spotify.com/artist/${spotify_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-4 flex-shrink-0 text-xs transition-opacity hover:opacity-70"
                style={{ color: 'var(--st-white)', fontFamily: 'var(--font-inter)', textDecoration: 'none' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                </svg>
                Spotify
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 17L17 7M17 7H7M17 7v10"/>
                </svg>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

const INFO_ITEMS = [
  {
    key: 'industry' as const,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /><line x1="12" y1="12" x2="12" y2="12.01" />
      </svg>
    ),
  },
  {
    key: 'info_location' as const,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" />
      </svg>
    ),
  },
  {
    key: 'info_subcategory' as const,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" />
      </svg>
    ),
  },
  {
    key: 'info_active_since' as const,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    key: 'info_language' as const,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m5 8 6 6" /><path d="m4 14 6-6 2-3" /><path d="M2 5h12" /><path d="M7 2h1" /><path d="m22 22-5-10-5 10" /><path d="M14 18h6" />
      </svg>
    ),
  },
]

/**
 * Inline version of the "show more" About card — a #131313 box with the
 * gallery slideshow on the left and the bio + metadata on the right.
 * Mirrors AboutModal's desktop content, rendered directly on the page.
 */
function SXProfileAboutCardInner({
  biography,
  image_url,
  name,
  gallery = [],
  followers,
  monthly_listeners,
  top_cities,
}: SXProfileAboutProps) {
  const bio = biography ? decodeHtml(biography) : ''
  const images = (gallery ?? []).filter(Boolean)

  const hasMedia = images.length > 0 || !!image_url
  const hasMeta = followers != null || monthly_listeners != null || (top_cities?.length ?? 0) > 0
  if (!hasMedia && !hasMeta && !bio) return null

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#131313' }}>
      <div className="flex flex-col md:flex-row items-stretch">
        {/* Left: gallery slideshow / cover (blurred-fit, square) */}
        {hasMedia && (
          <div className="w-full md:flex-[0_0_26%] min-w-0">
            {images.length > 0 ? (
              <Slideshow images={images} name={name ?? ''} square />
            ) : (
              <div className="relative w-full overflow-hidden" style={{ aspectRatio: '1' }}>
                <div style={{ position: 'absolute', inset: 16, borderRadius: '0.75rem', overflow: 'hidden' }}>
                  <HeroImageLayers src={image_url!} alt={`${name} cover`} fit />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Right: About text, then stats / cities / socials below it */}
        <div className="flex-1 min-w-0 p-6 flex flex-col gap-6">
          <div className="flex flex-col">
            <div className="mb-3"><CSXText variant="subtitle" color="STWhite">About</CSXText></div>
            {bio && (
              <div
                className="text-xs leading-relaxed tracking-[-0.025em] overflow-y-auto"
                style={{ color: 'var(--st-secondary)', fontFamily: 'var(--font-inter)', maxHeight: '5rem', scrollbarWidth: 'none' }}
              >
                {bio}
              </div>
            )}
          </div>

          {hasMeta && (
            <div className="flex flex-col gap-4 mt-auto">
              {(followers != null || monthly_listeners != null) && (
                <div className="flex flex-wrap gap-x-10 gap-y-4">
                  {followers != null && (
                    <div>
                      <div className="text-base font-semibold" style={{ color: 'var(--st-white)', fontFamily: 'var(--font-inter)' }}>{fmtNumber(followers, 0)}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--st-muted)', fontFamily: 'var(--font-inter)' }}>Followers</div>
                    </div>
                  )}
                  {monthly_listeners != null && (
                    <div>
                      <div className="text-base font-semibold" style={{ color: 'var(--st-white)', fontFamily: 'var(--font-inter)' }}>{fmtNumber(monthly_listeners, 0)}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--st-muted)', fontFamily: 'var(--font-inter)' }}>Monthly Listeners</div>
                    </div>
                  )}
                </div>
              )}
              {(top_cities?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-x-10 gap-y-3">
                  {top_cities!.map((c, i) => (
                    <div key={i}>
                      <div className="text-xs font-medium" style={{ color: 'var(--st-white)', fontFamily: 'var(--font-inter)' }}>
                        {c.city}{c.country ? `, ${c.country}` : ''}
                      </div>
                      {c.numberOfListeners != null && (
                        <div className="text-xs tabular-nums" style={{ color: 'var(--st-muted)', fontFamily: 'var(--font-inter)' }}>
                          {fmtCompact(c.numberOfListeners)} listeners
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SXProfileAboutInner({
  biography,
  image_url,
  name,
  gallery = [],
  followers,
  monthly_listeners,
  top_cities,
  facebook,
  instagram,
  twitter,
  tiktok,
  spotify_id,
  industry,
  info_location,
  info_subcategory,
  info_active_since,
  info_language,
  view_count,
  holders,
}: SXProfileAboutProps) {
  const [open, setOpen] = useState(false)
  const [shouldRender, setShouldRender] = useState(false)

  useEffect(() => {
    if (open) {
      // Mount the portal modal when the user opens it (external UI signal).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShouldRender(true)
    } else {
      // 360ms covers the mobile drawer slide-out (340ms); desktop fade is faster.
      const timer = setTimeout(() => setShouldRender(false), 360)
      return () => clearTimeout(timer)
    }
  }, [open])

  const bio = biography ? decodeHtml(biography) : ''
  const images = (gallery ?? []).filter(Boolean)

  const infoValues: Record<string, string | null | undefined> = {
    industry,
    info_location,
    info_subcategory,
    info_active_since: info_active_since
      ? String(new Date(info_active_since).getFullYear())
      : null,
    info_language,
  }

  const hasInfo = INFO_ITEMS.some(f => infoValues[f.key]) || (view_count != null && view_count > 0) || (holders != null && holders > 0)
  const hasModalContent = !!(bio || images.length || image_url || followers != null || monthly_listeners != null || (top_cities?.length ?? 0) > 0 || facebook || instagram || twitter || tiktok || spotify_id)
  const hasAnything = bio || hasInfo || hasModalContent

  if (!hasAnything) return null

  return (
    <CSXAccordion
      title={<CSXText variant="subtitle" color="STWhite">About</CSXText>}
      defaultOpen={true}
      className="py-6"
    >
      <div className="flex flex-col gap-1">
        {bio && (
          <div className="leading-relaxed">
            <span className="font-sans m-0 indent-0 p-0 text-xs font-normal leading-normal tracking-[-0.025em] line-clamp-2" style={{ color: 'var(--st-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{bio}</span>
          </div>
        )}

        {hasModalContent && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="self-start text-xs font-semibold"
            style={{ color: 'var(--st-muted)', fontFamily: 'var(--font-inter)', background: 'none', border: 'none', padding: '0rem', cursor: 'pointer' }}
          >
            Show more
          </button>
        )}

        {hasInfo && (
          <div className="flex flex-wrap items-center gap-2">
            {INFO_ITEMS.map(f => {
              const val = infoValues[f.key]
              if (!val) return null
              return (
                <div
                  key={f.key}
                  className="font-sans m-0 indent-0 p-0 text-xs font-normal leading-normal tracking-[-0.025em] flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-zinc-800 bg-transparent"
                  style={{ color: 'var(--st-secondary)' }}
                >
                  <span className="shrink-0">{f.icon}</span>
                  <span style={{ position: 'relative', top: '0.0625rem' }}>{val}</span>
                </div>
              )
            })}
            {holders != null && holders > 0 && (
              <div
                className="font-sans m-0 indent-0 p-0 text-xs font-normal leading-normal tracking-[-0.025em] flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-zinc-800 bg-transparent"
                style={{ color: 'var(--st-secondary)' }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" style={{ color: 'var(--st-secondary)' }}>
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                <span style={{ position: 'relative', top: '0.0625rem' }}>{holders.toLocaleString()} holders</span>
              </div>
            )}
            {view_count != null && view_count > 0 && (
              <div
                className="font-sans m-0 indent-0 p-0 text-xs font-normal leading-normal tracking-[-0.025em] flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-zinc-800 bg-transparent"
                style={{ color: 'var(--st-secondary)' }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" style={{ color: 'var(--st-secondary)' }}>
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
                </svg>
                <span style={{ position: 'relative', top: '0.0625rem' }}>{view_count.toLocaleString()} views</span>
              </div>
            )}
          </div>
        )}
      </div>

      {shouldRender && (
        <AboutModal
          images={images}
          image_url={image_url}
          bio={bio}
          name={name ?? ''}
          followers={followers}
          monthly_listeners={monthly_listeners}
          top_cities={top_cities}
          facebook={facebook}
          instagram={instagram}
          twitter={twitter}
          tiktok={tiktok}
          spotify_id={spotify_id}
          isOpen={open}
          onClose={() => setOpen(false)}
        />
      )}
    </CSXAccordion>
  )
}

// Memoized: parents re-render on every chart-hover frame; these render
// galleries/bios that are hover-independent.
export const SXProfileAboutCard = memo(SXProfileAboutCardInner)
export const SXProfileAbout = memo(SXProfileAboutInner)
