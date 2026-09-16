'use client'

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CSXText } from '@/components/sx/core/CSXText'

// Ref-counted scroll lock — multiple concurrent sheets cooperate correctly
let _lockCount = 0
function acquireScrollLock() { if (++_lockCount === 1) document.body.style.overflow = 'hidden' }
function releaseScrollLock() { if (--_lockCount <= 0) { _lockCount = 0; document.body.style.overflow = '' } }

interface BottomSheetProps {
  isOpen: boolean
  onClose: () => void
  title: ReactNode
  subtitle?: ReactNode
  zIndex?: number
  children: ReactNode
}

export function BottomSheet({ isOpen, onClose, title, subtitle, zIndex = 10000, children }: BottomSheetProps) {
  const [shouldRender, setShouldRender] = useState(false)
  const [visible, setVisible] = useState(false)
  const [mounted, setMounted] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true)
      acquireScrollLock()
      return releaseScrollLock
    } else {
      setVisible(false)
      const t = setTimeout(() => setShouldRender(false), 350)
      return () => clearTimeout(t)
    }
  }, [isOpen])

  // Force reflow on the sheet element before flipping visible — guarantees the
  // browser has committed the initial translateY(100%) before the transition starts.
  useLayoutEffect(() => {
    if (!shouldRender || !isOpen) return
    sheetRef.current?.getBoundingClientRect()
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [shouldRender, isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!mounted || !shouldRender) return null

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex }}>
      <div
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', opacity: visible ? 1 : 0, transition: 'opacity 340ms cubic-bezier(0.16,1,0.3,1)' }}
        onClick={onClose}
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        style={{ position: 'absolute', bottom: '0rem', left: '0rem', right: '0rem', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'rgb(10,10,10)', borderRadius: '1.25rem 1.25rem 0 0', maxHeight: '85%', transform: visible ? 'translateY(0)' : 'translateY(100%)', transition: 'transform 340ms cubic-bezier(0.16,1,0.3,1)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '0.75rem', paddingBottom: '0.25rem', flexShrink: 0 }}>
          <div style={{ height: '0.25rem', width: '2.5rem', borderRadius: '62.4375rem', background: '#3f3f46' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.25rem 1rem 0.75rem', flexShrink: 0 }}>
          <div>
            {subtitle && (
              <div style={{ marginBottom: '0.125rem' }}>
                <CSXText variant="body2" color="STSecondary">{subtitle}</CSXText>
              </div>
            )}
            <CSXText variant="body2Semibold" color="STWhite">{title}</CSXText>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '2rem', height: '2rem', flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--st-secondary)' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div style={{ height: '0.0625rem', background: '#27272a', flexShrink: 0 }} />
        <div style={{ overflowY: 'auto', flex: 1, padding: '0 1rem', paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}
