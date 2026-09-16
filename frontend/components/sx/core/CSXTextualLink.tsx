'use client'

import * as React from "react"
import Link from "next/link"
import { resolveSXColor, type SXColorToken } from "./sx-color-tokens"
import { CSXText, type CSXTextVariant } from "./CSXText"
import { cn } from "../utils"

export type CSXTextualLinkProps = Omit<React.ComponentProps<typeof Link>, "className"> & {
  variant: CSXTextVariant
  /** Rest state text color (design token → theme CSS variable). */
  color: SXColorToken
  /**
   * Optional hover / keyboard-focus color. When omitted, the link brightens
   * toward white from `color` so clickable copy always has a visible affordance.
   */
  hoverColor?: SXColorToken
  className?: string
}

export type { SXColorToken } from "./sx-color-tokens"

/** Mix rest color toward white — same idea as a normal link brighten. */
export function brightenTowardWhite(restCss: string): string {
  return `color-mix(in srgb, ${restCss} 48%, #ffffff)`
}

export function CSXTextualLink({
  variant,
  children,
  className,
  color,
  hoverColor,
  style,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  ...linkProps
}: CSXTextualLinkProps) {
  const [hovered, setHovered] = React.useState(false)
  const [focused, setFocused] = React.useState(false)
  const active = hovered || focused

  const rest = resolveSXColor(color)
  const resolvedColor = active
    ? hoverColor
      ? resolveSXColor(hoverColor)
      : brightenTowardWhite(rest)
    : rest

  return (
    <Link
      className={cn("no-underline transition-colors duration-150", className)}
      style={{
        color: resolvedColor,
        ...style,
      }}
      onMouseEnter={(e) => {
        setHovered(true)
        onMouseEnter?.(e)
      }}
      onMouseLeave={(e) => {
        setHovered(false)
        onMouseLeave?.(e)
      }}
      onFocus={(e) => {
        setFocused(true)
        onFocus?.(e)
      }}
      onBlur={(e) => {
        setFocused(false)
        onBlur?.(e)
      }}
      {...linkProps}
    >
      <CSXText variant={variant} color={resolvedColor}>
        {children}
      </CSXText>
    </Link>
  )
}
