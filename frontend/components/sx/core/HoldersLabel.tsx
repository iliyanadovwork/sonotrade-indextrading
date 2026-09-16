/**
 * Holder count as it appears on a grid card — shared by the desktop
 * (SXDiscoverGrid) and mobile (MobileTradeList) cards so the two layouts stay
 * identical.
 */

/**
 * Compact holder count. Abbreviated rather than the full toLocaleString the
 * featured cards use — a discover card is a fraction of that width and shares
 * its row with the volume.
 */
export function formatGridHolders(value: number | null | undefined): string {
  if (value == null) return '0 holders'
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M holders`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K holders`
  return `${value} ${value === 1 ? 'holder' : 'holders'}`
}

/** Same glyph as the featured cards' holders pill. */
export function HoldersIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}
