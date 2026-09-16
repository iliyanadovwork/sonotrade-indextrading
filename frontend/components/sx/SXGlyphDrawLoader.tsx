"use client"

import * as React from "react"

import { cn } from "./utils"

export type SXGlyphDrawLoaderProps = {
  className?: string
  /** Width in CSS pixels; height follows the 1045:1572 glyph aspect ratio. Default 60. */
  width?: number
  /** Full loop duration in ms (draw → hold → fade → reset). Default 800. */
  cycleDurationMs?: number
  /** Accessible label for the loading indicator. */
  "aria-label"?: string
}

/** Outline of the Sonotrade glyph — shared by the clip layer and the invisible sizer. */
const GLYPH_PATH =
  "M 606.13,26.50 L 321.39,287.81 A 33.0 33.0 0 0 0 336.00,344.21 L 632.69,415.44 L 655.28,556.21 A 5.61 5.61 0 0 0 666.42,555.40 L 668.36,424.00 L 833.62,463.68 L 158.02,1322.00 A 5.61 5.61 0 0 0 166.61,1329.20 L 934.04,471.18 A 33.7 33.7 0 0 0 916.68,415.92 L 671.29,358.25 L 661.43,49.76 A 33.0 33.0 0 0 0 606.13,26.50 Z M599,113 L626,348 L406,295 Z"

/**
 * Self-drawing Sonotrade glyph loader.
 *
 * The "spike" strokes on first, then the "bar" draws across it — with an over/under
 * at the joint (a punch-out mask removes the spike where the bar crosses) — the whole
 * glyph holds, fades out, and the cycle repeats. Everything is clipped to the glyph
 * outline so the round-cap strokes read as the filled mark.
 *
 * Pure CSS animation; keyframes live in app/globals.css
 * (`sxGlyphDrawFade` / `sxGlyphDrawSpike` / `sxGlyphDrawBar`). Honors
 * `prefers-reduced-motion` (renders the completed glyph, no motion).
 *
 * This is an ALTERNATIVE to {@link SXGlyphLoader} (the dotted-ring rAF loader);
 * both coexist. Stroke color is `currentColor` (defaults to `text-st-white`).
 */
export function SXGlyphDrawLoader({
  className,
  width = 60,
  cycleDurationMs = 800,
  "aria-label": ariaLabel = "Loading",
}: SXGlyphDrawLoaderProps) {
  // Namespace the clip/mask ids per instance so multiple loaders don't collide.
  // (useId() can contain ":", which is unsafe inside url(#…) references — strip it.)
  const uid = React.useId().replace(/:/g, "")
  const clipId = `sxdraw-clip-${uid}`
  const maskId = `sxdraw-mask-${uid}`

  const style = {
    width,
    aspectRatio: "1045 / 1572",
    "--sx-glyph-draw-dur": `${cycleDurationMs}ms`,
  } as React.CSSProperties

  return (
    <div
      className={cn("text-st-white", className)}
      style={style}
      role="status"
      aria-label={ariaLabel}
    >
      <svg
        viewBox="27 -112 1045 1572"
        width="100%"
        height="100%"
        style={{ display: "block", overflow: "visible" }}
        aria-hidden
      >
        <defs>
          <clipPath id={clipId}>
            <path d={GLYPH_PATH} clipRule="evenodd" />
          </clipPath>
          {/* Punches the gap in the spike where the bar crosses the joint (over/under). */}
          <mask
            id={maskId}
            maskUnits="userSpaceOnUse"
            x="27"
            y="-112"
            width="1045"
            height="1572"
          >
            <rect x="27" y="-112" width="1045" height="1572" fill="white" />
            <path
              d="M 580.0,368.9 L 653,386 L 725.8,404.1"
              fill="none"
              stroke="black"
              strokeWidth="70"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </mask>
        </defs>
        <g className="sx-glyph-draw__glyph" clipPath={`url(#${clipId})`}>
          {/* Invisible sizer: geometry anchors a stable bounding box for the
              clipped layer. fill-opacity 0 (not 0.01) so it leaves no faint
              ghost of the glyph over the background. */}
          <path
            d={GLYPH_PATH}
            fillRule="evenodd"
            style={{ fill: "none", fillOpacity: 0 }}
          />
          {/* Spike behind (gap punched at the joint) + bar in front = over/under. */}
          {/* Base state inlined as attributes (not just the CSS class) so the
              paths are stroked + fully offset (hidden) from the first paint —
              prevents a one-frame flash of the solid default-filled glyph
              before globals.css / the keyframes apply on mount. */}
          {/* Spike start extended ~45u past the needle tip (660,561 -> 661.8,606)
              so the round cap clips away below the artwork point and the draw
              emerges THROUGH the tip via the leading edge, instead of the
              trailing cap popping in above it. Dash length grows 911 -> 956. */}
          <path
            className="sx-glyph-draw__stroke sx-glyph-draw__spike"
            d="M 661.8,606 L 653,386 L 627,44 L 341,313"
            mask={`url(#${maskId})`}
            fill="none"
            stroke="currentColor"
            strokeWidth={74}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="956 100000"
            strokeDashoffset={956}
          />
          {/* Bar elbow vertex nudged 902,448 -> 888,452 so the stroke's inner
              corner aligns with the glyph clip's tail edge; otherwise their
              slightly-different angles leave a thin clipped notch at the bend.
              The "7" tip is defined by the clip, so this doesn't change it. */}
          <path
            className="sx-glyph-draw__stroke sx-glyph-draw__bar"
            d="M 341,313 L 653,386 L 888,452 L 165,1328"
            fill="none"
            stroke="currentColor"
            strokeWidth={74}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="1725 100000"
            strokeDashoffset={1725}
          />
        </g>
      </svg>
    </div>
  )
}
