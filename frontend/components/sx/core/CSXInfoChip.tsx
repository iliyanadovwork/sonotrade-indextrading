import * as React from "react"
import { CSXText } from "./CSXText"
import { cn } from "../utils"

export type CSXInfoChipVariant =
  | "beta"
  | "artistCard"
  /** Long side: green tint, flex-centered for CSXText chipLabelPill */
  | "positionLong"
  /** Short side: red tint */
  | "positionShort"
  /** Liquidated / warning tint (e.g. orange) */
  | "positionWarning"

const VARIANT_WRAPPER: Record<CSXInfoChipVariant, string> = {
  beta: "mt-px inline-flex items-center rounded-full bg-st-white-overlay-12 px-[0.22em] px-1.5 py-[0.1em]",
  artistCard: "inline-flex items-center rounded-full bg-white px-1.5 py-0.5",
  positionLong:
    "inline-flex shrink-0 items-center justify-center rounded-full bg-st-chart-positive/15 px-1.5 pb-0.5 pt-[0.1875rem]",
  positionShort:
    "inline-flex shrink-0 items-center justify-center rounded-full bg-st-chart-negative/15 px-1.5 pb-0.5 pt-[0.1875rem]",
  positionWarning:
    "inline-flex shrink-0 items-center justify-center rounded-full bg-orange-500/15 px-1.5 pb-0.5 pt-[0.1875rem]",
}

export type CSXInfoChipProps = {
  variant: CSXInfoChipVariant
  className?: string
  children?: React.ReactNode
}

export function CSXInfoChip({ variant, className, children }: CSXInfoChipProps) {
  return (
    <span className={cn(VARIANT_WRAPPER[variant], className)}>{children}</span>
  )
}

/** Long or SHORT label inside positionLong / positionShort chip shell. */
export function CSXPositionSideChip({
  side,
  className,
}: {
  side: "long" | "short"
  className?: string
}) {
  const isLong = side === "long"
  return (
    <CSXInfoChip variant={isLong ? "positionLong" : "positionShort"} className={className}>
      <CSXText variant="chipLabelPill" color={isLong ? "STChartPositive" : "STChartNegative"}>
        {side.toUpperCase()}
      </CSXText>
    </CSXInfoChip>
  )
}

export function CSXLiquidatedChip({ className }: { className?: string }) {
  return (
    <CSXInfoChip variant="positionWarning" className={className}>
      <CSXText variant="chipLabelPill" color="rgb(251, 146, 60)">
        LIQUIDATED
      </CSXText>
    </CSXInfoChip>
  )
}
