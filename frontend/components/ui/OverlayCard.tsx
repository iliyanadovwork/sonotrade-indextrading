'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { CSXText } from '@/components/sx/core/CSXText'

/**
 * The one centred-card overlay: portal, backdrop, fade in/out, heading.
 *
 * Before this, the trade / position / GIF pickers and the reply dialog each
 * rolled their own and had drifted into four behaviours — two faded in with
 * `animate-in` but vanished instantly on close (no exit animation at all),
 * three faded at 80ms which reads as a snap, and one went through Radix.
 *
 * Also centralises the two things those copies kept getting wrong:
 *  - portalling to <body>, to escape ancestors that create a containing block
 *    for `position: fixed` (the artist page's zIndex:1 layer, Radix's
 *    translate-based dialog);
 *  - `pointer-events: auto`, because a modal Radix dialog sets
 *    `pointer-events: none` on <body> and body-level portals inherit it.
 */

/** Enter/exit duration, and the delay before unmounting. */
const FADE_MS = 200

interface OverlayCardProps {
  open: boolean
  onClose: () => void
  /** Rendered as the card heading, in the shared popup-title style. */
  title?: ReactNode
  children: ReactNode
  /** Tailwind max-width class for the card. */
  maxWidthClassName?: string
}

export function OverlayCard({
  open,
  onClose,
  title,
  children,
  maxWidthClassName = 'max-w-[26.25rem]',
}: OverlayCardProps) {
  const [shouldRender, setShouldRender] = useState(open)
  const [visible, setVisible] = useState(false)

  /* eslint-disable react-hooks/set-state-in-effect --
     Mount before the enter transition, unmount after the exit one. Each `open`
     change schedules exactly one transition, so the cascading-render concern
     this rule targets does not apply. Same convention as AuthModal. */
  useEffect(() => {
    if (open) {
      setShouldRender(true)
      // Two frames: the first commits the transparent state, the second starts
      // the transition. A single frame can be coalesced, which skips the fade.
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

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!shouldRender) return null

  return createPortal(
    <div
      className="pointer-events-auto fixed inset-0 z-[10100] flex items-center justify-center p-4"
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
        onClick={e => e.stopPropagation()}
        className={`relative w-full ${maxWidthClassName} rounded-2xl border border-[rgba(255,255,255,0.1)] bg-black p-5 shadow-2xl`}
        style={{
          fontFamily: 'var(--font-geist-sans)',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(6px)',
          transition: `opacity ${FADE_MS}ms ease, transform ${FADE_MS}ms ease`,
          willChange: 'opacity, transform',
        }}
      >
        {title != null && (
          <div className="mb-4 flex items-center justify-between">
            <CSXText variant="body2Semibold" color="STWhite">{title}</CSXText>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="cursor-pointer text-st-secondary transition-colors hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  )
}

export default OverlayCard
