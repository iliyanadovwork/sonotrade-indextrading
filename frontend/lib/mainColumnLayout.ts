import type { CSSProperties } from 'react'

/**
 * Width of the centered feed / profile / leaderboard column (px).
 * Keep sidebar `right` calc in sync via {@link mainColumnAsideRightStyle}.
 */
export const MAIN_COLUMN_WIDTH_PX = 612

export const mainColumnWidthStyle: CSSProperties = {
  width: MAIN_COLUMN_WIDTH_PX,
  minWidth: MAIN_COLUMN_WIDTH_PX,
}

/**
 * The feed column runs wider than the identity pages — social content reads
 * cramped at 612px. min() keeps it from overflowing narrow viewports.
 */
export const FEED_COLUMN_WIDTH_PX = 800

export const feedColumnWidthStyle: CSSProperties = {
  width: `min(${FEED_COLUMN_WIDTH_PX}px, 100vw)`,
  minWidth: 0,
}

export function mainColumnAsideRightStyle(): CSSProperties {
  return {
    position: 'sticky',
    top: '4.3125rem',
    alignSelf: 'flex-start',
  }
}
