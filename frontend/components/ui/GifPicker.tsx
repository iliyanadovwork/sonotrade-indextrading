'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { CSXText } from '@/components/sx/core/CSXText'
import { getGiphy } from '@/lib/giphy'

/**
 * Shared GIF picker.
 *
 * Previously duplicated in five components (CommentForm, Comment, FeedForm,
 * FeedCommentItem, FeedCommentDialog), each carrying its own query/results
 * state and its own copy of the markup — so the styling had already drifted and
 * any fix had to be made five times. Owning the search state here means call
 * sites only say "open" and "what to do with the chosen URL".
 */

interface GifPickerProps {
  open: boolean
  onClose: () => void
  onSelect: (url: string) => void
}

interface GiphyImage {
  id: string
  title?: string
  images: {
    fixed_height: { url: string }
    fixed_height_small: { url: string }
  }
}

const FADE_MS = 200
const GRID_LIMIT = 24

export function GifPicker({ open, onClose, onSelect }: GifPickerProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GiphyImage[]>([])
  const [loading, setLoading] = useState(false)
  const [shouldRender, setShouldRender] = useState(open)
  const [visible, setVisible] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const reqId = useRef(0)

  const run = useCallback(async (q: string) => {
    // Out-of-order responses: a slow early query must not overwrite a later one.
    const id = ++reqId.current
    setLoading(true)
    try {
      const gf = await getGiphy()
      const { data } = q.trim()
        ? await gf.search(q.trim(), { limit: GRID_LIMIT })
        : await gf.trending({ limit: GRID_LIMIT })
      if (id === reqId.current) setResults(data as unknown as GiphyImage[])
    } catch {
      if (id === reqId.current) setResults([])
    } finally {
      if (id === reqId.current) setLoading(false)
    }
  }, [])

  /* eslint-disable react-hooks/set-state-in-effect --
     Mount/enter/exit animation driven by the `open` prop, matching AuthModal
     and SXSharePositionModal. One transition per prop change. */
  useEffect(() => {
    if (open) {
      setShouldRender(true)
      const raf = requestAnimationFrame(() =>
        requestAnimationFrame(() => setVisible(true)),
      )
      return () => cancelAnimationFrame(raf)
    }
    setVisible(false)
    const t = setTimeout(() => setShouldRender(false), FADE_MS)
    return () => clearTimeout(t)
  }, [open])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Trending on open, so the grid is never an empty box.
  useEffect(() => {
    if (!open) return
    void run('')
    inputRef.current?.focus()
  }, [open, run])

  // Debounced search-as-you-type; the old picker required Enter or a button.
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => void run(query), 250)
    return () => clearTimeout(t)
  }, [query, open, run])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!shouldRender) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[10100] pointer-events-auto flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          opacity: visible ? 1 : 0,
          transition: `opacity ${FADE_MS}ms ease`,
          willChange: 'opacity',
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search GIFs"
        onClick={e => e.stopPropagation()}
        className="relative flex w-full max-w-[28rem] flex-col rounded-2xl border border-[rgba(255,255,255,0.1)] bg-black p-5 shadow-2xl"
        style={{
          fontFamily: 'var(--font-geist-sans)',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(6px)',
          transition: `opacity ${FADE_MS}ms ease, transform ${FADE_MS}ms ease`,
          willChange: 'opacity, transform',
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <CSXText variant="body2Semibold" color="STWhite">Search GIFs</CSXText>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="cursor-pointer text-st-secondary transition-colors hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Pill input, matching the sign-up and trade surfaces. */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search GIFs"
          className="mb-4 h-10 w-full rounded-full border border-transparent bg-[#131313] px-4 text-sm text-white placeholder:text-[#7a7a7a] transition-colors focus:border-[rgba(255,255,255,0.2)] focus:outline-none"
        />

        <style>{`
          .gif-grid::-webkit-scrollbar { display: none; }
          .gif-grid { scrollbar-width: none; }
        `}</style>

        <div className="gif-grid -mr-1 grid max-h-[20rem] grid-cols-3 gap-2 overflow-y-auto pr-1">
          {loading && results.length === 0
            // Skeletons keep the grid from collapsing while loading, which is
            // what made the old picker jump.
            ? Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="aspect-square w-full animate-pulse rounded-lg bg-[#131313]" />
              ))
            : results.map(gif => (
                <button
                  key={gif.id}
                  type="button"
                  onClick={() => onSelect(gif.images.fixed_height.url)}
                  className="group relative aspect-square w-full overflow-hidden rounded-lg bg-[#131313] transition-transform duration-100 active:scale-[0.96]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={gif.images.fixed_height_small.url}
                    alt={gif.title || 'GIF'}
                    loading="lazy"
                    // Uniform square tiles: the old 2-column grid used the
                    // images' natural heights, so rows were ragged.
                    className="h-full w-full object-cover transition-opacity group-hover:opacity-80"
                  />
                </button>
              ))}
        </div>

        {!loading && results.length === 0 && (
          <div className="py-8 text-center">
            <CSXText variant="body2" color="STMuted">
              {query.trim() ? `No GIFs for “${query.trim()}”` : 'No GIFs found'}
            </CSXText>
          </div>
        )}

        <div className="mt-4 text-right">
          <CSXText variant="body3" color="STMuted">Powered by GIPHY</CSXText>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default GifPicker
