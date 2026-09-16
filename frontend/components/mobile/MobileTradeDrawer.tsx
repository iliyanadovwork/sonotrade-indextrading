'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { SXTradingPanel } from '@/components/sx/SXTradingPanel'
import { CSXText } from '@/components/sx/core/CSXText'
import { fmtIndexPrice } from '@/lib/format'

interface MobileTradeDrawerProps {
  isOpen: boolean
  onClose: () => void
  spotifyId: string
  profileName: string
  livePrice: number
}

export function MobileTradeDrawer({ isOpen, onClose, spotifyId, profileName, livePrice }: MobileTradeDrawerProps) {
  const [shouldRender, setShouldRender] = useState(false)
  const [visible, setVisible] = useState(false)
  const [mounted, setMounted] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true)
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    } else {
      setVisible(false)
      const t = setTimeout(() => setShouldRender(false), 350)
      return () => clearTimeout(t)
    }
  }, [isOpen])

  useLayoutEffect(() => {
    if (!shouldRender || !isOpen) return
    drawerRef.current?.getBoundingClientRect()
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [shouldRender, isOpen])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!mounted || !shouldRender) return null

  return createPortal(
    // Single fixed wrapper anchored to the viewport — children use absolute positioning
    // so they're not affected by html zoom or transform containing blocks
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000 }}>
      {/* Backdrop */}
      <div
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.6)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 340ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={onClose}
      />

      {/* Bottom sheet */}
      <div
        ref={drawerRef}
        style={{
          position: 'absolute', bottom: '0rem', left: '0rem', right: '0rem',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          background: 'rgb(10,10,10)',
          borderRadius: '1.25rem 1.25rem 0 0',
          maxHeight: '90%',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 340ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '0.75rem', paddingBottom: '0.25rem', flexShrink: 0 }}>
          <div style={{ height: '0.25rem', width: '2.5rem', borderRadius: '62.4375rem', background: '#3f3f46' }} />
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.25rem 1rem 0.75rem', flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
            <CSXText variant="body2" color="STSecondary">{profileName}</CSXText>
            <div className="flex items-baseline gap-1.5">
              <CSXText variant="body2Semibold" color="STWhite">
                <span style={{ fontFamily: 'var(--font-inter)', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtIndexPrice(livePrice)}
                </span>
              </CSXText>
              <CSXText variant="body2" color="STSecondary">points</CSXText>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            type="button"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '2rem', height: '2rem', flexShrink: 0,
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--st-secondary)',
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div style={{ height: '0.0625rem', background: '#27272a', margin: '0 1rem', flexShrink: 0 }} />

        <div style={{ overflowY: 'auto', flex: 1, padding: '0 1rem', paddingTop: '1rem', paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}>
          {/* Confirmation lives inside the panel itself (full-card animated
              checkmark), so the sheet needs no success overlay of its own. */}
          <SXTradingPanel
            spotifyId={spotifyId}
            contractPrice={livePrice}
            mobile
            focusAmount={visible}
          />
        </div>
      </div>
    </div>,
    document.body
  )
}
