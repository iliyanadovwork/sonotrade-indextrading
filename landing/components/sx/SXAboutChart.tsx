'use client'

import { useState, useMemo, useRef, useEffect } from 'react'

interface SXAboutChartProps {
  data?: Array<{ timestamp: number; price: number }> | Array<{ index: number; timestamp: string }>
  className?: string
  height?: number
  onDrawingPriceChange?: (price: number) => void
  onDrawingChangeData?: (data: { percentChange: number; rawChange: number }) => void
  onColorChange?: (color: string) => void
}

const V_PAD_TOP = 20
const V_PAD_BOTTOM = 20

const C_NEUTRAL  = { r: 4,   g: 223, b: 162 }
const C_POSITIVE = { r: 4,   g: 223, b: 162 }
const C_NEGATIVE = { r: 255, g: 75,  b: 75  }

function lerp(a: number, b: number, t: number) { return a + (b - a) * t }
function lerpColor(
  from: { r: number; g: number; b: number },
  to:   { r: number; g: number; b: number },
  t: number
): string {
  return `rgb(${Math.round(lerp(from.r, to.r, t))},${Math.round(lerp(from.g, to.g, t))},${Math.round(lerp(from.b, to.b, t))})`
}

export function SXAboutChart({
  data = [],
  className = '',
  height: heightProp,
  onDrawingPriceChange,
  onDrawingChangeData,
  onColorChange,
}: SXAboutChartProps) {
  const CHART_H = heightProp ?? 320
  const svgRef = useRef<SVGSVGElement>(null)

  const [svgWidth, setSvgWidth] = useState(800)
  const [drawProgress, setDrawProgress] = useState(0)
  const [drawDone, setDrawDone] = useState(false)
  const drawAnimRef = useRef<number | null>(null)
  const drawStartRef = useRef<number>(0)

  // Keep callbacks in refs so the rAF loop always calls the latest version
  // without them being listed as effect dependencies (avoids infinite loops)
  const onDrawingPriceChangeRef = useRef(onDrawingPriceChange)
  const onDrawingChangeDataRef  = useRef(onDrawingChangeData)
  const onColorChangeRef        = useRef(onColorChange)
  useEffect(() => { onDrawingPriceChangeRef.current = onDrawingPriceChange }, [onDrawingPriceChange])
  useEffect(() => { onDrawingChangeDataRef.current  = onDrawingChangeData  }, [onDrawingChangeData])
  useEffect(() => { onColorChangeRef.current        = onColorChange        }, [onColorChange])

  // Track SVG width
  useEffect(() => {
    const update = () => {
      if (svgRef.current) setSvgWidth(svgRef.current.clientWidth || 800)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
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

  const chartData = useMemo(() => {
    if (allData.length === 0) return []
    const now = Date.now()
    const last = allData[allData.length - 1]
    if (last && last.timestamp < now - 30_000) {
      return [...allData, { timestamp: now, price: last.price }]
    }
    return allData
  }, [allData])

  const firstPrice = chartData[0]?.price ?? 0
  const lastPrice  = chartData[chartData.length - 1]?.price ?? 0
  const isPositive = lastPrice >= firstPrice
  const targetColor = isPositive ? C_POSITIVE : C_NEGATIVE

  const W = svgWidth
  const startTime  = chartData[0]?.timestamp ?? 0
  const endTime    = chartData[chartData.length - 1]?.timestamp ?? startTime + 1
  const timeRange  = endTime - startTime || 1
  const minPrice   = chartData.length > 0 ? Math.min(...chartData.map(d => d.price)) : 0
  const maxPrice   = chartData.length > 0 ? Math.max(...chartData.map(d => d.price)) : 1
  const priceRange = maxPrice === minPrice ? 1 : maxPrice - minPrice

  const points = useMemo(() => chartData.map(d => ({
    x: ((d.timestamp - startTime) / timeRange) * W,
    y: V_PAD_TOP + (1 - (d.price - minPrice) / priceRange) * (CHART_H - V_PAD_TOP - V_PAD_BOTTOM),
    price: d.price,
    timestamp: d.timestamp,
  })), [chartData, W, startTime, timeRange, minPrice, priceRange, CHART_H])

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

  const totalLength = useMemo(() => {
    return points.reduce((sum, p, i) => {
      if (i === 0) return 0
      const prev = points[i - 1]
      return sum + Math.hypot(p.x - prev.x, p.y - prev.y)
    }, 0)
  }, [points])

  // Keep stable refs for values needed inside the rAF loop
  const pointsRef     = useRef(points)
  const totalLenRef   = useRef(totalLength)
  const chartDataRef  = useRef(chartData)
  const targetColorRef = useRef(targetColor)
  useEffect(() => { pointsRef.current      = points      }, [points])
  useEffect(() => { totalLenRef.current    = totalLength  }, [totalLength])
  useEffect(() => { chartDataRef.current   = chartData    }, [chartData])
  useEffect(() => { targetColorRef.current = targetColor  }, [targetColor])

  const dataKey = chartData.length > 0
    ? `${chartData.length}-${chartData[0]?.price?.toFixed(4)}-${chartData[chartData.length - 1]?.price?.toFixed(4)}`
    : ''

  // Restart draw animation whenever data changes
  useEffect(() => {
    if (chartData.length < 1) return
    setDrawProgress(0)
    setDrawDone(false)
    if (drawAnimRef.current) cancelAnimationFrame(drawAnimRef.current)
    drawStartRef.current = performance.now()
    const DURATION = 8000

    const animate = (now: number) => {
      const t = Math.min((now - drawStartRef.current) / DURATION, 1)
      const eased = 1 - Math.pow(1 - t, 3)

      // Compute color and dot position directly in the loop — no useEffect needed
      const colorT = Math.max(0, Math.min(1, (eased - 0.1) / 0.7))
      const color = lerpColor(C_NEUTRAL, targetColorRef.current, colorT)
      onColorChangeRef.current?.(color)

      const pts = pointsRef.current
      const totLen = totalLenRef.current
      const drawnLen = totLen * eased
      let acc = 0
      let dotPos = pts[pts.length - 1] ?? { x: 0, y: 0, price: 0, timestamp: 0 }
      if (pts.length > 1 && totLen > 0) {
        for (let i = 1; i < pts.length; i++) {
          const prev = pts[i - 1]
          const curr = pts[i]
          const segLen = Math.hypot(curr.x - prev.x, curr.y - prev.y)
          if (acc + segLen >= drawnLen) {
            const seg_t = segLen > 0 ? (drawnLen - acc) / segLen : 0
            dotPos = {
              x: prev.x + seg_t * (curr.x - prev.x),
              y: prev.y + seg_t * (curr.y - prev.y),
              price: prev.price + seg_t * (curr.price - prev.price),
              timestamp: prev.timestamp + seg_t * (curr.timestamp - prev.timestamp),
            }
            break
          }
          acc += segLen
        }
      }

      const cd = chartDataRef.current
      onDrawingPriceChangeRef.current?.(dotPos.price)
      if (cd.length > 0) {
        const fp = cd[0].price
        const rawChange = dotPos.price - fp
        const percentChange = fp > 0 ? (rawChange / fp) * 100 : 0
        onDrawingChangeDataRef.current?.({ percentChange, rawChange })
      }

      setDrawProgress(eased)

      if (t < 1) {
        drawAnimRef.current = requestAnimationFrame(animate)
      } else {
        setDrawDone(true)
        // Fire final color
        onColorChangeRef.current?.(lerpColor(C_NEUTRAL, targetColorRef.current, 1))
      }
    }

    drawAnimRef.current = requestAnimationFrame(animate)
    return () => { if (drawAnimRef.current) cancelAnimationFrame(drawAnimRef.current) }
  }, [dataKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const colorT = Math.max(0, Math.min(1, (drawProgress - 0.1) / 0.7))
  const currentColor = lerpColor(C_NEUTRAL, targetColor, colorT)

  const last = points[points.length - 1]
  const dashArray  = totalLength > 0 ? totalLength : undefined
  const dashOffset = totalLength > 0 ? totalLength * (1 - drawProgress) : undefined

  // Dot position for render
  const currentDrawnLength = totalLength * drawProgress
  let accumulatedLength = 0
  let currentDotPosition = last ?? { x: 0, y: 0, price: 0, timestamp: 0 }
  if (!drawDone && points.length > 1 && totalLength > 0) {
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1]
      const curr = points[i]
      const segLen = Math.hypot(curr.x - prev.x, curr.y - prev.y)
      if (accumulatedLength + segLen >= currentDrawnLength) {
        const t = segLen > 0 ? (currentDrawnLength - accumulatedLength) / segLen : 0
        currentDotPosition = {
          x: prev.x + t * (curr.x - prev.x),
          y: prev.y + t * (curr.y - prev.y),
          price: prev.price + t * (curr.price - prev.price),
          timestamp: prev.timestamp + t * (curr.timestamp - prev.timestamp),
        }
        break
      }
      accumulatedLength += segLen
    }
  }

  return (
    <div className={`bg-transparent ${className}`}>
      <style>{`
        @keyframes sxDotPulse {
          0%   { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(3.2); opacity: 0; }
        }
      `}</style>

      <div style={{ width: '100%', height: CHART_H, position: 'relative' }}>
        <svg
          ref={svgRef}
          width="100%"
          height={CHART_H}
          style={{ display: 'block', overflow: 'visible' }}
        >
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke={currentColor}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={dashArray}
              strokeDashoffset={dashOffset}
            />
          )}

          {last && (
            <>
              {drawDone ? (
                <>
                  <circle
                    cx={last.x}
                    cy={last.y}
                    r="3.5"
                    fill={currentColor}
                    style={{
                      animation: 'sxDotPulse 0.9s ease-out infinite',
                      transformOrigin: 'center',
                      transformBox: 'fill-box',
                    }}
                  />
                  <circle cx={last.x} cy={last.y} r="3.5" fill={currentColor} />
                </>
              ) : (
                <circle cx={currentDotPosition.x} cy={currentDotPosition.y} r="3.5" fill={currentColor} />
              )}
            </>
          )}
        </svg>
      </div>
    </div>
  )
}
