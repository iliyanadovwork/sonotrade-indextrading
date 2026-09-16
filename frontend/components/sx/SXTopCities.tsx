'use client'

import { useEffect, useRef, useState } from 'react'
import { CSXText } from './core/CSXText'
import { fmtCompact } from '@/lib/format'

interface TopCity {
  city: string
  country?: string
  region?: string
  numberOfListeners?: number
}

interface SXTopCitiesProps {
  cities: TopCity[]
}

export function SXTopCities({ cities }: SXTopCitiesProps) {
  const [animated, setAnimated] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setAnimated(true)
          observer.disconnect()
        }
      },
      { threshold: 0.15 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  if (!cities || cities.length === 0) return null

  const display = cities.slice(0, 10)
  const maxListeners = Math.max(...display.map(c => c.numberOfListeners ?? 0))

  return (
    <div ref={ref}>
      <div className="py-4">
        <CSXText variant="subtitle" color="STWhite">Top Cities</CSXText>
      </div>

      <div
        className="flex flex-col overflow-y-auto"
        style={{ maxHeight: '17.5rem', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {display.map((city, i) => {
          const pct = maxListeners > 0 && city.numberOfListeners != null
            ? (city.numberOfListeners / maxListeners) * 100
            : 0

          return (
            <div key={i} className="flex items-center gap-3 py-2.5 group">
              {/* City info + bar */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="flex-shrink-0 tabular-nums text-sm"
                      style={{ color: 'var(--st-white)', fontFamily: 'var(--font-geist-sans)' }}
                    >
                      {i + 1}.
                    </span>
                    <span
                      className="truncate text-sm font-medium"
                      style={{ color: 'var(--st-white)', fontFamily: 'var(--font-geist-sans)' }}
                    >
                      {city.city}
                    </span>
                    {city.country && (
                      <span
                        className="text-xs flex-shrink-0"
                        style={{ color: 'var(--st-muted)', fontFamily: 'var(--font-geist-sans)' }}
                      >
                        {city.country}
                      </span>
                    )}
                  </div>
                  {city.numberOfListeners != null && (
                    <span
                      className="flex-shrink-0 tabular-nums text-xs"
                      style={{ color: 'var(--st-muted)', fontFamily: 'var(--font-geist-sans)' }}
                    >
                      {fmtCompact(city.numberOfListeners, '')}
                    </span>
                  )}
                </div>
                {/* Progress bar */}
                {maxListeners > 0 && (
                  <div className="w-full rounded-full overflow-hidden" style={{ height: '0.125rem', background: '#27272a' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: animated ? `${pct}%` : '0%',
                        background: 'var(--st-white)',
                        opacity: 0.25 + (pct / 100) * 0.65,
                        transition: animated
                          ? `width 0.7s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${i * 60}ms`
                          : 'none',
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
