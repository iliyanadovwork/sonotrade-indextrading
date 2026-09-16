'use client'

import { useEffect, useRef, useState } from 'react'
import { CSXText } from '@/components/sx/core/CSXText'

const TRACK_H = 60
const THUMB_W = 80
const THUMB_SZ = 56
const TRACK_PAD = 2
const SLIDE_THRESHOLD = 0.85

interface SlideToTradeProps {
  label: string
  disabled: boolean
  isExecuting: boolean
  /** Flip this each time a trade errors so the thumb springs back. */
  errorKey?: number
  onConfirm: () => void
}

/**
 * Web port of the frontend-expo "slide to trade" control. A draggable thumb
 * slides across a track; crossing 85% confirms (arrow → check, track turns
 * green) and fires onConfirm. Springs back on release-before-threshold or
 * when errorKey changes.
 */
export function SlideToTrade({ label, disabled, isExecuting, errorKey = 0, onConfirm }: SlideToTradeProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(0) // 0..1
  const [dragging, setDragging] = useState(false)
  const [trackW, setTrackW] = useState(0)
  const confirmedRef = useRef(false)
  const startXRef = useRef(0)
  const blocked = disabled || isExecuting

  // Spring the thumb back to 0 whenever a trade errors after confirming.
  // Intentional setState-in-effect: resetting UI in response to an external
  // signal (a failed trade bumps errorKey).
  useEffect(() => {
    if (errorKey === 0) return
    confirmedRef.current = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDragging(false)
    setProgress(0)
  }, [errorKey])

  // Measure the track width outside of render (refs may not be read during render)
  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    const update = () => setTrackW(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const maxTravel = Math.max(1, trackW - THUMB_W - TRACK_PAD * 2)

  const onPointerDown = (e: React.PointerEvent) => {
    if (blocked || confirmedRef.current) return
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    startXRef.current = e.clientX
    setDragging(true)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging || confirmedRef.current) return
    const p = Math.max(0, Math.min(1, (e.clientX - startXRef.current) / maxTravel))
    setProgress(p)
    if (p >= SLIDE_THRESHOLD) {
      confirmedRef.current = true
      setDragging(false)
      setProgress(1)
      onConfirm()
    }
  }

  const onPointerUp = () => {
    if (confirmedRef.current) return
    setDragging(false)
    setProgress(0)
  }

  const confirmed = progress >= 1
  const transition = dragging ? 'none' : 'transform 220ms cubic-bezier(0.16,1,0.3,1), width 220ms cubic-bezier(0.16,1,0.3,1)'
  const travel = maxTravel * progress

  return (
    <div
      ref={trackRef}
      style={{
        position: 'relative',
        height: TRACK_H,
        borderRadius: TRACK_H / 2,
        background: confirmed ? '#012e1e' : '#27272a',
        padding: TRACK_PAD,
        opacity: disabled ? 0.42 : 1,
        transition: 'background 220ms ease',
        touchAction: 'none',
        userSelect: 'none',
        overflow: 'hidden',
      }}
    >
      {/* Track label — centered, fades out as the thumb advances */}
      <div
        style={{
          position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: Math.max(0, 1 - progress / 0.35),
          pointerEvents: 'none',
        }}
      >
        <CSXText variant="title" color="STSecondary">{label}</CSXText>
      </div>

      {/* Draggable thumb */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          width: THUMB_W,
          height: THUMB_SZ,
          borderRadius: THUMB_SZ / 2,
          background: confirmed ? '#04df9d' : '#ffffff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transform: `translateX(${travel}px)`,
          transition: confirmed ? `${transition}, background 160ms ease` : transition,
          boxShadow: '0 0.125rem 0.5rem rgba(255,255,255,0.15)',
          cursor: disabled ? 'default' : 'grab',
          touchAction: 'none',
        }}
      >
        {/* Arrow — fades out near the end */}
        <span style={{ position: 'absolute', opacity: Math.max(0, 1 - Math.max(0, progress - 0.7) / 0.3), display: 'flex' }}>
          <svg width={19.8} height={19.8} viewBox="0 0 24 24" fill="none">
            <path d="M9 18l6-6-6-6" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        {/* Check — appears at the end */}
        <span style={{ position: 'absolute', opacity: Math.max(0, (progress - 0.85) / 0.15), display: 'flex' }}>
          <svg width={19.8} height={19.8} viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
    </div>
  )
}
