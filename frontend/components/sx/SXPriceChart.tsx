'use client'

import { useState, useMemo, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import { resolveSXColor } from '@/components/sx/core/sx-color-tokens'
import { CSXText, csxTextVariantClass } from '@/components/sx/core/CSXText'
import { cn } from '@/components/sx/utils'
import { formatChartLabel, formatChartXTick } from '@/lib/format-time'
import { clientXToSvgUserX } from '@/lib/svgPointer'

export type TimePeriod = '1H' | '1D' | '1W' | '1M' | 'ALL'

interface Release {
  id: string
  name: string
  type?: string
  date?: string
  image?: string
  url?: string
}

interface SXPriceChartProps {
  data?: Array<{ timestamp: number; price: number }> | Array<{ index: number; timestamp: string }>
  className?: string
  onPeriodChange?: (period: TimePeriod) => void
  initialPeriod?: TimePeriod
  onHoverValueChange?: (value: number | null) => void
  height?: number
  releases?: Release[]
  allReleases?: Release[]
  hiddenReleaseIds?: string[]
  onToggleRelease?: (id: string) => void
  hideYAxis?: boolean
}

/** Top padding; bottom uses extra space so x-axis labels sit below the line (not tight to the curve). */
const V_PAD_TOP = 36
const V_PAD_BOTTOM = 50.4

/** Linear-interpolated y on the polyline at an arbitrary x, so a dot sits exactly
 *  ON the line. Shared by the hover dot and the leave-sweep dot, so the handoff
 *  between them starts from the identical point (no vertical jump). */
function interpolateYAtX(points: { x: number; y: number }[], x: number): number {
  if (points.length === 0) return 0
  if (x <= points[0].x) return points[0].y
  const lp = points[points.length - 1]
  if (x >= lp.x) return lp.y
  let lo = 0, hi = points.length - 1
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (points[mid].x <= x) lo = mid; else hi = mid }
  const a = points[lo], b = points[lo + 1]
  const f = b.x === a.x ? 0 : (x - a.x) / (b.x - a.x)
  return a.y + (b.y - a.y) * f
}


const PERIOD_MS: Record<TimePeriod, number> = {
  '1H':  1 * 60 * 60 * 1000,
  '1D':  24 * 60 * 60 * 1000,
  '1W':  7 * 24 * 60 * 60 * 1000,
  '1M':  30 * 24 * 60 * 60 * 1000,
  'ALL': Infinity,
}

/**
 * Pick decimal precision adaptively so sub-cent moves stay visible.
 * Driven by the price band currently being rendered: a market trading at
 * $2.34 with a $0.001 range needs 4–5 decimals to render a meaningful
 * line; a market at $1200 with a $50 range only needs 2.
 *
 * `range` is optional — when omitted (e.g., the standalone header price),
 * the magnitude of `value` itself drives precision.
 */
export function pickPriceDecimals(value: number, range?: number): number {
  const v = Math.abs(value)
  const r = range != null ? Math.abs(range) : v
  if (r < 0.0001 && v > 0) return 6
  if (r < 0.001) return 5
  if (r < 0.01) return 4
  if (r < 0.1) return 3
  return 2
}

function formatPriceAdaptive(value: number, range?: number): string {
  return value.toFixed(pickPriceDecimals(value, range))
}


// ── Digit roller ────────────────────────────────────────────────────────────
function DigitRoller({ digit, fontSize = 28 }: { digit: number; fontSize?: number }) {
  const h = fontSize * 1.2
  const w = fontSize * 0.62
  return (
    <div style={{ height: h, width: w, overflow: 'hidden', display: 'inline-block', flexShrink: 0 }}>
      <div
        style={{
          transform: `translateY(${-digit * h}px)`,
          transition: 'transform 0.22s cubic-bezier(0.34,1.56,0.64,1)',
          willChange: 'transform',
        }}
      >
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => (
          <div
            key={d}
            className={cn(csxTextVariantClass('chartAnimatedPrice'), 'flex items-center justify-center text-white')}
            style={{
              height: h,
              width: w,
              fontSize,
              fontWeight: 600,
            }}
          >
            {d}
          </div>
        ))}
      </div>
    </div>
  )
}

export function AnimatedPrice({ value, fontSize = 28 }: { value: number; fontSize?: number }) {
  const formatted = formatPriceAdaptive(value)
  const h = fontSize * 1.2
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', height: h }}>
      {formatted.split('').map((char, i) => {
        const d = parseInt(char, 10)
        if (!isNaN(d)) return <DigitRoller key={i} digit={d} fontSize={fontSize} />
        return (
          <span
            key={i}
            className={cn(csxTextVariantClass('chartAnimatedPrice'), 'inline-block shrink-0 text-white')}
            style={{
              fontSize,
              fontWeight: 600,
              lineHeight: `${h}px`,
            }}
          >
            {char}
          </span>
        )
      })}
    </div>
  )
}

// ── Main chart ───────────────────────────────────────────────────────────────
export function SXPriceChart({
  data = [],
  className = '',
  onPeriodChange,
  initialPeriod = 'ALL',
  onHoverValueChange,
  height: heightProp,
  releases = [],
  allReleases = [],
  hiddenReleaseIds = [],
  onToggleRelease,
  hideYAxis = false,
}: SXPriceChartProps) {
  const CHART_H = heightProp ?? 288
  const [timePeriod, setTimePeriod] = useState<TimePeriod>(initialPeriod)
  const [periodStart, setPeriodStart] = useState(() => Date.now())
  const svgRef = useRef<SVGSVGElement>(null)

  const [svgWidth, setSvgWidth] = useState(0)
  // Hover is fully renderless: the tooltip/clip/dim-path elements mount
  // ONCE on the first hover (hasHovered) and stay mounted; enter/leave and
  // every per-move update are direct DOM show/hide/attribute writes.
  // Edge-crossing spam previously mount/unmount-thrashed these elements
  // through React, and the accumulated GC made hovering degrade over time.
  const [hasHovered, setHasHovered] = useState(false)
  const [hoveredMarkerIdx, setHoveredMarkerIdx] = useState<number | null>(null)
  const [pressedItem, setPressedItem] = useState<string | null>(null)
  const [drawProgress, setDrawProgress] = useState(0)
  const [drawDone, setDrawDone] = useState(false)
  const drawAnimRef = useRef<number | null>(null)
  const drawStartRef = useRef<number>(0)
  const sparkAnimRef = useRef<SVGAnimateElement>(null)
  const indicatorRef = useRef<SVGGElement>(null)
  const dotRef = useRef<SVGCircleElement>(null)
  const crosshairLineRef = useRef<SVGLineElement>(null)
  const hoverRafRef = useRef<number | null>(null)
  // Leave-sweep: last dim-boundary x while hovering, and the sweep's RAF handle.
  // No React state — the sweep writes the DOM directly (see handleMouseLeave).
  const lastBoundaryXRef = useRef<number | null>(null)
  const sweepRafRef = useRef<number | null>(null)
  const pendingHoverRef = useRef<{ x: number; y: number; price: number; timestamp: number } | null>(null)
  // Rate-limit for the parent onHoverValueChange callback. The crosshair,
  // dot, and tooltip update per frame (direct DOM + local state), but the
  // parent pipes the price into the header's per-digit roll animation —
  // restarting ~10 CSS transitions 60×/s during fast sweeps was the
  // dominant jank. 100ms cadence is imperceptible on a numeric readout.
  const HOVER_CB_MS = 100
  const lastHoverCbRef = useRef(0)
  const hoverCbTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const notifyHoverPrice = useCallback((price: number | null) => {
    if (hoverCbTimerRef.current != null) { clearTimeout(hoverCbTimerRef.current); hoverCbTimerRef.current = null }
    if (price === null) {
      // Leaving hover must propagate immediately — the header snaps back
      // to the live price.
      lastHoverCbRef.current = performance.now()
      latestOnHoverRef.current?.(null)
      return
    }
    const since = performance.now() - lastHoverCbRef.current
    if (since >= HOVER_CB_MS) {
      lastHoverCbRef.current = performance.now()
      latestOnHoverRef.current?.(price)
      return
    }
    // Trailing call so the final resting position always lands.
    hoverCbTimerRef.current = setTimeout(() => {
      hoverCbTimerRef.current = null
      lastHoverCbRef.current = performance.now()
      const h = pendingHoverRef.current
      if (h) latestOnHoverRef.current?.(h.price)
    }, HOVER_CB_MS - since)
  }, [])
  const isHoveringRef = useRef(false)
  const hasHoveredRef = useRef(false)
  const clipLeftRectRef = useRef<SVGRectElement | null>(null)
  const clipRightRectRef = useRef<SVGRectElement | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const tooltipTimeRef = useRef<HTMLSpanElement | null>(null)
  const dimPathRef = useRef<SVGPathElement | null>(null)
  const lastPulseRef = useRef<SVGGElement | null>(null)
  const ticksRef = useRef<HTMLDivElement | null>(null)
  const latestWRef = useRef(0)

  const applyHoverDom = useCallback((h: { x: number; y: number; price: number; timestamp: number }) => {
    if (clipLeftRectRef.current) clipLeftRectRef.current.setAttribute('width', String(Math.max(0, h.x)))
    if (clipRightRectRef.current) clipRightRectRef.current.setAttribute('x', String(h.x))
    if (tooltipRef.current) tooltipRef.current.style.left = `${(h.x / Math.max(latestWRef.current, 1)) * 100}%`
    if (tooltipTimeRef.current) tooltipTimeRef.current.textContent = formatChartLabel(h.timestamp)
  }, [])

  const showHoverDom = useCallback(() => {
    if (svgRef.current) svgRef.current.style.cursor = 'crosshair'
    if (tooltipRef.current) tooltipRef.current.style.display = ''
    if (dimPathRef.current) dimPathRef.current.style.display = ''
    if (lastPulseRef.current) lastPulseRef.current.style.display = 'none'
    if (ticksRef.current) ticksRef.current.style.display = 'none'
  }, [])

  const hideHoverDom = useCallback(() => {
    if (svgRef.current) svgRef.current.style.cursor = 'default'
    if (tooltipRef.current) tooltipRef.current.style.display = 'none'
    if (dimPathRef.current) dimPathRef.current.style.display = 'none'
    if (lastPulseRef.current) lastPulseRef.current.style.display = ''
    if (ticksRef.current) ticksRef.current.style.display = ''
    // Neutralize the left clip so the (permanently clipped) main line shows
    // in full while not hovering.
    if (clipLeftRectRef.current) clipLeftRectRef.current.setAttribute('width', '100000')
  }, [])

  const flushHover = useCallback((h: { x: number; y: number; price: number; timestamp: number }) => {
    if (!isHoveringRef.current) {
      isHoveringRef.current = true
      if (!hasHoveredRef.current) {
        hasHoveredRef.current = true
        setHasHovered(true) // one-time mount of the hover elements
      } else {
        showHoverDom()
      }
    }
    applyHoverDom(h)
    notifyHoverPrice(h.price)
  }, [applyHoverDom, showHoverDom, notifyHoverPrice])

  const endHover = useCallback(() => {
    pendingHoverRef.current = null
    if (isHoveringRef.current) {
      isHoveringRef.current = false
      hideHoverDom()
    }
    notifyHoverPrice(null)
  }, [hideHoverDom, notifyHoverPrice])

  // First-hover mount: show + position the elements before their first paint.
  useLayoutEffect(() => {
    if (hasHovered && isHoveringRef.current && pendingHoverRef.current) {
      showHoverDom()
      applyHoverDom(pendingHoverRef.current)
    }
  }, [hasHovered, showHoverDom, applyHoverDom])
  const isTouchActiveRef = useRef(false)
  const drawKeyRef = useRef('')
  const linePathRef = useRef<SVGPathElement>(null)
  const [pathLength, setPathLength] = useState(0)
  const handlePeriodChange = (period: TimePeriod) => {
    setTimePeriod(period)
    setPeriodStart(Date.now())
    onPeriodChange?.(period)
  }

  useLayoutEffect(() => {
    const el = svgRef.current
    if (!el) return
    const w = el.clientWidth
    if (w > 0) setSvgWidth(w)
    const observer = new ResizeObserver(() => setSvgWidth(el.clientWidth || 800))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const chartData = useMemo(() => {
    if (data.length === 0) return []

    const normalized = data
      .map(point => {
        if ('index' in point) {
          return { timestamp: new Date(point.timestamp).getTime(), price: parseFloat(point.index.toString()) }
        }
        return point as { timestamp: number; price: number }
      })
      .sort((a, b) => a.timestamp - b.timestamp)

    const now = Date.now()
    let points = normalized

    if (timePeriod !== 'ALL') {
      const cutoff = now - PERIOD_MS[timePeriod]
      let lo = 0, hi = normalized.length
      while (lo < hi) {
        const mid = (lo + hi) >>> 1
        if (normalized[mid]!.timestamp < cutoff) lo = mid + 1
        else hi = mid
      }
      points = normalized.slice(Math.max(0, lo - 1))
    }

    const last = points[points.length - 1]
    if (last && last.timestamp < now) {
      // Guarantee a minimum 4% visual tail so the "extend to now" step is always
      // visible, even when the last trade happened just minutes ago on a long chart.
      const span = now - (points[0]?.timestamp ?? now)
      const minTailMs = span * 0.04
      const tailMs = Math.max(now - last.timestamp, minTailMs)
      points = [...points, { timestamp: last.timestamp + tailMs, price: last.price }]
    }
    return points
  }, [data, timePeriod])

  const firstPrice = chartData[0]?.price ?? 0
  const lastPrice = chartData[chartData.length - 1]?.price ?? 0
  const isPositive = lastPrice >= firstPrice
  const color = resolveSXColor(isPositive ? 'STChartPositive' : 'STChartNegative')

  // Empty gutter reserved to the right of the last data point. On the desktop
  // chart it holds the right-side price labels (drawn at x≈W). On mobile
  // (hideYAxis) the drawing block is inset 12px each side to match the rest of
  // the mobile UI (see the wrapper's marginInline below), so the last point
  // should sit flush at the inset right edge — symmetric with the left. The
  // dot's pulse (≈11px bloom) then lives inside the 12px right margin.
  const FUTURE_PAD = hideYAxis ? 0 : 50.4
  const W = svgWidth
  const CHART_W = W - FUTURE_PAD
  useEffect(() => { latestWRef.current = W })
  const startTime = chartData[0]?.timestamp ?? 0
  const endTime = chartData[chartData.length - 1]?.timestamp ?? startTime + 1
  const timeRange = endTime - startTime || 1
  // Single memoized pass (the Math.min(...spread) pair re-scanned up to 2000
  // points on every render, and spread can overflow the stack on big arrays).
  const { minPrice, maxPrice } = useMemo(() => {
    if (chartData.length === 0) return { minPrice: 0, maxPrice: 1 }
    let mn = Infinity, mx = -Infinity
    for (const d of chartData) {
      if (d.price < mn) mn = d.price
      if (d.price > mx) mx = d.price
    }
    return { minPrice: mn, maxPrice: mx }
  }, [chartData])
  const priceRange = maxPrice === minPrice ? 1 : maxPrice - minPrice

  const toY = useCallback(
    (price: number) => V_PAD_TOP + (1 - (price - minPrice) / priceRange) * (CHART_H - V_PAD_TOP - V_PAD_BOTTOM),
    [minPrice, priceRange, CHART_H],
  )

  const points = useMemo(() => chartData.map(d => ({
    x: ((d.timestamp - startTime) / timeRange) * CHART_W,
    y: toY(d.price),
    price: d.price,
    timestamp: d.timestamp,
  })), [chartData, W, startTime, timeRange, toY, CHART_H])

  const linePath = useMemo(() => {
    const pts = points
    const n = pts.length
    if (n === 0) return ''
    if (n === 1) return `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`
    if (n === 2) return `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)} L${pts[1].x.toFixed(1)},${pts[1].y.toFixed(1)}`

    // Straight line connecting the dots (linear interpolation)
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  }, [points])

  // Read the true SVG path length after every path update so the
  // strokeDashoffset animation covers the full bezier arc exactly.
  useLayoutEffect(() => {
    if (linePathRef.current) {
      setPathLength(linePathRef.current.getTotalLength())
    }
  }, [linePath])

  // Only restart the draw animation when the period changes or data first arrives —
  // not on every live tick. Live points just extend the SVG path in place.
  const dataKey = chartData.length > 0 ? `${timePeriod}-${periodStart}` : ''

  useLayoutEffect(() => {
    if (chartData.length < 1) return
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

  useEffect(() => {
    return () => {
      if (hoverRafRef.current != null) cancelAnimationFrame(hoverRafRef.current)
      if (hoverCbTimerRef.current != null) clearTimeout(hoverCbTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!drawDone || pathLength <= 0) return
    const timer = setTimeout(() => { sparkAnimRef.current?.beginElement() }, 3000)
    return () => clearTimeout(timer)
  }, [drawDone, dataKey, pathLength])

  // Refs so the non-passive touchmove listener always sees the latest render values
  // "Latest value" refs, so the touch/hover effect below can read fresh values
  // without re-subscribing its listeners on every render.
  //
  // The assignments live in an effect rather than in the render body: writing a
  // ref during render is what react-hooks/refs flags, and under concurrent
  // rendering a render that is thrown away would still have mutated them. This
  // effect is declared BEFORE the consumer below, and effects run in
  // declaration order, so the values are in place before any listener is
  // attached — and later reads happen inside DOM events, long after commit.
  const latestPointsRef = useRef(points)
  const latestChartWRef = useRef(CHART_W)
  const latestFirstPriceRef = useRef(firstPrice)
  const latestColorRef = useRef(color)
  const latestOnHoverRef = useRef(onHoverValueChange)
  useEffect(() => {
    latestPointsRef.current = points
    latestChartWRef.current = CHART_W
    latestFirstPriceRef.current = firstPrice
    latestColorRef.current = color
    latestOnHoverRef.current = onHoverValueChange
  }, [points, CHART_W, firstPrice, color, onHoverValueChange])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    const processTouch = (clientX: number) => {
      const pts = latestPointsRef.current
      const chartW = latestChartWRef.current
      if (pts.length < 2) return
      const x = clientXToSvgUserX(svg, clientX)
      if (x === null) return
      if (x > chartW) {
        if (indicatorRef.current) indicatorRef.current.style.display = 'none'
        endHover()
        return
      }
      let lo = 0, hi = pts.length - 2
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1
        if (pts[mid].x <= x) lo = mid; else hi = mid - 1
      }
      const y = pts[lo]!.y
      const price = pts[lo]!.price
      const timestamp = pts[lo]!.timestamp
      if (indicatorRef.current) {
        indicatorRef.current.style.display = ''
        // SVG `transform` ATTRIBUTE, not a CSS transform: `x` is in SVG user
        // units, and a CSS `translateX(Npx)` on an SVG element does not
        // reliably resolve px as user units under `zoom` — Blink and WebKit
        // disagree, which left the crosshair offset from the cursor in Safari
        // even once `x` itself was correct. The attribute form is user units
        // by definition. (SXPriceChartWidget avoids this by binding x1/x2/cx.)
        indicatorRef.current.setAttribute('transform', `translate(${x} 0)`)
      }
      if (dotRef.current) {
        dotRef.current.style.display = ''
        dotRef.current.setAttribute('cy', String(y))
        dotRef.current.setAttribute('fill', latestColorRef.current)
      }
      pendingHoverRef.current = { x, y, price, timestamp }
      if (hoverRafRef.current == null) {
        hoverRafRef.current = requestAnimationFrame(() => {
          hoverRafRef.current = null
          const h = pendingHoverRef.current
          if (h) flushHover(h)
        })
      }
    }

    const clearTouch = () => {
      isTouchActiveRef.current = false
      if (indicatorRef.current) indicatorRef.current.style.display = 'none'
      if (hoverRafRef.current != null) { cancelAnimationFrame(hoverRafRef.current); hoverRafRef.current = null }
      endHover()
    }

    const onTouchStart = (e: TouchEvent) => {
      isTouchActiveRef.current = true
      if (e.touches[0]) processTouch(e.touches[0].clientX)
    }
    const onTouchMove = (e: TouchEvent) => {
      if (!isTouchActiveRef.current) return
      e.preventDefault()
      if (e.touches[0]) processTouch(e.touches[0].clientX)
    }
    const onTouchEnd = () => clearTouch()

    svg.addEventListener('touchstart', onTouchStart, { passive: true })
    svg.addEventListener('touchmove', onTouchMove, { passive: false })
    svg.addEventListener('touchend', onTouchEnd)
    svg.addEventListener('touchcancel', onTouchEnd)

    return () => {
      svg.removeEventListener('touchstart', onTouchStart)
      svg.removeEventListener('touchmove', onTouchMove)
      svg.removeEventListener('touchend', onTouchEnd)
      svg.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [flushHover, endHover])

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (points.length < 2) return
    const svg = e.currentTarget as SVGSVGElement
    const x = clientXToSvgUserX(svg, e.clientX, e.clientY)
    if (x === null) return
    if (x > CHART_W) {
      if (indicatorRef.current) indicatorRef.current.style.display = 'none'
      endHover()
      return
    }

    // A re-hover interrupts an in-flight leave sweep, and the crosshair line it
    // hid must come back.
    if (sweepRafRef.current != null) { cancelAnimationFrame(sweepRafRef.current); sweepRafRef.current = null }
    if (crosshairLineRef.current) crosshairLineRef.current.style.display = ''
    lastBoundaryXRef.current = x

    let lo = 0, hi = points.length - 2
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (points[mid].x <= x) lo = mid; else hi = mid - 1
    }
    const y = points[lo].y
    const price = points[lo].price
    const timestamp = points[lo].timestamp

    if (indicatorRef.current) {
      indicatorRef.current.style.display = ''
      // See the note in the touch handler: SVG transform attribute (user
      // units), not a CSS transform (px, engine-dependent under `zoom`).
      indicatorRef.current.setAttribute('transform', `translate(${x} 0)`)
    }
    if (dotRef.current) {
      dotRef.current.style.display = ''
      // Dot sits ON the line (interpolated between the bracketing points) — the
      // leave-sweep continues this exact dot along the line, so the handoff has
      // no vertical jump. Also restore hover styling in case we just swept.
      dotRef.current.setAttribute('cy', String(interpolateYAtX(points, x)))
      dotRef.current.setAttribute('fill', color)
      dotRef.current.setAttribute('r', '4')
      dotRef.current.setAttribute('stroke', 'rgba(255,255,255,0.5)')
    }

    pendingHoverRef.current = { x, y, price, timestamp }
    if (hoverRafRef.current == null) {
      hoverRafRef.current = requestAnimationFrame(() => {
        hoverRafRef.current = null
        const h = pendingHoverRef.current
        if (h) flushHover(h)
      })
    }
  }, [points, flushHover, endHover, color])

  // ── Leave-sweep ─────────────────────────────────────────────────────────────
  // On leave, the dim boundary and the hover dot GLIDE from the cursor out to
  // the live point instead of vanishing. The dot is the same element that was
  // following the cursor, restyled to the live pulse dot, so there is no handoff
  // and no vertical jump.
  //
  // RENDERLESS BY CONSTRUCTION: the boundary is written straight to the clip
  // rect and the dot/indicator through SVG attributes — zero re-renders per
  // frame. An earlier state-driven version of this effect (setSweepX on every
  // frame) was correctly dropped during the hover-perf rework; that objection
  // does not apply to this implementation.
  const handleMouseLeave = useCallback(() => {
    if (hoverRafRef.current != null) { cancelAnimationFrame(hoverRafRef.current); hoverRafRef.current = null }
    if (sweepRafRef.current != null) { cancelAnimationFrame(sweepRafRef.current); sweepRafRef.current = null }

    const startX = lastBoundaryXRef.current
    const targetX = points.length > 0 ? points[points.length - 1].x : null
    lastBoundaryXRef.current = null

    // Nothing to sweep: never hovered, or the cursor is already at/past the
    // live point. Fall back to the plain teardown.
    if (startX == null || targetX == null || startX >= targetX - 0.5) {
      endHover()
      return
    }

    // The parent snaps back to the live price immediately (the header should not
    // lag the animation); only the on-chart chrome animates.
    pendingHoverRef.current = null
    isHoveringRef.current = false
    notifyHoverPrice(null)

    if (crosshairLineRef.current) crosshairLineRef.current.style.display = 'none'
    if (dotRef.current) { dotRef.current.setAttribute('r', '3.5'); dotRef.current.setAttribute('stroke', 'none') }

    const DUR = 250
    let startT: number | null = null
    const step = (now: number) => {
      if (startT === null) startT = now   // captured on frame 1, so it starts exactly at the cursor
      const t = Math.min(1, (now - startT) / DUR)
      const bx = startX + (targetX - startX) * (1 - Math.pow(1 - t, 3)) // ease-out cubic
      if (clipLeftRectRef.current) clipLeftRectRef.current.setAttribute('width', String(Math.max(0, bx)))
      // SVG transform ATTRIBUTE, never a CSS style.transform: `bx` is in SVG
      // user units, which a CSS translateX(px) resolves differently across
      // engines under `zoom: 0.9`, and an inline CSS transform would outrank
      // the attribute writes in the hover handlers.
      if (indicatorRef.current) indicatorRef.current.setAttribute('transform', `translate(${bx} 0)`)
      if (dotRef.current) dotRef.current.setAttribute('cy', String(interpolateYAtX(points, bx)))
      if (t < 1) { sweepRafRef.current = requestAnimationFrame(step); return }
      sweepRafRef.current = null
      if (crosshairLineRef.current) crosshairLineRef.current.style.display = ''
      if (indicatorRef.current) indicatorRef.current.style.display = 'none'
      hideHoverDom()
    }
    sweepRafRef.current = requestAnimationFrame(step)
  }, [points, endHover, notifyHoverPrice, hideHoverDom])

  const last = points[points.length - 1]
  const effectiveProgress = drawKeyRef.current === dataKey ? drawProgress : 0

  const dashOffset = pathLength > 0 ? (pathLength + 4) * (1 - effectiveProgress) : 0

  const prevXTicksRef = useRef<number[]>([])
  const prevStartTimeRef = useRef<number>(0)
  const prevTimeRangeRef = useRef<number>(1)

  const xTicks = useMemo(() => {
    if (chartData.length < 1) return prevXTicksRef.current
    const n = 5
    const ticks = Array.from({ length: n }, (_, i) => startTime + (i * timeRange / (n - 1)))
    prevXTicksRef.current = ticks
    prevStartTimeRef.current = startTime
    prevTimeRangeRef.current = timeRange
    return ticks
  }, [startTime, timeRange, chartData.length])

  // While data is loading use the previous scale so ticks stay in place
  const tickStartTime = chartData.length > 0 ? startTime : prevStartTimeRef.current
  const tickTimeRange = chartData.length > 0 ? timeRange : prevTimeRangeRef.current

  const releaseMarkers = useMemo(() => {
    if (!releases.length || !chartData.length) return []
    const byDate = new Map<string, Release>()
    for (const r of releases) {
      const key = r.date ?? ''
      if (!key) continue
      const existing = byDate.get(key)
      if (!existing || (r.type === 'ALBUM' && existing.type !== 'ALBUM')) {
        byDate.set(key, r)
      }
    }
    return Array.from(byDate.values())
      .map(r => {
        const ms = r.date ? new Date(r.date).getTime() : null
        if (!ms || ms < startTime || ms > endTime) return null
        const x = ((ms - startTime) / timeRange) * CHART_W
        return { x, type: r.type ?? 'SINGLE', name: r.name, release: r }
      })
      .filter(Boolean) as { x: number; type: string; name: string; release: Release }[]
  }, [releases, chartData.length, startTime, endTime, timeRange, W])

  return (
    <div className={`bg-transparent ${className}`}>
      <div style={{
        width: hideYAxis ? 'calc(100% - 24px)' : '100%',
        marginLeft: hideYAxis ? 12 : 0,
        marginRight: hideYAxis ? 12 : 0,
        height: CHART_H,
        position: 'relative',
      }}>
        <svg
          ref={svgRef}
          width="100%"
          height={CHART_H}
          style={{ display: 'block', overflow: 'visible', cursor: 'default' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {svgWidth > 0 && (<>
          {/* Solid horizontal grid lines */}
          {[0, 0.25, 0.5, 0.75].map(frac => {
            const y = frac * CHART_H
            const chartAreaH = CHART_H - V_PAD_TOP - V_PAD_BOTTOM
            const price = chartAreaH > 0
              ? minPrice + (1 - (y - V_PAD_TOP) / chartAreaH) * priceRange
              : null
            return (
              <g key={frac}>
                <line
                  x1={0} y1={y}
                  x2={hideYAxis ? W : CHART_W + 12} y2={y}
                  stroke={hideYAxis ? '#2a2a2a' : '#3a3a3a'}
                  strokeWidth="1"
                  strokeDasharray="2 5"
                />
                {price != null && !hideYAxis && (
                  <text
                    x={W - 2}
                    y={y}
                    textAnchor="end"
                    dominantBaseline="middle"
                    style={{ fill: 'var(--st-muted)', fontSize: '0.625rem', fontFamily: 'var(--font-inter)' }}
                    pointerEvents="none"
                  >
                    {formatPriceAdaptive(price, priceRange)}
                  </text>
                )}
              </g>
            )
          })}

          <defs>
            {releaseMarkers.map((rm, i) => (
              <clipPath key={`clip-${i}`} id={`release-clip-${i}`}>
                <circle cx={rm.x} cy={CHART_H - V_PAD_BOTTOM + 10} r={10} />
              </clipPath>
            ))}
            <filter id="sparkFilter" x="-5%" y="-300%" width="110%" height="700%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
            </filter>
            {hasHovered && (
              <>
                <clipPath id="sx-pc-hover-left">
                  <rect ref={clipLeftRectRef} x={0} y={-20} width={100000} height={CHART_H + 40} />
                </clipPath>
                <clipPath id="sx-pc-hover-right">
                  <rect ref={clipRightRectRef} x={0} y={-20} width={CHART_W + 40} height={CHART_H + 40} />
                </clipPath>
              </>
            )}
          </defs>

          {/* Chart line */}
          {linePath && (
            <>
              <path
                ref={linePathRef}
                d={linePath}
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeDasharray={pathLength}
                strokeDashoffset={dashOffset}
                clipPath={hasHovered ? "url(#sx-pc-hover-left)" : undefined}
                style={{ visibility: drawKeyRef.current === dataKey ? 'visible' : 'hidden' }}
              />
              {hasHovered && (
                <path
                  ref={dimPathRef}
                  d={linePath}
                  fill="none"
                  stroke={color}
                  strokeWidth="2"
                  strokeDasharray={pathLength}
                  strokeDashoffset={dashOffset}
                  clipPath="url(#sx-pc-hover-right)"
                  opacity={0.15}
                  style={{ display: 'none', visibility: drawKeyRef.current === dataKey ? 'visible' : 'hidden' }}
                />
              )}
            </>
          )}

          {/* Spark pulse */}
          {linePath && drawDone && pathLength > 0 && (
            <path
              key={`spark-${dataKey}`}
              d={linePath}
              fill="none"
              stroke={`color-mix(in oklch, ${color} 60%, white)`}
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={`60 ${pathLength + 60}`}
              strokeDashoffset={60}
              filter="url(#sparkFilter)"
              clipPath={hasHovered ? "url(#sx-pc-hover-left)" : undefined}
            >
              <animate
                ref={sparkAnimRef}
                attributeName="stroke-dashoffset"
                values={`60;${-pathLength};${-pathLength};60`}
                keyTimes="0;0.051;0.994;1"
                dur="15.8s"
                begin="indefinite"
                repeatCount="indefinite"
                calcMode="linear"
              />
            </path>
          )}

          {/* Pulsating dot at last point */}
          {last && Number.isFinite(last.x) && Number.isFinite(last.y) && drawDone && (
            <g ref={lastPulseRef}>
              <circle
                cx={last.x}
                cy={last.y}
                r="3.5"
                fill={color}
                style={{
                  animation: 'sxDotPulse 0.9s ease-out infinite',
                  transformOrigin: 'center',
                  transformBox: 'fill-box',
                }}
              />
              <circle cx={last.x} cy={last.y} r="3.5" fill={color} />
            </g>
          )}


          {/* Hover indicator. On leave the vertical line is hidden instantly and
              this SAME dot is animated out to the live point (reused, not handed
              to a separate element) — so there's no jump/jitter at the handoff.
              cy/r/stroke are driven imperatively; React leaves the unchanged JSX
              values alone, so those mutations survive the per-frame re-renders. */}
          <g ref={indicatorRef} style={{ display: 'none', willChange: 'transform' }} pointerEvents="none">
            <line ref={crosshairLineRef} x1={0} y1={-12} x2={0} y2={CHART_H - V_PAD_BOTTOM + 18} stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
            <circle ref={dotRef} cx={0} cy={0} r="4" fill={color} stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
          </g>

          {releaseMarkers.map((rm, i) => {
            const markerY = CHART_H - V_PAD_BOTTOM + 10
            const imgR = 10
            const isHovered = hoveredMarkerIdx === i
            const labelText = rm.release.name

            return (
              <g key={i}>
                <line
                  x1={rm.x} y1={-12}
                  x2={rm.x} y2={markerY - imgR}
                  stroke={isHovered ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)"}
                  strokeWidth="1"
                  style={{ transition: 'stroke 0.2s ease' }}
                  pointerEvents="none"
                />
                <line
                  x1={rm.x} y1={-12} x2={rm.x} y2={CHART_H}
                  stroke="transparent"
                  strokeWidth="20"
                  style={{ cursor: 'default' }}
                  onMouseEnter={() => setHoveredMarkerIdx(i)}
                  onMouseLeave={() => setHoveredMarkerIdx(null)}
                />
                <text
                  x={rm.x}
                  y={markerY - imgR - 18}
                  textAnchor="middle"
                  style={{
                    fill: '#e4e4e7',
                    fontSize: '0.625rem',
                    fontFamily: 'var(--font-geist-sans)',
                    fontWeight: 600,
                    opacity: isHovered ? 1 : 0,
                    transition: 'opacity 0.15s ease',
                    pointerEvents: 'none',
                  }}
                  pointerEvents="none"
                >
                  {labelText.length > 18 ? labelText.slice(0, 17) + '…' : labelText}
                </text>
                <g
                  onMouseEnter={() => setHoveredMarkerIdx(i)}
                  onMouseLeave={() => setHoveredMarkerIdx(null)}
                  style={{
                    transformBox: 'fill-box',
                    transformOrigin: 'center',
                    transform: isHovered ? 'scale(1.55)' : 'scale(1)',
                    transition: isHovered
                      ? 'transform 0.28s cubic-bezier(0.34,1.56,0.64,1)'
                      : 'transform 0.5s cubic-bezier(0.34,1.4,0.64,1)',
                    willChange: 'transform',
                    cursor: 'default',
                  }}
                >
                  <circle cx={rm.x} cy={markerY} r={imgR} fill="#27272a" />
                  {rm.release.image ? (
                    <image
                      href={rm.release.image}
                      x={rm.x - imgR} y={markerY - imgR}
                      width={imgR * 2} height={imgR * 2}
                      clipPath={`url(#release-clip-${i})`}
                      preserveAspectRatio="xMidYMid slice"
                    />
                  ) : (
                    <circle cx={rm.x} cy={markerY} r={4} fill="rgba(255,255,255,0.4)" />
                  )}
                  <circle cx={rm.x} cy={markerY} r={imgR} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
                </g>
              </g>
            )
          })}
          </>)}
        </svg>

        {hasHovered && (
          <div
            ref={tooltipRef}
            className="pointer-events-none absolute top-0 z-10 flex w-[7.5rem] justify-center"
            style={{ display: 'none', left: '0%', transform: 'translateX(-50%)' }}
          >
            <CSXText variant="body3" color="STWhite">
              <span ref={tooltipTimeRef} />
            </CSXText>
          </div>
        )}
        <div ref={ticksRef}>
        {xTicks.map((ts, i) => {
            const leftPct = ((ts - tickStartTime) / tickTimeRange) * (CHART_W / W) * 100
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

      {/* Chart controls */}
      <div className={`flex w-full items-center justify-between pt-6 ${hideYAxis ? 'pb-3 px-3' : 'pb-6'}`}>
        <div className="flex items-center gap-6">
          {(['1H', '1D', '1W', '1M', 'ALL'] as TimePeriod[]).map(period => (
            <button
              key={period}
              type="button"
              onClick={() => handlePeriodChange(period)}
              className="cursor-pointer rounded transition-colors hover:bg-zinc-800/50 px-2 -mx-2 py-0.5"
              style={{
                transition: 'background-color 150ms, transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                transform: pressedItem === period ? 'scale(0.88)' : 'scale(1)',
              }}
              onPointerDown={() => setPressedItem(period)}
              onPointerUp={() => setPressedItem(null)}
              onPointerLeave={() => setPressedItem(null)}
            >
              <CSXText variant="body3" color={timePeriod === period ? 'STWhite' : 'STMuted'}>
                {period}
              </CSXText>
            </button>
          ))}
        </div>
        <div className="flex select-none items-center gap-0" style={{ opacity: 0.3 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/sonotrade_glyph_square_transparent.png"
            alt="Sonotrade"
            draggable={false}
            className="block h-8 w-auto"
            style={{ height: '2rem', width: 'auto', userSelect: 'none' }}
          />
          <CSXText variant="wordmark" color="STWhite">Sonotrade</CSXText>
        </div>
      </div>
    </div>
  )
}
