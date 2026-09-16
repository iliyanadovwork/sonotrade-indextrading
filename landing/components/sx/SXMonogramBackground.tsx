'use client'

import React from 'react'

const MONOGRAM_LOGO_SIZE = 24
const MONOGRAM_COL_GAP = 55
const MONOGRAM_ROW_GAP = 48
const MONOGRAM_COLS = Math.ceil(3600 / MONOGRAM_COL_GAP) + 4
const MONOGRAM_ROWS = Math.ceil(1200 / MONOGRAM_ROW_GAP) + 4

const MONOGRAM_LOGOS: { x: number; y: number }[] = (() => {
  const logos: { x: number; y: number }[] = []
  for (let row = 0; row < MONOGRAM_ROWS; row++) {
    for (let col = 0; col < MONOGRAM_COLS; col++) {
      const xOffset = row % 2 === 1 ? MONOGRAM_COL_GAP / 2 : 0
      logos.push({
        x: col * MONOGRAM_COL_GAP + xOffset - MONOGRAM_COL_GAP * 2,
        y: row * MONOGRAM_ROW_GAP - MONOGRAM_ROW_GAP * 2,
      })
    }
  }
  return logos
})()

interface SXMonogramBackgroundProps {
  opacity?: number
  noMask?: boolean
  fixed?: boolean
}

export const SXMonogramBackground = React.memo(function SXMonogramBackground({
  opacity: logoOpacity = 0.22,
  noMask = false,
  fixed = false,
}: SXMonogramBackgroundProps) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: fixed ? 'fixed' : 'absolute',
        inset: 0,
        overflow: 'hidden',
        zIndex: fixed ? 0 : undefined,
        maskImage: noMask ? undefined : 'radial-gradient(ellipse 70% 70% at 50% 50%, black 20%, transparent 100%)',
        WebkitMaskImage: noMask ? undefined : 'radial-gradient(ellipse 70% 70% at 50% 50%, black 20%, transparent 100%)',
      }}
    >
      {MONOGRAM_LOGOS.map((pos) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${pos.x},${pos.y}`}
          src="/st-glyph.png"
          alt=""
          style={{
            position: 'absolute',
            left: pos.x,
            top: pos.y,
            width: MONOGRAM_LOGO_SIZE,
            height: MONOGRAM_LOGO_SIZE,
            opacity: logoOpacity,
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        />
      ))}
    </div>
  )
})
