'use client'

import React from 'react'

const RADAR_CX = 230
const RADAR_CY = 230
const RADAR_MAX_R = 170
const RADAR_AXES = ['STREAMING', 'POSITIONING', 'CONVICTION', 'MOMENTUM', 'VOLUME', 'SIGNAL']
const RADAR_ANGLES = Array.from({ length: 6 }, (_, i) => -Math.PI / 2 + i * (Math.PI / 3))
const RADAR_VALS_1 = [0.82, 0.88, 0.72, 0.85, 0.65, 0.90]
const RADAR_VALS_2 = [0.75, 0.92, 0.80, 0.78, 0.88, 0.70]
const RADAR_VALS_DIM = [0.40, 0.50, 0.45, 0.55, 0.35, 0.48]

function radarPoly(vals: number[]): string {
  return vals.map((v, i) => [
    (RADAR_CX + v * RADAR_MAX_R * Math.cos(RADAR_ANGLES[i])).toFixed(1),
    (RADAR_CY + v * RADAR_MAX_R * Math.sin(RADAR_ANGLES[i])).toFixed(1),
  ].join(',')).join(' ')
}

const RADAR_DIM    = radarPoly(RADAR_VALS_DIM)
const RADAR_STATE1 = radarPoly(RADAR_VALS_1)
const RADAR_STATE2 = radarPoly(RADAR_VALS_2)

const RADAR_VERTS1 = RADAR_VALS_1.map((v, i) => ({
  x: RADAR_CX + v * RADAR_MAX_R * Math.cos(RADAR_ANGLES[i]),
  y: RADAR_CY + v * RADAR_MAX_R * Math.sin(RADAR_ANGLES[i]),
}))
const RADAR_VERTS2 = RADAR_VALS_2.map((v, i) => ({
  x: RADAR_CX + v * RADAR_MAX_R * Math.cos(RADAR_ANGLES[i]),
  y: RADAR_CY + v * RADAR_MAX_R * Math.sin(RADAR_ANGLES[i]),
}))

const RADAR_LABEL_R = RADAR_MAX_R + 22
const RADAR_LABELS: { label: string; x: string; y: string; anchor: 'middle' | 'start' | 'end' }[] =
  RADAR_AXES.map((label, i) => {
    const cos = Math.cos(RADAR_ANGLES[i])
    return {
      label,
      x: (RADAR_CX + RADAR_LABEL_R * cos).toFixed(1),
      y: (RADAR_CY + RADAR_LABEL_R * Math.sin(RADAR_ANGLES[i])).toFixed(1),
      anchor: (Math.abs(cos) < 0.15 ? 'middle' : cos > 0 ? 'start' : 'end') as 'middle' | 'start' | 'end',
    }
  })

const INNER_SCALES = [0.33, 0.66]

export const SXRadarGraphic = React.memo(function SXRadarGraphic() {
  return (
    <svg width={414} height={414} viewBox="0 0 460 460" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <radialGradient id="rgCenterGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="white" stopOpacity="0.10" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
      </defs>

      {INNER_SCALES.map((scale) => {
        const s1 = radarPoly(RADAR_VALS_1.map(v => v * scale))
        const s2 = radarPoly(RADAR_VALS_2.map(v => v * scale))
        return (
          <polygon key={scale} fill="none" stroke="var(--st-border)" strokeWidth="1.4" opacity="0.3">
            <animate attributeName="points"
              values={`${s1};${s2};${s1}`}
              dur="7s" repeatCount="indefinite"
              calcMode="spline" keyTimes="0;0.5;1"
              keySplines="0.45 0 0.55 1;0.45 0 0.55 1"
            />
          </polygon>
        )
      })}

      {RADAR_VERTS1.map((v1, i) => {
        const v2 = RADAR_VERTS2[i]
        return (
          <line key={RADAR_AXES[i]} x1={RADAR_CX} y1={RADAR_CY} strokeWidth="1.4" stroke="var(--st-border)" opacity="0.5">
            <animate attributeName="x2"
              values={`${v1.x.toFixed(1)};${v2.x.toFixed(1)};${v1.x.toFixed(1)}`}
              dur="7s" repeatCount="indefinite"
              calcMode="spline" keyTimes="0;0.5;1"
              keySplines="0.45 0 0.55 1;0.45 0 0.55 1"
            />
            <animate attributeName="y2"
              values={`${v1.y.toFixed(1)};${v2.y.toFixed(1)};${v1.y.toFixed(1)}`}
              dur="7s" repeatCount="indefinite"
              calcMode="spline" keyTimes="0;0.5;1"
              keySplines="0.45 0 0.55 1;0.45 0 0.55 1"
            />
          </line>
        )
      })}

      <polygon points={RADAR_DIM}
        fill="rgba(255,255,255,0.025)"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="1"
      />

      <polygon fill="rgba(255,255,255,0.05)" stroke="var(--st-border)" strokeWidth="1.4" strokeLinejoin="round">
        <animate attributeName="points"
          values={`${RADAR_STATE1};${RADAR_STATE2};${RADAR_STATE1}`}
          dur="7s" repeatCount="indefinite"
          calcMode="spline" keyTimes="0;0.5;1"
          keySplines="0.45 0 0.55 1;0.45 0 0.55 1"
        />
        <animate attributeName="opacity" values="0.82;1;0.82" dur="7s" repeatCount="indefinite" />
      </polygon>

      <circle cx={RADAR_CX} cy={RADAR_CY} r={70} fill="url(#rgCenterGlow)" />

      {RADAR_VERTS1.map((v1, i) => {
        const v2 = RADAR_VERTS2[i]
        return (
          <circle key={RADAR_AXES[i]} r="2.5" fill="white" opacity="0.75">
            <animate attributeName="cx"
              values={`${v1.x.toFixed(1)};${v2.x.toFixed(1)};${v1.x.toFixed(1)}`}
              dur="7s" repeatCount="indefinite"
              calcMode="spline" keyTimes="0;0.5;1"
              keySplines="0.45 0 0.55 1;0.45 0 0.55 1"
            />
            <animate attributeName="cy"
              values={`${v1.y.toFixed(1)};${v2.y.toFixed(1)};${v1.y.toFixed(1)}`}
              dur="7s" repeatCount="indefinite"
              calcMode="spline" keyTimes="0;0.5;1"
              keySplines="0.45 0 0.55 1;0.45 0 0.55 1"
            />
            <animate attributeName="opacity" values="0.65;0.95;0.65" dur="7s" repeatCount="indefinite" />
          </circle>
        )
      })}

      <circle cx={RADAR_CX} cy={RADAR_CY} r="3.5" fill="white">
        <animate attributeName="r" values="2.5;4;2.5" dur="3s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.65;1;0.65" dur="3s" repeatCount="indefinite" />
      </circle>

      {RADAR_LABELS.map(({ label, x, y, anchor }) => (
        <text key={label}
          x={x} y={y}
          textAnchor={anchor} dominantBaseline="middle"
          fontSize="8" fontFamily="var(--font-inter)"
          fill="white" opacity="0.45" letterSpacing="0.06em"
        >
          {label}
        </text>
      ))}
    </svg>
  )
})
