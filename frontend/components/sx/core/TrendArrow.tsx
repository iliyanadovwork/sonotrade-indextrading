import * as React from "react"

export type TrendArrowProps = {
  /** Points up in the positive color when true; rotated 180° in the negative color when false. */
  positive: boolean
  /** Square width/height in px. */
  size?: number
  /** Apply the 1px optical translateY nudge (in the rotated frame, matching the original copies). */
  nudge?: boolean
  /** Extra inline styles merged over the computed ones (e.g. alignSelf, marginTop). */
  style?: React.CSSProperties
}

/** Small triangular trend indicator shared by the discover/featured/sidebar surfaces. */
export function TrendArrow({ positive, size = 12, nudge = true, style }: TrendArrowProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 18"
      width={size}
      height={size}
      className="shrink-0"
      style={{
        color: positive ? "var(--st-positive)" : "var(--st-chart-negative)",
        transform: `rotate(${positive ? "0deg" : "180deg"})${nudge ? " translateY(1px)" : ""}`,
        ...style,
      }}
    >
      <path fill="currentColor" d="m12 0 10.392 14.25H1.608z" />
    </svg>
  )
}
