'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import { usePageVisible } from '@/lib/hooks/usePageVisible'

// ── Design tokens ──────────────────────────────────────────────────────────
const BG       = 'rgb(10,10,10)'
const WHITE    = '#ffffff'
const SEC      = '#a1a1aa'
const BORDER   = '#27272a'
const POSITIVE = '#04df9d'
const NEGATIVE = '#FF4B4B'
const FONT     = 'var(--font-inter), system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
const MONO     = 'var(--font-inter), ui-monospace, "Cascadia Code", Menlo, monospace'
const MAX_W    = 1300

const HERO_IDS = [
  '3TVXtAsR1Inumwj472S9r4', // Drake
  '53XhwfbYqKCa1cC15pYq2q', // Imagine Dragons
  '06HL4z0CvFAxyc27GXpf02', // Taylor Swift
  '2YZyLoL8N0Wb9xBt1NhZWg', // Kendrick Lamar
  '6qqNVTkY8uBg9cP3Jd7DAH', // Billie Eilish
]
const HERO_INTERVAL = 12000

// ── Helpers ────────────────────────────────────────────────────────────────
function lerp(a: number, b: number, t: number) { return a + (b - a) * t }
function lerpRGB(
  from: { r: number; g: number; b: number },
  to:   { r: number; g: number; b: number },
  t: number,
) {
  return `rgb(${Math.round(lerp(from.r, to.r, t))},${Math.round(lerp(from.g, to.g, t))},${Math.round(lerp(from.b, to.b, t))})`
}
const C_NEUTRAL  = { r: 4,   g: 223, b: 162 }
const C_POSITIVE = { r: 4,   g: 223, b: 162 }
const C_NEGATIVE = { r: 255, g: 75,  b: 75  }

// ── AboutChart ─────────────────────────────────────────────────────────────
interface DataPoint { index: number; timestamp: string }

function AboutChart({
  data = [] as DataPoint[],
  height: H = 220,
  onPrice, onChange, onColor,
}: {
  data?: DataPoint[]
  height?: number
  onPrice?: (p: number) => void
  onChange?: (d: { percentChange: number; rawChange: number }) => void
  onColor?: (c: string) => void
}) {
  const svgRef  = useRef<SVGSVGElement>(null)
  const [W, setW]           = useState(600)
  const [progress, setProgress] = useState(0)
  const [done, setDone]     = useState(false)
  const rafRef    = useRef<number | null>(null)
  const startRef  = useRef(0)
  const onPriceRef  = useRef(onPrice)
  const onChangeRef = useRef(onChange)
  const onColorRef  = useRef(onColor)
  useEffect(() => { onPriceRef.current  = onPrice  }, [onPrice])
  useEffect(() => { onChangeRef.current = onChange }, [onChange])
  useEffect(() => { onColorRef.current  = onColor  }, [onColor])

  useEffect(() => {
    const update = () => { if (svgRef.current) { const w = svgRef.current.getBoundingClientRect().width; if (w > 0) setW(w) } }
    update()
    const ro = new ResizeObserver(update)
    if (svgRef.current) ro.observe(svgRef.current)
    return () => ro.disconnect()
  }, [])

  const chartData = useMemo(() => {
    const pts = data
      .map(p => ({ timestamp: new Date(p.timestamp).getTime(), price: parseFloat(String(p.index)) }))
      .filter(p => !isNaN(p.timestamp) && !isNaN(p.price))
      .sort((a, b) => a.timestamp - b.timestamp)
    if (!pts.length) return []
    const last = pts[pts.length - 1]
    if (last.timestamp < Date.now() - 30_000) pts.push({ timestamp: Date.now(), price: last.price })
    if (pts.length > 300) {
      const step = (pts.length - 1) / 299
      return Array.from({ length: 300 }, (_, i) => pts[Math.min(Math.round(i * step), pts.length - 1)])
    }
    return pts
  }, [data])

  const firstPrice = chartData[0]?.price ?? 0
  const lastPrice  = chartData[chartData.length - 1]?.price ?? 0
  const isPos   = lastPrice >= firstPrice
  const targetC = isPos ? C_POSITIVE : C_NEGATIVE
  const minP    = chartData.length ? Math.min(...chartData.map(d => d.price)) : 0
  const maxP    = chartData.length ? Math.max(...chartData.map(d => d.price)) : 1
  const pRange  = maxP === minP ? 1 : maxP - minP
  const tStart  = chartData[0]?.timestamp ?? 0
  const tEnd    = chartData[chartData.length - 1]?.timestamp ?? tStart + 1
  const tRange  = tEnd - tStart || 1
  const PAD_T = 16, PAD_B = 16

  const points = useMemo(() => chartData.map(d => ({
    x: ((d.timestamp - tStart) / tRange) * W,
    y: PAD_T + (1 - (d.price - minP) / pRange) * (H - PAD_T - PAD_B),
    price: d.price,
  })), [chartData, W, tStart, tRange, minP, pRange, H])

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')

  const totalLen = useMemo(() => points.reduce((s, p, i) => {
    if (!i) return 0
    const prev = points[i - 1]
    return s + Math.hypot(p.x - prev.x, p.y - prev.y)
  }, 0), [points])

  const pointsRef    = useRef(points)
  const totalLenRef  = useRef(totalLen)
  const chartDataRef = useRef(chartData)
  const targetCRef   = useRef(targetC)
  useEffect(() => { pointsRef.current    = points    }, [points])
  useEffect(() => { totalLenRef.current  = totalLen  }, [totalLen])
  useEffect(() => { chartDataRef.current = chartData }, [chartData])
  useEffect(() => { targetCRef.current   = targetC   }, [targetC])

  const dataKey = `${chartData.length}-${chartData[0]?.price}-${chartData[chartData.length - 1]?.price}`

  useEffect(() => {
    if (!chartData.length) return
    setProgress(0); setDone(false)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    startRef.current = performance.now()
    const DURATION = 8000
    const animate = (now: number) => {
      const t     = Math.min((now - startRef.current) / DURATION, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      const colorT = Math.max(0, Math.min(1, (eased - 0.1) / 0.7))
      onColorRef.current?.(lerpRGB(C_NEUTRAL, targetCRef.current, colorT))
      const pts = pointsRef.current, tot = totalLenRef.current
      const drawn = tot * eased
      let acc = 0, dot = pts[pts.length - 1] ?? { x: 0, y: 0, price: 0 }
      if (pts.length > 1 && tot > 0) {
        for (let i = 1; i < pts.length; i++) {
          const prev = pts[i - 1], curr = pts[i]
          const seg = Math.hypot(curr.x - prev.x, curr.y - prev.y)
          if (acc + seg >= drawn) {
            const st = seg > 0 ? (drawn - acc) / seg : 0
            dot = { x: prev.x + st * (curr.x - prev.x), y: prev.y + st * (curr.y - prev.y), price: prev.price + st * (curr.price - prev.price) }
            break
          }
          acc += seg
        }
      }
      onPriceRef.current?.(dot.price)
      const cd = chartDataRef.current
      if (cd.length) {
        const fp = cd[0].price
        onChangeRef.current?.({ rawChange: dot.price - fp, percentChange: fp > 0 ? ((dot.price - fp) / fp) * 100 : 0 })
      }
      setProgress(eased)
      if (t < 1) { rafRef.current = requestAnimationFrame(animate) }
      else { setDone(true); onColorRef.current?.(lerpRGB(C_NEUTRAL, targetCRef.current, 1)) }
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [dataKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const colorT  = Math.max(0, Math.min(1, (progress - 0.1) / 0.7))
  const color   = lerpRGB(C_NEUTRAL, targetC, colorT)
  const last    = points[points.length - 1]
  const clipW   = W * progress
  const clipId  = `hiw-clip-${dataKey.replace(/[^a-z0-9]/gi, '-')}`

  let dotPos = last ?? { x: 0, y: 0, price: 0 }
  if (!done && progress > 0 && points.length > 1) {
    const targetX = clipW
    for (let i = 1; i < points.length; i++) {
      if (points[i].x >= targetX) {
        const prev = points[i - 1], curr = points[i]
        const dx = curr.x - prev.x
        const st = dx > 0 ? (targetX - prev.x) / dx : 0
        dotPos = { x: targetX, y: prev.y + st * (curr.y - prev.y), price: prev.price + st * (curr.price - prev.price) }
        break
      }
    }
  }

  return (
    <div style={{ width: '100%', height: H, position: 'relative' }}>
      <svg ref={svgRef} width="100%" height={H} style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <clipPath id={clipId}>
            <rect x={0} y={-10} width={clipW} height={H + 20} />
          </clipPath>
        </defs>
        {linePath && progress > 0 && (
          <path
            d={linePath} fill="none" stroke={color} strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
            clipPath={`url(#${clipId})`}
          />
        )}
        {last && done ? (
          <>
            <circle cx={last.x} cy={last.y} r="3.5" fill={color}
              style={{ animation: 'sxDotPulse 0.9s ease-out infinite', transformOrigin: 'center', transformBox: 'fill-box' }} />
            <circle cx={last.x} cy={last.y} r="3.5" fill={color} />
          </>
        ) : dotPos && progress > 0 ? (
          <circle cx={dotPos.x} cy={dotPos.y} r="3.5" fill={color} />
        ) : null}
      </svg>
    </div>
  )
}

// ── StreamingMetricsScroller ───────────────────────────────────────────────
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
const ROW_H = 72, ROW_GAP = 28, STRIDE = ROW_H + ROW_GAP
const TOTAL_SCROLL_H = METRIC_ROWS.length * STRIDE
const VISIBLE = 5, CONTAINER_H = VISIBLE * STRIDE - ROW_GAP

function StreamingMetricsScroller() {
  const innerRef  = useRef<HTMLDivElement>(null)
  const rafRef    = useRef<number | null>(null)
  const offsetRef = useRef(0)

  useEffect(() => {
    const inner = innerRef.current
    if (!inner) return
    const rows = Array.from(inner.querySelectorAll<HTMLElement>('[data-row]'))
    const cy = CONTAINER_H / 2
    const animate = () => {
      offsetRef.current = (offsetRef.current + 0.35) % TOTAL_SCROLL_H
      const off = offsetRef.current
      rows.forEach((el, i) => {
        let y = i * STRIDE - off
        y = ((y % TOTAL_SCROLL_H) + TOTAL_SCROLL_H) % TOTAL_SCROLL_H
        if (y > TOTAL_SCROLL_H / 2) y -= TOTAL_SCROLL_H
        const center = y + ROW_H / 2
        const dist = Math.abs(center)
        const t = Math.min(dist / (CONTAINER_H / 2), 1)
        const angle = t * 55 * -Math.sign(center)
        const scaleX = Math.max(0.4, Math.cos((t * 55 * Math.PI) / 180))
        el.style.transform = `translateY(${y + cy - ROW_H / 2}px) rotateX(${angle}deg) scaleX(${scaleX})`
        el.style.opacity = String(Math.max(0, 1 - t * 1.1))
      })
      rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])

  return (
    <div style={{ width: '100%', height: CONTAINER_H, perspective: 900, perspectiveOrigin: '50% 50%', overflow: 'hidden', position: 'relative', maskImage: 'linear-gradient(to bottom,transparent 0%,black 30%,black 70%,transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom,transparent 0%,black 30%,black 70%,transparent 100%)' }}>
      <div ref={innerRef} style={{ position: 'relative', height: '100%', transformStyle: 'preserve-3d' }}>
        {METRIC_ROWS.map(item => (
          <div key={item.source} data-row style={{ position: 'absolute', left: '0rem', right: '0rem', height: ROW_H, opacity: 0, transformOrigin: '50% 50%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: '1rem', paddingRight: '1rem', height: '100%', borderRadius: '0.5rem', border: `1px solid ${BORDER}`, backgroundColor: 'rgba(255,255,255,0.02)', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: '0rem' }}>
                <span style={{ fontSize: '0.5625rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: SEC, fontFamily: FONT, flexShrink: 0 }}>{item.source}</span>
                <span style={{ fontSize: '0.8125rem', color: WHITE, fontFamily: FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                <span style={{ fontSize: '0.6875rem', fontWeight: 500, color: item.trend.startsWith('+') ? POSITIVE : NEGATIVE, fontFamily: FONT }}>{item.trend}</span>
                <span style={{ fontSize: '0.5625rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0.1875rem 0.375rem', borderRadius: '0.25rem', border: `1px solid ${BORDER}`, fontFamily: FONT, color: item.signal === 'HIGH' ? WHITE : SEC, backgroundColor: item.signal === 'HIGH' ? 'rgba(255,255,255,0.08)' : 'transparent' }}>{item.signal}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── CultureNetworkGraphic ──────────────────────────────────────────────────
function CultureNetworkGraphic() {
  return (
    <svg width="100%" viewBox="0 0 500 500" style={{ maxWidth: '31.25rem', display: 'block', overflow: 'visible' }}>
      <defs>
        <path id="mlc1" d="M 102 102 L 250 250"/><path id="mlc2" d="M 398 102 L 250 250"/>
        <path id="mlc3" d="M 102 398 L 250 250"/><path id="mlc4" d="M 398 398 L 250 250"/>
        <path id="mlc5" d="M 250 40 L 250 250" /><path id="mlc6" d="M 460 250 L 250 250"/>
        <path id="mlc7" d="M 250 460 L 250 250"/><path id="mlc8" d="M 40 250 L 250 250" />
      </defs>
      {([[102,102],[398,102],[102,398],[398,398]] as [number,number][]).map(([x,y],i)=>(
        <line key={i} x1={x} y1={y} x2={250} y2={250} stroke={BORDER} strokeWidth="2"/>
      ))}
      {([[250,40],[460,250],[250,460],[40,250]] as [number,number][]).map(([x,y],i)=>(
        <line key={i+4} x1={x} y1={y} x2={250} y2={250} stroke={BORDER} strokeWidth="2"/>
      ))}
      {(['mlc1','mlc2','mlc3','mlc4','mlc5','mlc6','mlc7','mlc8'] as const).map((id,i)=>(
        <circle key={i} r="3" fill="white" opacity="0">
          <animateMotion dur="3s" repeatCount="indefinite" begin={`${i*0.375}s`}><mpath href={`#${id}`}/></animateMotion>
          <animate attributeName="opacity" values="0.3;0.9;0" dur="3s" repeatCount="indefinite" begin={`${i*0.375}s`}/>
        </circle>
      ))}
      <circle cx="102" cy="102" r="22" fill={BORDER} opacity="0.8"/>
      <g transform="translate(102,102) scale(0.65) translate(-12,-12)">
        <path d="M2 19h20v3H2zM12 2L2 6v2h20V6M17 10h3v7h-3zM10.5 10h3v7h-3zM4 10h3v7H4z" fill="white" opacity="0.9"/>
      </g>
      <circle cx="398" cy="102" r="22" fill={BORDER} opacity="0.8"/>
      <g transform="translate(398,102) scale(0.65)">
        <path d="M -12 9 L -6 3 L 0 6 L 6 -3 L 12 -9" stroke="white" strokeWidth="2" fill="none" opacity="0.9" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M 6 -9 L 12 -9 L 12 -3" stroke="white" strokeWidth="2" fill="none" opacity="0.9" strokeLinecap="round" strokeLinejoin="round"/>
      </g>
      <circle cx="102" cy="398" r="22" fill={BORDER} opacity="0.8"/>
      <g transform="translate(102,398) scale(0.65)">
        <circle cx="0" cy="-6" r="5" fill="white" opacity="0.9"/>
        <path d="M -9 12 Q -9 3 0 3 Q 9 3 9 12" fill="white" opacity="0.9"/>
      </g>
      <circle cx="398" cy="398" r="22" fill={BORDER} opacity="0.8"/>
      <g transform="translate(398,398) scale(0.65)">
        <circle cx="-6" cy="-4.5" r="3.75" fill="white" opacity="0.9"/>
        <circle cx="6" cy="-4.5" r="3.75" fill="white" opacity="0.9"/>
        <path d="M -12 9 Q -12 1.5 -6 1.5 Q 0 1.5 0 9 M 0 9 Q 0 1.5 6 1.5 Q 12 1.5 12 9" fill="white" opacity="0.9"/>
      </g>
      <circle cx="250" cy="40" r="22" fill={BORDER} opacity="0.8"/>
      <g transform="translate(250,40) scale(0.65)">
        <rect x="-3" y="-12" width="6" height="15" rx="3" fill="white" opacity="0.9"/>
        <path d="M -6 3 Q -6 7.5 0 7.5 Q 6 7.5 6 3 M 0 7.5 L 0 12 M -4.5 12 L 4.5 12" stroke="white" strokeWidth="1.5" fill="none" opacity="0.9" strokeLinecap="round"/>
      </g>
      <circle cx="460" cy="250" r="22" fill={BORDER} opacity="0.8"/>
      <g transform="translate(460,250) scale(0.65)">
        <path d="M 0 12 C -12 0 -12 -9 -4.5 -9 C 0 -9 0 -4.5 0 -4.5 C 0 -4.5 0 -9 4.5 -9 C 12 -9 12 0 0 12 Z" fill="white" opacity="0.9"/>
      </g>
      <circle cx="250" cy="460" r="22" fill={BORDER} opacity="0.8"/>
      <g transform="translate(250,460) scale(0.65)">
        <circle cx="0" cy="0" r="10.5" fill="none" stroke="white" strokeWidth="1.5" opacity="0.9"/>
        <circle cx="0" cy="0" r="3.75" fill="white" opacity="0.9"/>
      </g>
      <circle cx="40" cy="250" r="22" fill={BORDER} opacity="0.8"/>
      <g transform="translate(40,250) scale(0.65)">
        <circle cx="0" cy="0" r="10.5" fill="none" stroke="white" strokeWidth="1.5" opacity="0.9"/>
        <ellipse cx="0" cy="0" rx="4.5" ry="10.5" fill="none" stroke="white" strokeWidth="1" opacity="0.9"/>
        <path d="M -10.5 0 L 10.5 0 M -7.5 -6 Q 0 -6 7.5 -6 M -7.5 6 Q 0 6 7.5 6" stroke="white" strokeWidth="1" fill="none" opacity="0.9"/>
      </g>
      <circle cx="250" cy="250" r="24" fill="white" opacity="0.9"/>
      <g transform="translate(250,247)">
        <path d="M 0 -11 C 4 -6 10 2 10 7 A 10 10 0 0 1 -10 7 C -10 2 -4 -6 0 -11 Z" fill={BG} opacity="0.9"/>
      </g>
    </svg>
  )
}

// ── RadarGraphic ───────────────────────────────────────────────────────────
const RCX = 230, RCY = 230, R_MAX = 170
const R_AXES  = ['STREAMING','POSITIONING','CONVICTION','MOMENTUM','VOLUME','SIGNAL']
const R_ANGLES = Array.from({length:6},(_,i)=> -Math.PI/2 + i*(Math.PI/3))
const RV1 = [0.82,0.88,0.72,0.85,0.65,0.90]
const RV2 = [0.75,0.92,0.80,0.78,0.88,0.70]
const RVD = [0.40,0.50,0.45,0.55,0.35,0.48]
function rPoly(vals: number[]) {
  return vals.map((v,i)=>`${(RCX+v*R_MAX*Math.cos(R_ANGLES[i])).toFixed(1)},${(RCY+v*R_MAX*Math.sin(R_ANGLES[i])).toFixed(1)}`).join(' ')
}
const RP_DIM=rPoly(RVD), RP1=rPoly(RV1), RP2=rPoly(RV2)
const RVerts1=RV1.map((v,i)=>({ x:RCX+v*R_MAX*Math.cos(R_ANGLES[i]), y:RCY+v*R_MAX*Math.sin(R_ANGLES[i]) }))
const RVerts2=RV2.map((v,i)=>({ x:RCX+v*R_MAX*Math.cos(R_ANGLES[i]), y:RCY+v*R_MAX*Math.sin(R_ANGLES[i]) }))
const SP='0.45 0 0.55 1;0.45 0 0.55 1'

function RadarGraphic() {
  return (
    <svg width="100%" viewBox="0 0 460 460" style={{ maxWidth: '28.75rem', display: 'block', overflow: 'visible' }}>
      <defs>
        <radialGradient id="mrgGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="white" stopOpacity="0.10"/>
          <stop offset="100%" stopColor="white" stopOpacity="0"/>
        </radialGradient>
      </defs>
      {[0.33,0.66].map(s=>(
        <polygon key={s} fill="none" stroke={BORDER} strokeWidth="1.4" opacity="0.3">
          <animate attributeName="points" values={`${rPoly(RV1.map(v=>v*s))};${rPoly(RV2.map(v=>v*s))};${rPoly(RV1.map(v=>v*s))}`} dur="7s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines={SP}/>
        </polygon>
      ))}
      {RVerts1.map((v1,i)=>{ const v2=RVerts2[i]; return (
        <line key={i} x1={RCX} y1={RCY} strokeWidth="1.4" stroke={BORDER} opacity="0.5">
          <animate attributeName="x2" values={`${v1.x.toFixed(1)};${v2.x.toFixed(1)};${v1.x.toFixed(1)}`} dur="7s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines={SP}/>
          <animate attributeName="y2" values={`${v1.y.toFixed(1)};${v2.y.toFixed(1)};${v1.y.toFixed(1)}`} dur="7s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines={SP}/>
        </line>
      )})}
      <polygon points={RP_DIM} fill="rgba(255,255,255,0.025)" stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>
      <polygon fill="rgba(255,255,255,0.05)" stroke={BORDER} strokeWidth="1.4" strokeLinejoin="round">
        <animate attributeName="points" values={`${RP1};${RP2};${RP1}`} dur="7s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines={SP}/>
        <animate attributeName="opacity" values="0.82;1;0.82" dur="7s" repeatCount="indefinite"/>
      </polygon>
      <circle cx={RCX} cy={RCY} r={70} fill="url(#mrgGlow)"/>
      {RVerts1.map((v1,i)=>{ const v2=RVerts2[i]; return (
        <circle key={i} r="2.5" fill="white" opacity="0.75">
          <animate attributeName="cx" values={`${v1.x.toFixed(1)};${v2.x.toFixed(1)};${v1.x.toFixed(1)}`} dur="7s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines={SP}/>
          <animate attributeName="cy" values={`${v1.y.toFixed(1)};${v2.y.toFixed(1)};${v1.y.toFixed(1)}`} dur="7s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines={SP}/>
          <animate attributeName="opacity" values="0.65;0.95;0.65" dur="7s" repeatCount="indefinite"/>
        </circle>
      )})}
      <circle cx={RCX} cy={RCY} r="3.5" fill="white">
        <animate attributeName="r" values="2.5;4;2.5" dur="3s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.65;1;0.65" dur="3s" repeatCount="indefinite"/>
      </circle>
      {R_AXES.map((label,i)=>{
        const cos=Math.cos(R_ANGLES[i])
        return <text key={label} x={(RCX+(R_MAX+22)*cos).toFixed(1)} y={(RCY+(R_MAX+22)*Math.sin(R_ANGLES[i])).toFixed(1)} textAnchor={Math.abs(cos)<0.15?'middle':cos>0?'start':'end'} dominantBaseline="middle" fontSize="8" fontFamily={FONT} fill="white" opacity="0.45" letterSpacing="0.06em">{label}</text>
      })}
    </svg>
  )
}

// ── MonogramBackground ─────────────────────────────────────────────────────
function MonogramBackground({ opacity: op = 0.07 }: { opacity?: number }) {
  const COL_GAP = 55, ROW_GAP = 48, SZ = 24
  const cols = Math.ceil(1600 / COL_GAP) + 4
  const rows = Math.ceil(1000 / ROW_GAP) + 4
  const tiles: { x: number; y: number }[] = []
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      tiles.push({ x: c * COL_GAP + (r % 2 === 1 ? COL_GAP / 2 : 0) - COL_GAP * 2, y: r * ROW_GAP - ROW_GAP * 2 })
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {tiles.map((t, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={i} src="/sonotrade_glyph_square_transparent.png" alt="" style={{ position: 'absolute', left: t.x, top: t.y, width: SZ, height: SZ, opacity: op, userSelect: 'none', pointerEvents: 'none' }}/>
      ))}
    </div>
  )
}

// ── TopArtistsList ─────────────────────────────────────────────────────────
interface TopArtist { id: string; name: string; index_price: number | null; change_1m: number | null; image_url?: string | null }
function TopArtistsList() {
  const pageVisible = usePageVisible()
  const [artists, setArtists] = useState<TopArtist[]>([])
  const [idx, setIdx]         = useState(0)

  useEffect(() => {
    fetch('/api/discover?limit=10&offset=0&sort_by=index_price&sort_dir=desc')
      .then(r => r.ok ? r.json() : null)
      .then(d => setArtists(d?.artists ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!artists.length || !pageVisible) return
    const t = setInterval(() => {
      setIdx(i => (i + 1) % artists.length)
    }, 3000)
    return () => clearInterval(t)
  }, [artists.length, pageVisible])

  if (!artists.length) return null
  const artist = artists[idx]
  const change = artist?.change_1m ?? null

  return (
    <a
      key={`${artist.id}-${idx}`}
      href={`/artist/${encodeURIComponent(artist.id)}`}
      style={{ display: 'block', textDecoration: 'none', animation: 'artistFadeIn 0.4s cubic-bezier(0.25,0.46,0.45,0.94) both', marginTop: '0rem' }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem', border: `1px solid ${BORDER}`, borderRadius: '0.75rem', backgroundColor: 'rgba(255,255,255,0.02)' }}>
        {artist?.image_url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={artist.image_url} alt={artist.name} style={{ width: '1.875rem', height: '1.875rem', flexShrink: 0, borderRadius: '50%', objectFit: 'cover' }}/>
          : <div style={{ width: '1.875rem', height: '1.875rem', flexShrink: 0, borderRadius: '50%', backgroundColor: '#27272a' }}/>}
        <div style={{ flex: 1, minWidth: '0rem', display: 'flex', flexDirection: 'column', gap: '0.0625rem' }}>
          <span style={{ fontSize: '0.8125rem', color: WHITE, fontFamily: FONT, fontWeight: 400, letterSpacing: '-0.0125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{artist?.name}</span>
          <span style={{ fontSize: '0.625rem', color: SEC, fontFamily: FONT }}>Index</span>
        </div>
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.125rem' }}>
          <span style={{ fontSize: '0.6875rem', color: SEC, fontFamily: FONT }}>
            {artist?.index_price != null ? artist.index_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
            <span style={{ fontSize: '0.5625rem', marginLeft: '0.1875rem' }}>USD</span>
          </span>
          {change != null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.1875rem' }}>
              <svg width="10" height="10" viewBox="0 0 24 14" fill="none" style={{ color: change >= 0 ? POSITIVE : NEGATIVE, transform: `rotate(${change >= 0 ? 0 : 180}deg)`, flexShrink: 0, marginTop: '0.125rem' }}>
                <path fill="currentColor" d="m12 0 10.392 14.25H1.608z"/>
              </svg>
              <span style={{ fontSize: '0.6875rem', fontWeight: 500, color: change >= 0 ? POSITIVE : NEGATIVE, fontFamily: FONT }}>{Math.abs(change).toFixed(2)}%</span>
            </div>
          )}
        </div>
      </span>
    </a>
  )
}

// ── FoundationsGraphic ─────────────────────────────────────────────────────
const F_CX = [82, 214, 346, 478]
const F_CY = 28, F_R = 22

function FoundationsGraphic() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      <svg width="100%" viewBox="0 0 560 258" style={{ overflow: 'visible' }}>
        <defs>
          <path id="mp1" d={`M ${F_CX[0]} ${F_CY+F_R} L ${F_CX[0]} 140 L 280 200 L 280 258`}/>
          <path id="mp2" d={`M ${F_CX[1]} ${F_CY+F_R} L ${F_CX[1]} 140 L 280 200 L 280 258`}/>
          <path id="mp3" d={`M ${F_CX[2]} ${F_CY+F_R} L ${F_CX[2]} 140 L 280 200 L 280 258`}/>
          <path id="mp4" d={`M ${F_CX[3]} ${F_CY+F_R} L ${F_CX[3]} 140 L 280 200 L 280 258`}/>
        </defs>
        {F_CX.map(cx => <circle key={cx} cx={cx} cy={F_CY} r={F_R} fill={BORDER} opacity="0.8"/>)}
        <g transform={`translate(${F_CX[0]},${F_CY}) scale(0.6) translate(-12,-12)`}>
          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" fill="white" opacity="0.9"/>
        </g>
        <g transform={`translate(${F_CX[1]},${F_CY}) scale(0.6) translate(-12,-12)`}>
          <path d="M23.994 6.124a9.23 9.23 0 0 0-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 0 0-1.877-.726 10.496 10.496 0 0 0-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026-.747.043-1.49.123-2.193.4-1.336.53-2.3 1.452-2.865 2.78-.192.448-.292.925-.363 1.408a10.61 10.61 0 0 0-.1 1.18c0 .032-.007.062-.01.093v12.223c.01.14.017.283.027.424.05.815.154 1.624.497 2.373.65 1.42 1.738 2.353 3.234 2.801.42.127.856.187 1.293.228.555.053 1.11.06 1.667.06h11.03a12.5 12.5 0 0 0 1.57-.1c.822-.106 1.596-.35 2.296-.81a5.046 5.046 0 0 0 1.88-2.207c.186-.42.293-.87.37-1.324.113-.675.138-1.358.137-2.04-.002-3.8 0-7.595-.003-11.393zm-6.423 3.99v5.712c0 .417-.058.827-.244 1.206-.29.59-.76.962-1.388 1.14-.35.1-.706.157-1.07.173-.95.045-1.773-.6-1.943-1.536a1.88 1.88 0 0 1 1.038-2.022c.323-.16.67-.25 1.018-.324.378-.082.758-.153 1.134-.24.274-.063.457-.23.51-.516a.904.904 0 0 0 .02-.193c0-1.815 0-3.63-.002-5.443a.725.725 0 0 0-.026-.185c-.04-.15-.15-.243-.304-.234-.16.01-.318.035-.475.066l-5.597 1.09c-.306.06-.43.197-.437.516v7.37c0 .38-.05.753-.203 1.103-.28.64-.77 1.04-1.434 1.233-.365.106-.742.16-1.123.18-.96.05-1.79-.593-1.96-1.53a1.88 1.88 0 0 1 1.048-2.025c.355-.177.735-.267 1.117-.344.27-.055.54-.102.808-.16.39-.084.594-.292.615-.696.004-.08 0-.16 0-.24V5.992c0-.564.15-.915.57-1.04 1.914-.568 3.83-1.132 5.744-1.697.582-.172 1.164-.345 1.746-.516.47-.14.69-.01.69.478v5.896z" fill="white" opacity="0.9"/>
        </g>
        <g transform={`translate(${F_CX[2]},${F_CY}) scale(0.6) translate(-12,-12)`}>
          <path d="M18.81 4.16v3.03h5.16V4.16h-5.16zm0 4.54v3.03h5.16V8.7h-5.16zm0 4.54v3.03h5.16v-3.03h-5.16zM12.63 4.16v3.03h5.16V4.16h-5.16zm0 4.54v3.03h5.16V8.7h-5.16zm0 4.54v3.03h5.16v-3.03h-5.16zm0 4.54v3.03h5.16v-3.03h-5.16zM6.45 8.7v3.03h5.16V8.7H6.45zm0 4.54v3.03h5.16v-3.03H6.45zm0 4.54v3.03h5.16v-3.03H6.45zM.27 13.24v3.03h5.16v-3.03H.27zm0 4.54v3.03h5.16v-3.03H.27z" fill="white" opacity="0.9"/>
        </g>
        <g transform={`translate(${F_CX[3]},${F_CY}) scale(0.6) translate(-12,-12)`}>
          <path d="M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S18.624 0 12 0zm0 19.104c-3.924 0-7.104-3.18-7.104-7.104S8.076 4.896 12 4.896s7.104 3.18 7.104 7.104-3.18 7.104-7.104 7.104zm0-13.332c-3.432 0-6.228 2.796-6.228 6.228S8.568 18.228 12 18.228s6.228-2.796 6.228-6.228S15.432 5.772 12 5.772zM9.684 15.54V8.46L15.816 12l-6.132 3.54z" fill="white" opacity="0.9"/>
        </g>
        {F_CX.map(cx => <line key={cx} x1={cx} y1={F_CY+F_R} x2={cx} y2="140" stroke={BORDER} strokeWidth="2"/>)}
        {F_CX.map(cx => <line key={`c${cx}`} x1={cx} y1="140" x2="280" y2="200" stroke={BORDER} strokeWidth="2"/>)}
        <line x1="280" y1="200" x2="280" y2="258" stroke={BORDER} strokeWidth="2"/>
        {(['mp1','mp2','mp3','mp4'] as const).map((id,i) => (
          <circle key={id} r="2.5" fill="white">
            <animateMotion dur="4s" repeatCount="indefinite" begin={`${i*0.5}s`}><mpath href={`#${id}`}/></animateMotion>
            <animate attributeName="opacity" values="0.3;0.9;0.9;0.3" dur="4s" repeatCount="indefinite" begin={`${i*0.5}s`}/>
          </circle>
        ))}
        {(['mp1','mp2','mp3','mp4'] as const).map((id,i) => (
          <circle key={`${id}b`} r="2.5" fill="white">
            <animateMotion dur="4s" repeatCount="indefinite" begin={`${i*0.5+2}s`}><mpath href={`#${id}`}/></animateMotion>
            <animate attributeName="opacity" values="0.3;0.9;0.9;0.3" dur="4s" repeatCount="indefinite" begin={`${i*0.5+2}s`}/>
          </circle>
        ))}
      </svg>
      <div style={{ width: '100%', paddingLeft: '1.75rem', paddingRight: '1.75rem', marginTop: '0rem' }}>
        <TopArtistsList/>
      </div>
    </div>
  )
}

// ── Reusable helpers ───────────────────────────────────────────────────────
function SectionLabel({ text }: { text: string }) {
  return <span style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: SEC, fontFamily: FONT }}>{text}</span>
}

function TextBlocks({ items }: { items: { title: string; body: string }[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {items.map(({ title, body }) => (
        <div key={title}>
          <h3 style={{ margin: '0 0 0.625rem', padding: '0rem', fontSize: '0.875rem', fontWeight: 400, color: WHITE, fontFamily: FONT }}>{title}</h3>
          <p style={{ fontSize: '0.75rem', color: SEC, fontFamily: FONT, lineHeight: 1.7, margin: '0rem' }}>{body}</p>
        </div>
      ))}
    </div>
  )
}

function StartTradingButton({ style }: { style?: React.CSSProperties }) {
  return (
    <Link
      href="/trade"
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '624.9375rem', backgroundColor: WHITE, color: BG, border: 'none', cursor: 'pointer', textDecoration: 'none', fontFamily: FONT, fontWeight: 500, fontSize: '0.875rem', padding: '0.5rem 1.25rem', transition: 'opacity 0.075s', ...style }}
      onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '0.8' }}
      onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '1' }}
    >
      Start Trading
    </Link>
  )
}

// ── Main Mobile How It Works Page ──────────────────────────────────────────
export function HowItWorksMobile() {
  const [heroArtists, setHeroArtists] = useState<Array<{ name: string; data_points: DataPoint[]; image_url?: string | null; index_price?: number | null }>>([])
  const [heroLoaded, setHeroLoaded]   = useState(false)
  const [heroIdx, setHeroIdx]         = useState(0)
  const heroPageVisible = usePageVisible()
  const [heroOpacity, setHeroOpacity] = useState(1)
  const [drawingPrice, setDrawingPrice] = useState<number | null>(null)
  const [changeData, setChangeData]   = useState<{ percentChange: number; rawChange: number } | null>(null)
  const [chartColor, setChartColor]   = useState(POSITIVE)

  useEffect(() => {
    let cancelled = false
    Promise.all(HERO_IDS.map(id =>
      fetch(`/api/artist/${encodeURIComponent(id)}?history=true`).then(r => r.ok ? r.json() : null).then(d => d?.artist ?? null).catch(() => null)
    )).then(results => {
      if (!cancelled) { setHeroArtists(results.filter(Boolean) as Array<{ name: string; data_points: DataPoint[]; image_url?: string | null; index_price?: number | null }>); setHeroLoaded(true) }
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!heroLoaded || !heroArtists.length || !heroPageVisible) return
    const t = setInterval(() => {
      setHeroOpacity(0)
      setTimeout(() => {
        setHeroIdx(i => (i + 1) % heroArtists.length)
        setDrawingPrice(null); setChangeData(null); setChartColor(POSITIVE)
        requestAnimationFrame(() => setHeroOpacity(1))
      }, 650)
    }, HERO_INTERVAL)
    return () => clearInterval(t)
  }, [heroLoaded, heroArtists.length, heroPageVisible])

  const artist    = heroArtists[heroIdx] ?? null
  const chartData = artist?.data_points ?? []

  const PX = 20

  return (
    <div style={{ minHeight: '100vh', backgroundColor: BG, fontFamily: FONT }}>
      <style>{`
        @keyframes sxDotPulse {
          0%   { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(3.2); opacity: 0; }
        }
        @keyframes artistFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .hiw-inner  { width: '6.25rem'%; max-width: ${MAX_W}px; margin: 0 auto; padding-left: ${PX}px; padding-right: ${PX}px; box-sizing: border-box; }
        .hiw-sec    { padding-top: 56px; padding-bottom: 56px; }
        .hiw-row    { display: flex; flex-direction: column; gap: 40px; }
        .hiw-grid-3 { display: grid; grid-template-columns: 1fr; gap: 14px; }
        .hiw-grid-2 { display: grid; grid-template-columns: 1fr; gap: 28px; }
        .hiw-h1 { font-size: 22px; font-weight: 300; line-height: '0.071875rem'; color: ${WHITE}; font-family: ${FONT}; margin: 0 0 16px; padding: '0rem'; }
        .hiw-h2 { font-size: 21px; font-weight: 300; line-height: '0.075rem'; color: ${WHITE}; font-family: ${FONT}; margin: '0rem'; padding: '0rem'; }
      `}</style>

      {/* ── Hero ── */}
      <section style={{ borderBottom: `1px solid ${BORDER}`, backgroundColor: BG }}>
        <div className="hiw-inner hiw-sec">
          <div className="hiw-row" style={{ alignItems: 'flex-start' }}>
            {/* Text */}
            <div style={{ flex: 1, minWidth: '0rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0rem', marginBottom: '1.5rem' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/sonotrade_glyph_square_transparent.png" alt="" style={{ height: '2.875rem', width: 'auto' }}/>
                <span style={{ fontSize: '2.125rem', fontWeight: 400, letterSpacing: '-0.05em', color: WHITE, fontFamily: FONT, lineHeight: 1.5 }}>Sonotrade</span>
              </div>
              <h1 className="hiw-h1">The market where artists become tradable</h1>
              <p style={{ fontSize: '0.8125rem', color: SEC, fontFamily: FONT, lineHeight: 1.7, margin: '0rem' }}>
                Connecting retail traders, record labels, and institutional participants through a single, data-driven exchange.
              </p>
              <StartTradingButton style={{ marginTop: '1.25rem' }} />
            </div>
            {/* Chart — always reserves space to prevent layout shift */}
            <div style={{ flex: 1, minWidth: '0rem', width: '100%', minHeight: '22rem' }}>
              {!heroLoaded ? (
                <div style={{ height: '22rem' }}/>
              ) : artist ? (
                <div style={{ opacity: heroOpacity, transition: 'opacity 0.6s ease' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                    {artist.image_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={artist.image_url} alt={artist.name} style={{ width: '3rem', height: '3rem', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} draggable={false}/>
                      : <div style={{ width: '3rem', height: '3rem', borderRadius: '50%', backgroundColor: BORDER, flexShrink: 0 }}/>}
                    <h2 style={{ margin: '0rem', padding: '0rem', fontSize: '1.375rem', fontWeight: 300, color: WHITE, fontFamily: FONT }}>{artist.name ?? ''}</h2>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '1.625rem', fontWeight: 600, color: WHITE, fontFamily: FONT, letterSpacing: '-0.02em' }}>
                      ${(drawingPrice ?? artist.index_price ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span style={{ fontSize: '1.125rem', fontWeight: 300, color: WHITE, fontFamily: FONT }}>points</span>
                    {changeData && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <svg width="14" height="14" viewBox="0 0 24 18" fill="none" style={{ color: chartColor, transform: `rotate(${changeData.percentChange >= 0 ? '0deg' : '180deg'}) translateY(${changeData.percentChange >= 0 ? '0rem' : '0.1875rem'})`, marginTop: changeData.percentChange >= 0 ? 3 : 0 }}>
                          <path fill="currentColor" d="m12 0 10.392 14.25H1.608z"/>
                        </svg>
                        <span style={{ fontSize: '0.875rem', color: chartColor, fontFamily: FONT }}>{Math.abs(changeData.percentChange).toFixed(2)}%</span>
                        <span style={{ fontSize: '0.875rem', color: chartColor, fontFamily: FONT }}>
                          {changeData.rawChange >= 0 ? '+' : '-'}${Math.abs(changeData.rawChange).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                  <AboutChart data={chartData} height={198} onPrice={setDrawingPrice} onChange={setChangeData} onColor={setChartColor}/>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* ── Foundations ── */}
      <section id="foundations" style={{ borderBottom: `1px solid ${BORDER}`, backgroundColor: BG }}>
        <div className="hiw-inner hiw-sec">
          <div className="hiw-row">
            <div style={{ flex: 1, minWidth: '0rem' }}>
              <div style={{ marginBottom: '2.5rem' }}><SectionLabel text="WHAT IS SONOTRADE"/></div>
              <TextBlocks items={[
                { title: 'Our Mission', body: 'Sonotrade is building the first regulated exchange for the music industry. The platform aggregates streaming and performance data to construct live indexes for individual artists, enabling participants to take long or short positions on how an artist performs over time. It serves both retail traders seeking direct market exposure and industry participants who need instruments to hedge financial risk across signings and catalogue acquisitions.' },
                { title: 'The Indexes', body: 'Each artist listed on Sonotrade is assigned a live index that recalculates continuously from streaming volume, chart positioning, and broader performance data. Every contract traded on the platform is priced against this index, ensuring that market prices remain anchored to verifiable, real-world output rather than sentiment alone.' },
                { title: 'The Vision', body: 'The music industry generates substantial economic activity, yet structured financial instruments for it have never existed at scale. Labels absorb significant balance sheet risk through advances and royalty commitments, while retail participants have had no route into the asset class. Sonotrade closes both gaps, providing the exchange infrastructure needed to price, trade, and hedge music-related risk for the first time.' },
              ]}/>
            </div>
            <div style={{ width: '100%' }}>
              <FoundationsGraphic/>
            </div>
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" style={{ borderBottom: `1px solid ${BORDER}`, backgroundColor: BG }}>
        <div className="hiw-inner hiw-sec" style={{ paddingBottom: '1rem' }}>
          <div style={{ marginBottom: '2.5rem' }}><SectionLabel text="WHY STREAMING METRICS MATTER"/></div>
          <div className="hiw-row">
            <div style={{ flex: 1, minWidth: '0rem' }}>
              <TextBlocks items={[
                { title: 'Streams drive commercial value', body: 'In the modern music economy, commercial value tracks listenership with near-perfect correlation. Streams determine chart positions, chart positions unlock sync licensing deals, festival slots, and brand partnerships. All of that flows back into catalogue valuations and advance negotiations.' },
                { title: 'The missing market', body: 'Until now there has been no structured way to act on that signal. A label can observe that an artist is growing, but has no instrument to hedge the risk of that growth reversing after a multi-million-dollar advance. A retail participant can sense cultural momentum, but has no market to express that view.' },
                { title: 'The Sonotrade solution', body: 'Sonotrade converts observable streaming data into tradeable indexes, making the relationship between audience and economic value legible, liquid, and actionable for the first time.' },
              ]}/>
            </div>
            <StreamingMetricsScroller/>
          </div>
        </div>
      </section>

      {/* ── Who Is It For ── */}
      <section style={{ backgroundColor: BG }}>
        <div className="hiw-inner hiw-sec">
          <div className="hiw-row">
            <div style={{ flex: 1, minWidth: '0rem' }}>
              <div style={{ marginBottom: '2.5rem' }}><SectionLabel text="WHO IS SONOTRADE FOR"/></div>
              <div className="hiw-grid-2">
                {[
                  { num: '01', icon: <svg width="24" height="24" viewBox="-14 -14 28 28" fill="none" style={{ color: SEC }}><circle cx="-5" cy="-5" r="4" fill="currentColor" opacity="0.8"/><circle cx="5" cy="-5" r="4" fill="currentColor" opacity="0.8"/><path d="M -11 10 Q -11 2 -5 2 Q 0 2 0 10 M 0 10 Q 0 2 5 2 Q 11 2 11 10" fill="currentColor" opacity="0.8"/></svg>, body: 'Retail participants seeking direct financial exposure to the music industry. Establish long or short positions on individual artists, with pricing grounded in live performance data rather than sentiment.' },
                  { num: '02', icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style={{ color: SEC, opacity: 0.8 }}><path d="M2 19h20v3H2zM12 2L2 6v2h20V6M17 10h3v7h-3zM10.5 10h3v7h-3zM4 10h3v7H4z"/></svg>, body: 'Record labels and industry institutions that carry financial exposure across artist signings, advance structures, and royalty portfolios, and require instruments to actively manage and hedge that risk.' },
                  { num: '03', icon: <svg width="24" height="24" viewBox="-13 -13 26 26" fill="none" style={{ color: SEC }}><circle cx="0" cy="0" r="11" stroke="currentColor" strokeWidth="1.5" opacity="0.8"/><ellipse cx="0" cy="0" rx="4.5" ry="11" stroke="currentColor" strokeWidth="1" opacity="0.8"/><line x1="-11" y1="0" x2="11" y2="0" stroke="currentColor" strokeWidth="1" opacity="0.6"/></svg>, body: 'Any participant who recognises that cultural output carries measurable economic value and wants a structured way to act on it. Sonotrade provides the exchange infrastructure to do so with precision and transparency.', span2: true },
                ].map(({ num, icon, body, span2 }) => (
                  <div key={num} style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', ...(span2 ? { gridColumn: '1 / -1' } : {}) }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                      <span style={{ fontSize: '2.25rem', fontWeight: 300, color: WHITE, fontFamily: FONT, lineHeight: 1 }}>{num}</span>
                      {icon}
                    </div>
                    <p style={{ fontSize: '0.75rem', color: SEC, fontFamily: FONT, lineHeight: 1.7, margin: '0rem' }}>{body}</p>
                  </div>
                ))}
              </div>
            </div>
            <CultureNetworkGraphic/>
          </div>
        </div>
      </section>

      {/* ── Data & Research ── */}
      <section id="data-research" style={{ borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`, backgroundColor: BG }}>
        <div className="hiw-inner hiw-sec">
          <div className="hiw-row">
            <div style={{ flex: 1, minWidth: '0rem' }}>
              <div style={{ marginBottom: '2.5rem' }}><SectionLabel text="DATA & RESEARCH"/></div>
              <TextBlocks items={[
                { title: 'A market that generates data at scale', body: 'Every trade placed on Sonotrade produces a data point. Across thousands of participants and thousands of artists, that adds up to a dense, continuously updated picture of where capital and conviction are moving in real time. No other source generates this kind of structured, financially-grounded dataset in the music industry.' },
                { title: 'Beyond engagement metrics', body: 'The positioning data generated on Sonotrade carries an informational depth that goes well beyond surface-level popularity metrics. When participants put capital behind an artist, they are expressing a conviction backed by real risk. That signal is a fundamentally different kind of data to engagement or follower counts.' },
                { title: 'Market behaviour as intelligence', body: 'Trading activity on a live market generates a continuous stream of behavioural signals. When participants with strong historical accuracy begin moving around the same artist, that pattern carries information the kind that does not surface through traditional scouting channels.' },
                { title: 'Top traders as a signal source', body: 'In any market, a subset of participants consistently positions ahead of broader moves. When that subset begins concentrating around the same artist, it is financially-backed conviction from people who have repeatedly demonstrated patterns that predict hits.' },
              ]}/>
            </div>
            <RadarGraphic/>
          </div>
        </div>
      </section>

      {/* ── A&R Team ── */}
      <section id="ar-team" style={{ borderBottom: `1px solid ${BORDER}`, backgroundColor: BG }}>
        <div className="hiw-inner hiw-sec">
          <div style={{ marginBottom: '2.5rem' }}><SectionLabel text="A&R TEAM"/></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2.5rem' }}>
            <h2 className="hiw-h2">An A&amp;R engine built on market behaviour, not traditional scouting</h2>
            <p style={{ fontSize: '0.75rem', color: SEC, fontFamily: FONT, lineHeight: 1.7, margin: '0rem' }}>
              Sonotrade operates a dedicated A&amp;R team that works directly from the signals generated by the platform. Rather than relying on traditional scouting alone, the team uses positioning data as a primary input, identifying where conviction is clustering, cross-referencing that against streaming trajectory and index momentum, and converting the strongest signals into active deal flow.
            </p>
          </div>
          <div className="hiw-grid-3">
            {[
              { num: '01', body: 'Trading activity is monitored for clustering patterns — moments where positioning across multiple participants begins to converge around the same artist within a short window.' },
              { num: '02', body: 'Candidate signals are evaluated against broader market context, index trajectory, volume behaviour, and historical patterns, to distinguish genuine early conviction from noise.' },
              { num: '03', body: 'Signals that clear the threshold feed into an active pipeline. From there, the work shifts from data to relationships, converting market intelligence into active dealflow.' },
            ].map(({ num, body }) => (
              <div key={num} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.125rem', borderRadius: '0.75rem', border: `1px solid ${BORDER}`, backgroundColor: 'rgba(255,255,255,0.02)' }}>
                <span style={{ fontSize: '2.25rem', fontWeight: 300, color: WHITE, fontFamily: FONT, lineHeight: 1 }}>{num}</span>
                <p style={{ fontSize: '0.75rem', color: SEC, fontFamily: FONT, lineHeight: 1.7, margin: '0rem' }}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Enterprise API ── */}
      <section style={{ borderBottom: `1px solid ${BORDER}`, backgroundColor: BG }}>
        <div className="hiw-inner" style={{ paddingTop: '4rem', paddingBottom: '4rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '1.5rem', borderRadius: '1rem', border: `1px solid ${BORDER}`, backgroundColor: 'rgba(255,255,255,0.02)', position: 'relative', overflow: 'hidden' }}>
            <div aria-hidden style={{ position: 'absolute', inset: 0, backgroundImage: `linear-gradient(${BORDER} 1px, transparent 1px), linear-gradient(90deg, ${BORDER} 1px, transparent 1px)`, backgroundSize: '3rem 3rem', opacity: 0.3, zIndex: 0 }}/>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: SEC, fontFamily: FONT }}>ENTERPRISE API</span>
                <span style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '0.125rem 0.5rem', borderRadius: '0.25rem', color: SEC, border: `1px solid ${BORDER}`, fontFamily: FONT, backgroundColor: 'rgba(255,255,255,0.04)' }}>Coming soon</span>
              </div>
              <h2 className="hiw-h2" style={{ marginBottom: '0.75rem' }}>Programmatic access to Sonotrade&apos;s market data</h2>
              <p style={{ fontSize: '0.75rem', color: SEC, fontFamily: FONT, lineHeight: 1.7, margin: '0rem' }}>
                Direct API access to live artist indexes, historical positioning data, leaderboard flows, and aggregated conviction signals. Built for industry participants, research teams, and data-driven operators.
              </p>
            </div>
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {[
                { endpoint: 'GET /v1/indexes/:artist',     desc: 'Live artist index price' },
                { endpoint: 'GET /v1/leaderboard/flows',   desc: 'Top trader positioning data' },
                { endpoint: 'GET /v1/signals/conviction',  desc: 'Aggregated conviction signal' },
                { endpoint: 'GET /v1/artists/:id/history', desc: 'Historical index & volume' },
              ].map(row => (
                <div key={row.endpoint} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', paddingLeft: '0.875rem', paddingRight: '0.875rem', paddingTop: '0.625rem', paddingBottom: '0.625rem', borderRadius: '0.5rem', border: `1px solid ${BORDER}`, backgroundColor: 'rgba(10,10,10,0.8)', overflow: 'hidden' }}>
                  <code style={{ fontSize: '0.6875rem', color: WHITE, fontFamily: MONO, opacity: 0.85, flex: 1, minWidth: '0rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.endpoint}</code>
                  <span style={{ fontSize: '0.625rem', flexShrink: 0, color: SEC, fontFamily: FONT, paddingLeft: '0.5rem' }}>{row.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ borderTop: `1px solid ${BORDER}`, backgroundColor: BG, position: 'relative', overflow: 'hidden' }}>
        <MonogramBackground opacity={0.07}/>
        <div className="hiw-inner" style={{ paddingTop: '7.5rem', paddingBottom: '7.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '1.25rem', position: 'relative', zIndex: 1 }}>
          <h2 className="hiw-h1" style={{ maxWidth: '40rem', margin: '0rem' }}>The Market Infrastructure for Music. Now in beta.</h2>
          <p style={{ fontSize: '0.8125rem', color: SEC, fontFamily: FONT, lineHeight: 1.6, margin: '0rem' }}>Real data. Real positions. The first exchange for music derivatives.</p>
          <StartTradingButton style={{ marginTop: '0.5rem' }} />
        </div>
      </section>
    </div>
  )
}
