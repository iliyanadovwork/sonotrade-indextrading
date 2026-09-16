'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { CSXText } from '@/components/sx/core/CSXText'
import { fmtIndexPrice } from '@/lib/format'

/** Enter/exit fade duration. Also the delay before unmounting on close. */
const FADE_MS = 200

interface SXSharePositionModalProps {
  isOpen: boolean
  onClose: () => void
  username: string
  artistName: string
  contracts: number
  position: 'long' | 'short'
  profitLoss: number | null
  isOpenPosition?: boolean
  entryPrice?: number
  currentPrice?: number
}

export function SXSharePositionModal({
  isOpen,
  onClose,
  username,
  artistName,
  contracts,
  position,
  profitLoss,
  isOpenPosition = false,
  entryPrice,
  currentPrice,
}: SXSharePositionModalProps) {
  const [isCopying, setIsCopying] = useState(false)
  // `shouldRender` outlives `isOpen` so the exit transition can play before the
  // node is removed. Previously the component returned null the instant isOpen
  // flipped, so it only ever faded IN — closing was an abrupt disappearance.
  const [shouldRender, setShouldRender] = useState(isOpen)
  const [visible, setVisible] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  /* eslint-disable react-hooks/set-state-in-effect --
     Drives the enter/exit animation off the `isOpen` prop: mount, then flip to
     visible on the next frame; on close, flip to hidden and unmount once the
     transition has finished. Same convention as AuthModal — each `isOpen`
     change schedules at most one transition, so the cascading-render concern
     the rule targets does not apply. */
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true)
      // Two frames: the first commits the mounted-but-transparent state, the
      // second starts the transition. One frame can be coalesced, which makes
      // the element appear instantly instead of fading.
      const raf = requestAnimationFrame(() =>
        requestAnimationFrame(() => setVisible(true)),
      )
      return () => cancelAnimationFrame(raf)
    }
    setVisible(false)
    const t = setTimeout(() => setShouldRender(false), FADE_MS)
    return () => clearTimeout(t)
  }, [isOpen])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Just ask the parent to close; the effect above plays the exit.
  const close = () => onClose()

  if (!shouldRender) return null

  const isProfitable = (profitLoss ?? 0) >= 0

  const handleCopyImage = async () => {
    if (!cardRef.current) return

    setIsCopying(true)
    try {
      // Wait for fonts to load
      await document.fonts.ready

      // Clone and prepare the node for capture
      const clone = cardRef.current.cloneNode(true) as HTMLElement

      // Set explicit dimensions to match the original constrained size
      const scale = 3 // Higher resolution for sharper text
      clone.style.width = `${cardRef.current.offsetWidth}px`
      clone.style.maxWidth = `${cardRef.current.offsetWidth}px`
      clone.style.height = 'auto' // Let it naturally calculate height
      clone.style.overflow = 'visible' // Ensure borders are visible

      // Remove all unwanted borders from text elements in the clone
      const allElements = clone.querySelectorAll('*')
      allElements.forEach((el) => {
        const htmlEl = el as HTMLElement
        // Remove borders from text containers but keep the main card border and position box border
        if (!htmlEl.classList.contains('rounded-xl') && !htmlEl.classList.contains('rounded-lg')) {
          htmlEl.style.border = 'none'
          htmlEl.style.outline = 'none'
        }
      })

      // Temporarily add clone to document for rendering
      clone.style.position = 'absolute'
      clone.style.left = '-9999px'
      document.body.appendChild(clone)

      // Small delay to ensure rendering is complete
      await new Promise(resolve => setTimeout(resolve, 100))

      // Loaded on demand — only share-image capture needs this library.
      const { default: domtoimage } = await import('dom-to-image-more')

      // Capture with higher quality and resolution
      const dataUrl = await domtoimage.toPng(clone, {
        quality: 1,
        bgcolor: '#000000',
        cacheBust: true,
        width: clone.offsetWidth * scale,
        height: clone.offsetHeight * scale,
        style: {
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          width: `${clone.offsetWidth}px`,
          height: `${clone.offsetHeight}px`
        }
      })

      // Remove clone
      document.body.removeChild(clone)

      // Convert data URL to blob
      const response = await fetch(dataUrl)
      const blob = await response.blob()

      // Try to copy to clipboard
      try {
        if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
          await navigator.clipboard.write([
            new ClipboardItem({
              'image/png': blob
            })
          ])
          alert('✅ Position card copied to clipboard!')
        } else {
          throw new Error('Clipboard API not supported')
        }
      } catch (clipboardError) {
        console.log('Clipboard not available, downloading instead:', clipboardError)
        // Fallback: download the image
        const link = document.createElement('a')
        link.download = `${artistName.replace(/\s+/g, '-').toLowerCase()}-position.png`
        link.href = dataUrl
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        alert('📥 Image downloaded to your computer!')
      }
    } catch (error) {
      console.error('Error creating image:', error)
      alert(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}. Check console for details.`)
    } finally {
      setIsCopying(false)
    }
  }

  // Portalled to <body>. This modal is rendered from SXOpenPosition, which sits
  // inside the artist page — and that container animates with a transform,
  // which makes it a containing block for `position: fixed`. Inside it the
  // modal was clipped by the panel's scroll area and could not stack above it
  // at any z-index. Same reason the claim modal is rendered outside the panel.
  return createPortal(
    <div
      className="fixed inset-0 z-[10100] pointer-events-auto flex items-center justify-center px-4"
      onClick={close}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          backgroundColor: 'rgba(0,0,0,0.75)',
          opacity: visible ? 1 : 0,
          transition: `opacity ${FADE_MS}ms ease`,
          willChange: 'opacity',
        }}
      />
      <div
        className="relative w-full max-w-lg rounded-2xl bg-black border border-zinc-800 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{
          fontFamily: 'var(--font-geist-sans)',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(6px)',
          transition: `opacity ${FADE_MS}ms ease, transform ${FADE_MS}ms ease`,
          willChange: 'opacity, transform',
        }}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2>
            <CSXText variant="body2Semibold" color="STWhite">
              Share your position
            </CSXText>
          </h2>
          <button
            type="button"
            className="cursor-pointer transition-opacity hover:opacity-80"
            aria-label="Close"
            onClick={close}
          >
            <CSXText variant="body2" color="STSecondary">
              ✕
            </CSXText>
          </button>
        </div>

        {/* Position Card */}
        <div>
          <div
            ref={cardRef}
            className="w-full rounded-xl border border-zinc-700 bg-black p-5"
          >
            {/* Trader Info */}
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <CSXText variant="body3" color="STSecondary">
                  Trader
                </CSXText>
                <div className="truncate">
                  <CSXText variant="body1" color="STWhite">
                    {username}
                  </CSXText>
                </div>
              </div>
              <div className="shrink-0 rounded-full bg-zinc-800 px-3 py-1">
                <CSXText variant="body3" color="STWhite">
                  {contracts} contract{contracts !== 1 ? 's' : ''}
                </CSXText>
              </div>
            </div>

            {/* Position Details */}
            <div className="mt-5 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
              <div className="flex items-start justify-between">
                <div className="mr-2 min-w-0">
                  <CSXText variant="body3" color="STSecondary">
                    I&apos;m {position}
                  </CSXText>
                  <div className="mt-1">
                    <CSXText variant="subtitle" color="STWhite">
                      {artistName}
                    </CSXText>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <CSXText variant="body3" color="STSecondary">
                    {isOpenPosition ? 'Unrealized P&L' : 'PnL'}
                  </CSXText>
                  <div className="mt-1">
                    <CSXText variant="subtitle" color={isProfitable ? 'STChartPositive' : 'STChartNegative'}>
                      {isProfitable ? '+' : ''}${(profitLoss ?? 0).toFixed(2)}
                    </CSXText>
                  </div>
                </div>
              </div>
              {isOpenPosition && entryPrice != null && currentPrice != null && (
                <div className="mt-3 flex gap-6 border-t border-zinc-700 pt-3">
                  {/* CSXText renders inline, so the value needs its own block to
                      sit under the label — without it these collapsed into
                      "Entry$5.70". mt-1 matches the P&L block above. */}
                  <div>
                    <CSXText variant="body3" color="STMuted">
                      Entry
                    </CSXText>
                    <div className="mt-1">
                      <CSXText variant="body3" color="STWhite">
                        ${fmtIndexPrice(entryPrice)}
                      </CSXText>
                    </div>
                  </div>
                  <div>
                    <CSXText variant="body3" color="STMuted">
                      Current
                    </CSXText>
                    <div className="mt-1">
                      <CSXText variant="body3" color="STWhite">
                        ${fmtIndexPrice(currentPrice)}
                      </CSXText>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Branding */}
            <div className="mt-5 flex items-center justify-between">
              <div className="flex items-center gap-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/sonotrade_glyph_square_transparent.png"
                  alt="Logo"
                  width={24}
                  height={24}
                  className='opacity-50'
                />
                <CSXText variant="body1" color="STMuted">
                  Sonotrade
                </CSXText>
              </div>
              <CSXText variant="chipLabelNormal" color="STMuted">
                index.sonotrade.io
              </CSXText>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex-1 mr-2">
            <div className="whitespace-nowrap">
              <CSXText variant="body3" color="STSecondary">
                {isOpenPosition ? 'Snapshot of your open position.' : 'Copy and share your closed trade.'}
              </CSXText>
            </div>
          </div>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 text-white hover:opacity-80 transition-opacity disabled:opacity-60 cursor-pointer"
            aria-label="Copy image"
            onClick={handleCopyImage}
            disabled={isCopying}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect>
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>
            </svg>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
