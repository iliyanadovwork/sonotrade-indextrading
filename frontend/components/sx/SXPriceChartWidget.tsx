'use client'

import { useState, useMemo, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import NumberFlow from '@number-flow/react'
import { CSXText, csxTextVariantClass, type SXColorToken } from '@/components/sx/core/CSXText'
import { resolveSXColor } from '@/components/sx/core/sx-color-tokens'
import { formatChartLabel, formatChartXTick } from '@/lib/format-time'
import { clientXToSvgUserX } from '@/lib/svgPointer'
import { fmtIndexPrice, indexPriceDecimals } from '@/lib/format'

type TimePeriod = '1H' | '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL'

interface SXPriceChartWidgetProps {
  data?: Array<{ timestamp: number; price: number }> | Array<{ index: number; timestamp: string }>
  className?: string
  onPeriodChange?: (period: TimePeriod) => void
  initialPeriod?: TimePeriod
  onHoverValueChange?: (value: number | null) => void
  height?: number
  forceColor?: string
}

const V_PAD_TOP = 36
const V_PAD_BOTTOM = 50.4
// "86.77" (4-digit price) at 10px Geist Sans ≈ 30px text + 14px clearance
const YAXIS_W = 39.6

// ── Digit roller ────────────────────────────────────────────────────────────
export function AnimatedPrice({
  value,
  fontSize = 28,
  color = 'STWhite',
  prefix,
  suffix,
}: {
  value: number
  fontSize?: number
  color?: SXColorToken | string
  prefix?: string
  suffix?: string
}) {
  const resolved = resolveSXColor(color)
  return (
    <span style={{ color: resolved, display: 'inline-flex', alignItems: 'center' }}>
      <NumberFlow
        value={value}
        prefix={prefix}
        suffix={suffix}
        format={{ minimumFractionDigits: indexPriceDecimals(value), maximumFractionDigits: indexPriceDecimals(value) }}
        className={csxTextVariantClass('chartAnimatedPrice')}
        style={{ fontSize, fontFamily: 'var(--font-inter)' }}
      />
    </span>
  )
}

// ── Main chart ───────────────────────────────────────────────────────────────
export function SXPriceChartWidget({
  data = [],
  className = '',
  onPeriodChange,
  initialPeriod = '1D',
  onHoverValueChange,
  height: heightProp,
  forceColor,
}: SXPriceChartWidgetProps) {
  const CHART_H = heightProp ?? 288
  const [timePeriod, setTimePeriod] = useState<TimePeriod>(initialPeriod)
  const svgRef = useRef<SVGSVGElement>(null)
  const [svgWidth, setSvgWidth] = useState(800)
  const [hover, setHover] = useState<{ x: number; y: number; price: number; timestamp: number } | null>(null)
  const [drawProgress, setDrawProgress] = useState(0)
  const [drawDone, setDrawDone] = useState(false)
  const drawAnimRef = useRef<number | null>(null)
  const drawStartRef = useRef<number>(0)
  const drawKeyRef = useRef('')

  const handlePeriodChange = (period: TimePeriod) => {
    setTimePeriod(period)
    onPeriodChange?.(period)
  }

  // Track SVG width — useLayoutEffect + ResizeObserver so first paint already has correct width
  useLayoutEffect(() => {
    const el = svgRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width
      if (w) setSvgWidth(w)
    })
    ro.observe(el)
    const initial = el.getBoundingClientRect().width
    if (initial) setSvgWidth(initial)
    return () => ro.disconnect()
  }, [])

  // Normalize raw data
  const allData = useMemo(() => {
    if (data.length === 0) return []
    return data
      .map(point => {
        if ('index' in point) {
          return { timestamp: new Date(point.timestamp).getTime(), price: parseFloat(point.index.toString()) }
        }
        return point as { timestamp: number; price: number }
      })
      .sort((a, b) => a.timestamp - b.timestamp)
  }, [data])

  // Filter to selected time window + extend to now
  const chartData = useMemo(() => {
    if (allData.length === 0) return []
    const now = Date.now()
    const periodMs: Record<TimePeriod, number> = {
      '1H': 60 * 60 * 1000,
      '1D': 24 * 60 * 60 * 1000,
      '1W': 7 * 24 * 60 * 60 * 1000,
      '1M': 30 * 24 * 60 * 60 * 1000,
      '3M': 90 * 24 * 60 * 60 * 1000,
      '6M': 180 * 24 * 60 * 60 * 1000,
      '1Y': 365 * 24 * 60 * 60 * 1000,
      'ALL': Infinity,
    }
    const cutoffTime = now - periodMs[timePeriod]
    const oldestTimestamp = allData[0].timestamp
    let points: { timestamp: number; price: number }[]
    if (timePeriod === 'ALL' || cutoffTime < oldestTimestamp) {
      points = allData
    } else {
      const inWindow = allData.filter(d => d.timestamp >= cutoffTime)
      const lastBefore = [...allData].reverse().find(d => d.timestamp < cutoffTime)
      const anchor = lastBefore ? [{ timestamp: cutoffTime, price: lastBefore.price }] : []
      points = [...anchor, ...inWindow]
    }
    const last = points[points.length - 1]
    if (last && last.timestamp < now) {
      const span = now - (points[0]?.timestamp ?? now)
      const minTailMs = span * 0.04
      const tailMs = Math.max(now - last.timestamp, minTailMs)
      points = [...points, { timestamp: last.timestamp + tailMs, price: last.price }]
    }
    return points
  }, [allData, timePeriod])

  const firstPrice = chartData[0]?.price ?? 0
  const lastPrice = chartData[chartData.length - 1]?.price ?? 0
  const isPositive = lastPrice >= firstPrice
  const lineColor =
    forceColor ?? resolveSXColor(isPositive ? 'STChartPositive' : 'STChartNegative')

  const FUTURE_PAD = YAXIS_W
  const W = svgWidth
  const CHART_W = W - FUTURE_PAD
  const startTime = chartData[0]?.timestamp ?? 0
  const endTime = chartData[chartData.length - 1]?.timestamp ?? startTime + 1
  const timeRange = endTime - startTime || 1
  const minPrice = chartData.length > 0 ? Math.min(...chartData.map(d => d.price)) : 0
  const maxPrice = chartData.length > 0 ? Math.max(...chartData.map(d => d.price)) : 1
  const priceRange = maxPrice === minPrice ? 1 : maxPrice - minPrice

  const points = useMemo(() => chartData.map(d => ({
    x: ((d.timestamp - startTime) / timeRange) * CHART_W,
    y: V_PAD_TOP + (1 - (d.price - minPrice) / priceRange) * (CHART_H - V_PAD_TOP - V_PAD_BOTTOM),
    price: d.price,
    timestamp: d.timestamp,
  })), [chartData, CHART_W, startTime, timeRange, minPrice, priceRange, CHART_H])

  const linePath = useMemo(() => {
    if (points.length < 2) return ''
    // Straight line connecting the dots (linear interpolation)
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  }, [points])

  const totalLength = useMemo(() => {
    return points.reduce((sum, p, i) => {
      if (i === 0) return 0
      const prev = points[i - 1]!
      return sum + Math.hypot(p.x - prev.x, p.y - prev.y)
    }, 0)
  }, [points])

  // Unique key for this dataset + timeframe — resets draw animation
  const dataKey = chartData.length > 0
    ? `${timePeriod}-${chartData.length}-${chartData[0]?.price?.toFixed(4)}-${chartData[chartData.length - 1]?.price?.toFixed(4)}`
    : ''

  // Draw-on animation — useLayoutEffect so reset fires before browser paint, eliminating flash
  useLayoutEffect(() => {
    if (chartData.length < 2) return
    drawKeyRef.current = dataKey
    setDrawProgress(0)
    setDrawDone(false)
    if (drawAnimRef.current) cancelAnimationFrame(drawAnimRef.current)
    drawStartRef.current = performance.now()
    const DURATION = 1000
    const animate = (now: number) => {
      const t = Math.min((now - drawStartRef.current) / DURATION, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setDrawProgress(eased)
      if (t < 1) {
        drawAnimRef.current = requestAnimationFrame(animate)
      } else {
        setDrawDone(true)
      }
    }
    drawAnimRef.current = requestAnimationFrame(animate)
    return () => { if (drawAnimRef.current) cancelAnimationFrame(drawAnimRef.current) }
  }, [dataKey])

  // Mouse hover — binary search for nearest segment
  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (points.length < 2) return
    const svg = e.currentTarget as SVGSVGElement
    const x = clientXToSvgUserX(svg, e.clientX, e.clientY)
    if (x === null) return
    if (x > CHART_W) { setHover(null); onHoverValueChange?.(null); return }
    let lo = 0, hi = points.length - 2
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (points[mid].x <= x) lo = mid; else hi = mid - 1
    }
    const ceilIdx = Math.min(lo + 1, points.length - 1)
    const dx = points[ceilIdx].x - points[lo].x
    const t = dx > 0 ? (x - points[lo].x) / dx : 0
    // path is step-after (H then V), so y and price hold at the left segment until the vertical jump
    const y = points[lo].y
    const price = points[lo].price
    const timestamp = points[lo].timestamp + t * (points[ceilIdx].timestamp - points[lo].timestamp)
    setHover({ x, y, price, timestamp })
    onHoverValueChange?.(price)
  }, [points, onHoverValueChange])

  const handleMouseLeave = useCallback(() => {
    setHover(null)
    onHoverValueChange?.(null)
  }, [onHoverValueChange])

  const last = points[points.length - 1]
  const effectiveProgress = drawKeyRef.current === dataKey ? drawProgress : 0
  const dashOffset = totalLength > 0 ? (totalLength + 4) * (1 - effectiveProgress) : 0
  const lineReady = drawKeyRef.current === dataKey

  // X-axis tick timestamps (evenly spaced by time)
  const xTicks = useMemo(() => {
    if (chartData.length < 2) return []
    const n = 5
    return Array.from({ length: n }, (_, i) => startTime + (i * timeRange / (n - 1)))
  }, [startTime, timeRange, chartData.length])

  // Declare CHART_W and FUTURE_PAD for use in JSX
  const CHART_W_CONST = CHART_W

  return (
    <div className={`bg-transparent ${className}`}>
      {/* CSS keyframe for pulsating dot */}
      <style>{`
        @keyframes sxDotPulse {
          0%   { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(3.2); opacity: 0; }
        }
      `}</style>

      <div style={{ width: '100%', height: CHART_H, position: 'relative' }}>
        {/* Y-axis price labels */}
        {[0, 0.25, 0.5, 0.75].map(frac => {
          const y = frac * CHART_H
          const chartAreaH = CHART_H - V_PAD_TOP - V_PAD_BOTTOM
          const price = chartData.length > 0
            ? minPrice + (1 - (y - V_PAD_TOP) / chartAreaH) * priceRange
            : null
          if (price == null) return null
          return (
            <div key={frac} style={{
              position: 'absolute',
              top: y,
              right: '0.125rem',
              transform: 'translateY(-50%)',
              fontSize: '0.625rem',
              fontFamily: 'var(--font-inter)',
              color: 'var(--st-muted)',
              whiteSpace: 'nowrap',
              lineHeight: 1,
              pointerEvents: 'none',
            }}>
              {fmtIndexPrice(price)}
            </div>
          )
        })}

        <svg
          ref={svgRef}
          width="100%"
          height={CHART_H}
          style={{ display: 'block', overflow: 'visible', cursor: hover ? 'crosshair' : 'default' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {hover && (
            <defs>
              <clipPath id="sx-pcw-hover-left">
                <rect x={0} y={-20} width={hover.x} height={CHART_H + 40} />
              </clipPath>
              <clipPath id="sx-pcw-hover-right">
                <rect x={hover.x} y={-20} width={CHART_W_CONST + 40} height={CHART_H + 40} />
              </clipPath>
            </defs>
          )}

          {/* Grid lines — first in SVG so painter's order puts them behind the chart line */}
          {[0, 0.25, 0.5, 0.75].map(frac => (
            <line
              key={frac}
              x1={0}
              y1={frac * CHART_H}
              x2={CHART_W}
              y2={frac * CHART_H}
              stroke="#2e2e2e"
              strokeWidth="1"
              strokeDasharray="2 5"
            />
          ))}

          {/* Chart line — draws on via strokeDashoffset; visibility guard blocks any flash before useLayoutEffect fires */}
          {linePath && (
            <>
              <path
                d={linePath}
                fill="none"
                stroke={lineColor}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={totalLength}
                strokeDashoffset={dashOffset}
                clipPath={hover ? "url(#sx-pcw-hover-left)" : undefined}
                style={{ visibility: lineReady ? 'visible' : 'hidden' }}
              />
              {hover && (
                <path
                  d={linePath}
                  fill="none"
                  stroke={lineColor}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={totalLength}
                  strokeDashoffset={dashOffset}
                  clipPath="url(#sx-pcw-hover-right)"
                  opacity={0.15}
                  style={{ visibility: lineReady ? 'visible' : 'hidden' }}
                />
              )}
            </>
          )}

          {/* Pulsating dot at last point (hidden while drawing or hovering) */}
          {last && drawDone && !hover && (
            <>
              <circle
                cx={last.x}
                cy={last.y}
                r="3.5"
                fill={lineColor}
                style={{
                  animation: 'sxDotPulse 0.9s ease-out infinite',
                  transformOrigin: 'center',
                  transformBox: 'fill-box',
                }}
              />
              <circle cx={last.x} cy={last.y} r="3.5" fill={lineColor} />
            </>
          )}


          {/* Hover: vertical cursor line */}
          {hover && (
            <line
              x1={hover.x} y1={-12}
              x2={hover.x} y2={CHART_H - V_PAD_BOTTOM + 18}
              stroke="rgba(255,255,255,0.4)"
              strokeWidth="1"
              pointerEvents="none"
            />
          )}

          {/* Hover: dot on line */}
          {hover && (
            <circle
              cx={hover.x}
              cy={hover.y}
              r="4"
              fill={lineColor}
              stroke="rgba(255,255,255,0.5)"
              strokeWidth="1.5"
              pointerEvents="none"
            />
          )}

        </svg>

        {/* Hover: date label (HTML so we can use CSXText) */}
        {hover && (
          <div
            className="pointer-events-none absolute top-0 z-10 flex w-[7.5rem] justify-center"
            style={{ left: `${(hover.x / Math.max(W, 1)) * 100}%`, transform: 'translateX(-50%)' }}
          >
            <CSXText variant="body3" color="STWhite">
              {formatChartLabel(hover.timestamp)}
            </CSXText>
          </div>
        )}

        {/* X-axis tick labels */}
        {!hover &&
          xTicks.map((ts, i) => {
            const leftPct = ((ts - startTime) / timeRange) * (CHART_W_CONST / W) * 100
            const transform =
              i === 0 ? 'translateX(0)' : i === xTicks.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)'
            return (
              <div
                key={i}
                className="pointer-events-none absolute bottom-1.5 z-10"
                style={{ left: `${leftPct}%`, transform }}
              >
                <span style={{ fontSize: '0.625rem', color: 'var(--st-muted)', fontFamily: 'var(--font-inter)' }}>
                  {formatChartXTick(ts, timePeriod)}
                </span>
              </div>
            )
          })}
      </div>
    </div>
  )
}
