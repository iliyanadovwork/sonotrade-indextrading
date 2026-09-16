'use client'

import React, { useEffect, useRef } from 'react'
import { CSXText } from '@/components/sx/core/CSXText'

const METRIC_ROWS = [
  { source: 'SPOTIFY',      label: 'Monthly Listeners', signal: 'HIGH', trend: '+12.4%', note: 'Primary index weight' },
  { source: 'APPLE MUSIC',  label: 'Chart Position',    signal: 'MED',  trend: '+6.1%',  note: 'Regional chart data' },
  { source: 'YOUTUBE',      label: 'Stream Volume',     signal: 'HIGH', trend: '+31.2%', note: '90-day rolling avg' },
  { source: 'SHAZAM',       label: 'Discovery Rate',    signal: 'MED',  trend: '+8.7%',  note: 'New listener signal' },
  { source: 'SOUNDCLOUD',   label: 'Reposts',           signal: 'LOW',  trend: '+3.2%',  note: 'Underground reach' },
  { source: 'DEEZER',       label: 'Active Streams',    signal: 'MED',  trend: '+9.0%',  note: 'EU market data' },
  { source: 'AMAZON MUSIC', label: 'Prime Plays',       signal: 'MED',  trend: '+7.5%',  note: 'Paid listener base' },
  { source: 'PANDORA',      label: 'Station Adds',      signal: 'LOW',  trend: '+2.1%',  note: 'US radio proxy' },
  { source: 'GENIUS',       label: 'Annotation Views',  signal: 'MED',  trend: '+15.3%', note: 'Fan engagement' },
]

const ROW_H = 72
const GAP = 28
const STRIDE = ROW_H + GAP
const TOTAL_H = METRIC_ROWS.length * STRIDE
const VISIBLE = 5
const CONTAINER_H = VISIBLE * STRIDE - GAP

const SCROLLER_STYLE: React.CSSProperties = {
  width: '560px',
  height: CONTAINER_H,
  perspective: '900px',
  perspectiveOrigin: '50% 50%',
  overflow: 'hidden',
  position: 'relative',
  maskImage: 'linear-gradient(to bottom, transparent 0%, black 30%, black 70%, transparent 100%)',
  WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 30%, black 70%, transparent 100%)',
}

const INNER_STYLE: React.CSSProperties = {
  position: 'relative',
  height: '100%',
  transformStyle: 'preserve-3d',
}

const ROW_STYLE: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  height: ROW_H,
  opacity: 0,
  transformOrigin: '50% 50%',
}

export const SXStreamingMetricsScroller = React.memo(function SXStreamingMetricsScroller() {
  const containerRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<number | null>(null)
  const offsetRef = useRef(0)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const rowEls = Array.from(container.querySelectorAll<HTMLElement>('[data-row]'))
    const centerY = CONTAINER_H / 2

    const animate = () => {
      offsetRef.current = (offsetRef.current + 0.35) % TOTAL_H
      const offset = offsetRef.current

      rowEls.forEach((el, i) => {
        let y = i * STRIDE - offset
        y = ((y % TOTAL_H) + TOTAL_H) % TOTAL_H
        if (y > TOTAL_H / 2) y -= TOTAL_H

        const itemCenter = y + ROW_H / 2
        const dist = Math.abs(itemCenter)
        const halfH = CONTAINER_H / 2
        const t = Math.min(dist / halfH, 1)
        const maxAngle = 55
        const angle = t * maxAngle * -Math.sign(itemCenter)
        const scaleX = Math.cos((t * maxAngle * Math.PI) / 180)
        const opacity = Math.max(0, 1 - t * 1.1)

        el.style.transform = `translateY(${y + centerY - ROW_H / 2}px) rotateX(${angle}deg) scaleX(${Math.max(0.4, scaleX)})`
        el.style.opacity = String(opacity)
      })

      animRef.current = requestAnimationFrame(animate)
    }

    animRef.current = requestAnimationFrame(animate)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [])

  return (
    <div style={SCROLLER_STYLE}>
      <div ref={containerRef} style={INNER_STYLE}>
        {METRIC_ROWS.map((item) => (
          <div key={item.source} data-row style={ROW_STYLE}>
            <div
              className="flex items-center justify-between px-5 h-full rounded-lg"
              style={{ border: '1px solid var(--st-border)', backgroundColor: 'rgba(255,255,255,0.02)' }}
            >
              <div className="flex items-center gap-4">
                <span
                  className="text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color: 'var(--st-secondary)', fontFamily: 'var(--font-geist-sans)', minWidth: '96px' }}
                >
                  {item.source}
                </span>
                <CSXText variant="subtitle2" color="STWhite">{item.label}</CSXText>
              </div>
              <div className="flex items-center gap-6">
                <CSXText variant="body2" color="STSecondary">{item.note}</CSXText>
                <span
                  className="text-xs font-medium"
                  style={{
                    color: item.trend.startsWith('+') ? 'var(--st-positive)' : 'var(--st-chart-negative)',
                    fontFamily: 'var(--font-geist-sans)',
                    minWidth: '52px',
                    textAlign: 'right',
                  }}
                >
                  {item.trend}
                </span>
                <span
                  className="text-[10px] font-semibold uppercase tracking-widest px-2 py-1 rounded"
                  style={{
                    color: item.signal === 'HIGH' ? 'var(--st-white)' : 'var(--st-secondary)',
                    backgroundColor: item.signal === 'HIGH' ? 'rgba(255,255,255,0.08)' : 'transparent',
                    border: '1px solid var(--st-border)',
                    fontFamily: 'var(--font-geist-sans)',
                    minWidth: '40px',
                    textAlign: 'center',
                  }}
                >
                  {item.signal}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
})
