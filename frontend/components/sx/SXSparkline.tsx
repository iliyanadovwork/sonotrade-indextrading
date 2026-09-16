import React, { memo } from 'react'

interface SXSparklineProps {
  data?: Array<{ value: number; timestamp?: number }>
  /** Override color direction. If omitted, derived from first vs last value. */
  positive?: boolean
  className?: string
  style?: React.CSSProperties
}

// Pure SVG sparkline — stepwise (H then V), matching SXPriceChart exactly.
// Uses equal spacing so the "now" point appended by callers is always one
// visible step to the right of the last real data point, reaching x=W.
export const SXSparkline = memo(function SXSparkline({
  data = [],
  positive,
  className = '',
  style,
}: SXSparklineProps) {
  const W = 96
  const H = 32
  const pad = 2

  // A single point becomes two identical ones so paddedData.length >= 2 always.
  const paddedData = data.length === 1 ? [data[0]!, { ...data[0]! }] : data

  if (paddedData.length < 2) {
    return <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} className={className} style={style} />
  }

  const values = paddedData.map(d => d.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min

  // Equal spacing so the "now" point (last in the array, appended by callers) is
  // always visible at x=W regardless of how recent the last real trade was.
  const pts = paddedData.map((d, i) => ({
    x: (i / (paddedData.length - 1)) * W,
    y: range === 0 ? H / 2 : pad + (1 - (d.value - min) / range) * (H - pad * 2),
  }))

  let d = `M${pts[0]!.x.toFixed(1)},${pts[0]!.y.toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p2 = pts[i + 1]!
    d += ` H${p2.x.toFixed(1)} V${p2.y.toFixed(1)}`
  }

  const isPositive = positive !== undefined ? positive : values[values.length - 1]! >= values[0]!
  const color = isPositive ? '#04df9d' : '#FF4B4B'

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      width="100%"
      height="100%"
      className={className}
      style={{ display: 'block', overflow: 'visible', ...style }}
    >
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="square"
        strokeLinejoin="miter"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
})
