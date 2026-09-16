'use client'

import { useEffect, useState } from 'react'
import { Share2, Check } from 'lucide-react'

interface SXShareButtonProps {
  /** Ticker for the share URL (`/artist/${ticker}`). */
  ticker: string
  /** Display name used in the share-sheet title. */
  name: string
  size?: number
  className?: string
  /** Title attribute / aria-label. Defaults to "Share". */
  title?: string
}

/**
 * Profile-page share button. Behaviour mirrors OLD:
 *   - Mobile (navigator.share available): opens the native share sheet
 *     so the OS controls the app list (WhatsApp, Messages, etc).
 *   - Desktop / no Web Share API: copies the profile URL to the clipboard
 *     and flashes a "Copied!" indicator.
 *   - User cancellation of the native sheet is silent — we don't fall
 *     back to copy because they cancelled deliberately.
 */
export function SXShareButton({
  ticker,
  name,
  size = 18,
  className = '',
  title = 'Share',
}: SXShareButtonProps) {
  const [copied, setCopied] = useState(false)
  const [pressed, setPressed] = useState(false)

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1800)
    return () => clearTimeout(t)
  }, [copied])

  async function handleClick() {
    if (typeof window === 'undefined') return
    const url = `${window.location.origin}/profile/${ticker}`
    const shareTitle = `${name}'s Index | Sonotrade`
    const shareText = `Check out ${name}'s Index on Sonotrade`

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ url, title: shareTitle, text: shareText })
        return
      } catch (err) {
        // User-cancelled (AbortError) → bail silently. Other errors fall
        // through to clipboard copy as a recovery path.
        if (err instanceof DOMException && err.name === 'AbortError') return
      }
    }

    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      // Insecure context or no clipboard API — last-resort prompt.
      try {
        window.prompt('Copy this link:', url)
      } catch {
        /* give up */
      }
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      title={copied ? 'Copied!' : title}
      aria-label={copied ? 'Link copied to clipboard' : title}
      className={`relative bg-transparent rounded transition-colors hover:bg-zinc-800/50 ${className}`}
      style={{
        color: 'white',
        border: 'none',
        cursor: 'pointer',
        padding: '0.375rem',
        display: 'flex',
        alignItems: 'center',
        transition:
          'background-color 150ms, transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        transform: pressed ? 'scale(0.88)' : 'scale(1)',
      }}
    >
      {copied ? <Check size={size} /> : <Share2 size={size} />}
      {copied && (
        <span
          role="status"
          className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[0.625rem] font-medium text-white shadow-lg pointer-events-none"
        >
          Copied!
        </span>
      )}
    </button>
  )
}
