import * as React from "react"
import { type SXColorToken, resolveSXColor } from "./sx-color-tokens"

export type { SXColorToken } from "./sx-color-tokens"

export type CSXTextVariant =
  | "wordmark"
  | "title"
  | "subtitle"
  | "subtitle2"
  | "body1"
  | "body2"
  | "body2Medium"
  | "body2Semibold"
  | "body2Button"
  | "body2MediumButton"
  | "body3"
  | "body3Button"
  | "cardPrice"
  | "cardPriceChange"
  | "chipLabel"
  | "chipLabelNormal"
  /** Tight micro label for CSXInfoChip position pills (leading-none for vertical centering). */
  | "chipLabelPill"
  | "spaced"
  /** Animated / hero numeric price row (28px semibold; inline fontSize can override) */
  | "chartAnimatedPrice"

/**
 * Letter-spacing (em): wordmark -0.05 | title/subtitle/body* -0.025 | spaced +0.06 | chipLabel +0.08 | chipLabelNormal +0.01
 * Positive scale also includes +0.04 as a valid step (see spaced history).
 *
 * wordmark = brand (h2). title = primary display 1.5rem (span). subtitle = text-md (Featured heading + card names).
 * body2* = sm UI weights. body2Button / body2MediumButton / body3Button = pill-button labels: snug leading + 1px translateY; body3Button = compact outline `CSXButton` (xs).
 * cardPrice / cardPriceChange = featured card index row (large $ + 12px delta).
 * chartAnimatedPrice = rolling / hero price (SXPriceChartWidget AnimatedPrice + digit cells).
 * chipLabel = uppercase micro label (Beta chip). chipLabelNormal = same size, casing as authored (artist card chips).
 *
 * EDGE_RESET = margin + text-indent zero on every variant. All variants use p-0 (chip padding lives on CSXInfoChip).
 */
const EDGE_RESET = "m-0 indent-0"
const BOX_RESET = `${EDGE_RESET} p-0`

const VARIANT_STYLES: Record<CSXTextVariant, string> = {
  wordmark:
    `${BOX_RESET} text-[1.5rem] font-normal leading-normal tracking-[-0.05em] select-none`,
  title:
    `${BOX_RESET} text-[1.25rem] font-normal leading-normal tracking-[-0.025em] select-none`,
  subtitle:
    `${BOX_RESET} text-md font-normal leading-normal tracking-[-0.025em] select-none`,
    subtitle2:
    `${BOX_RESET} text-sm font-normal leading-normal tracking-[-0.025em] select-none`,
  body1: `${BOX_RESET} text-sm font-normal leading-normal`,
  body2: `${BOX_RESET} text-xs font-normal leading-normal tracking-[-0.025em]`,
  body2Medium: `${BOX_RESET} text-sm font-medium leading-normal tracking-[-0.025em]`,
  body2Semibold: `${BOX_RESET} text-sm font-semibold leading-normal tracking-[-0.025em]`,
  body2Button: `${BOX_RESET} inline-flex items-center text-sm font-normal leading-snug tracking-[-0.025em]`,
  body2MediumButton: `${BOX_RESET} inline-flex items-center text-sm font-medium leading-snug tracking-[-0.025em]`,
  body3: `${BOX_RESET} text-xs font-normal leading-normal`,
  body3Button: `${BOX_RESET} inline-flex items-center text-xs font-normal leading-snug tracking-[-0.025em]`,
  cardPrice: `${BOX_RESET} text-[18px] font-semibold leading-none tracking-[-0.02em]`,
  cardPriceChange: `${BOX_RESET} text-xs font-medium leading-none tracking-[-0.025em]`,
  chipLabel: `${BOX_RESET} text-[0.625rem] font-semibold uppercase leading-normal tracking-[0.08em]`,
  chipLabelNormal: `${BOX_RESET} text-[0.625rem] font-medium leading-normal tracking-[0.01em]`,
  chipLabelPill: `${BOX_RESET} text-[0.625rem] font-medium leading-none tracking-[0.01em]`,
  spaced: `${BOX_RESET} text-[10px] font-normal uppercase leading-normal tracking-[0.06em]`,
  chartAnimatedPrice: `${BOX_RESET} text-[28px] font-semibold leading-none tracking-[-0.02em]`,
}

const VARIANT_TAG: Record<CSXTextVariant, "h2" | "span"> = {
  wordmark: "h2",
  title: "span",
  subtitle: "span",
  subtitle2: "span",

  body1: "span",
  body2: "span",
  body2Medium: "span",
  body2Semibold: "span",
  body2Button: "span",
  body2MediumButton: "span",
  body3: "span",
  body3Button: "span",
  cardPrice: "span",
  cardPriceChange: "span",
  chipLabel: "span",
  chipLabelNormal: "span",
  chipLabelPill: "span",
  spaced: "span",
  chartAnimatedPrice: "span",
}

export type CSXTextProps = {
  variant: CSXTextVariant
  color?: SXColorToken | string
  children?: React.ReactNode
} & Omit<
  React.HTMLAttributes<HTMLElement>,
  "color" | "className" | "style" | "children"
>

export function CSXText({ variant, color, children, ...rest }: CSXTextProps) {
  const Tag = VARIANT_TAG[variant]

  return (
    <Tag
      className={"font-sans " + VARIANT_STYLES[variant]}
      style={{ ...(color ? { color: resolveSXColor(color) } : {}) }}
      {...rest}
    >
      {children}
    </Tag>
  )
}

/** Tailwind class string for a variant (e.g. AnimatedPrice digit cells outside CSXText). */
export function csxTextVariantClass(variant: CSXTextVariant): string {
  return "font-sans " + VARIANT_STYLES[variant]
}
