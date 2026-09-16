/**
 * Sonotrade design tokens — CSS vars live in `frontend/app/globals.css` (`--st-*`).
 * Use `SXColorToken` with `CSXText` / `CSXTextualLink` `color` props, or Tailwind
 * `text-st-*` / `bg-st-*` / `border-st-*` for non-CSX surfaces.
 */

export const SX_COLOR_CSS_VARS = {
  STWhite: "--st-white",
  STBlack: "--st-black",
  STSecondary: "--st-secondary",
  STMuted: "--st-muted",
  STForeground: "--st-foreground",
  STPositive: "--st-positive",
  STChartPositive: "--st-chart-positive",
  STChartNegative: "--st-chart-negative",
  STWhiteMuted: "--st-white-muted",
  STBorder: "--st-border",
  STBorderStrong: "--st-border-strong",
  STSurfaceRaised: "--st-surface-raised",
  STWhiteOverlay12: "--st-white-overlay-12",
} as const

export type SXColorToken = keyof typeof SX_COLOR_CSS_VARS

const TOKEN_SET = new Set<string>(Object.keys(SX_COLOR_CSS_VARS))

export function isSXColorToken(value: string): value is SXColorToken {
  return TOKEN_SET.has(value)
}

/** Maps tokens to theme CSS variables; passes other strings through unchanged. */
function cssVar(name: string): string {
  return "var(" + name + ")"
}

export function resolveSXColor(color: SXColorToken | string): string {
  if (isSXColorToken(color)) {
    return cssVar(SX_COLOR_CSS_VARS[color])
  }
  return color
}
