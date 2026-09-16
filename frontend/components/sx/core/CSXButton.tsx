import * as React from "react"
import {
  CSXText,
  type CSXTextProps,
  type CSXTextVariant,
} from "./CSXText"

export type CSXButtonVariant = "outline" | "primary" | "translucent"

export type CSXButtonSize = "default" | "compact"

/** Shared chrome per variant (borders, hover, motion). Padding comes from `SIZE_PAD`. */
const CHROME: Record<CSXButtonVariant, string> = {
  outline:
    "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-st-border bg-transparent transition-all duration-75 hover:border-st-border-strong active:scale-90 disabled:pointer-events-none disabled:opacity-50",
  primary:
    "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-st-black bg-st-white transition-all duration-75 hover:opacity-90 active:scale-90 disabled:pointer-events-none disabled:opacity-50",
  translucent:
    "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full transition-all duration-75 hover:opacity-80 active:scale-90 disabled:pointer-events-none disabled:opacity-50",
}

const SIZE_PAD: Record<CSXButtonSize, string> = {
  default: "px-4 py-[0.4375rem]",
  compact: "px-3 py-[0.3125rem]",
}

const DEFAULT_TEXT: Record<
  CSXButtonVariant,
  { variant: CSXTextVariant; color?: CSXTextProps["color"] }
> = {
  outline: { variant: "body2Button", color: "STWhite" },
  primary: { variant: "body2MediumButton", color: "STForeground" },
  translucent: { variant: "body2Button", color: "STWhite" },
}

const TRANSLUCENT_STYLE: React.CSSProperties = {
  border: '1px solid rgba(255,255,255,0.25)',
  background: 'rgba(255,255,255,0.04)',
}

function defaultTextVariant(
  variant: CSXButtonVariant,
  size: CSXButtonSize
): CSXTextVariant {
  if (size === "compact" && (variant === "outline" || variant === "translucent")) {
    return "body3Button"
  }
  return DEFAULT_TEXT[variant].variant
}

export type CSXButtonProps = Omit<
  React.ComponentPropsWithoutRef<"button">,
  "children" | "className"
> & {
  variant: CSXButtonVariant
  label: string
  /** `compact` = tighter padding; outline uses `body3Button` so type scales with the control. Same border tokens as default outline. */
  size?: CSXButtonSize
  /** Overrides default text variant for this variant/size. */
  textVariant?: CSXTextVariant
  /** Default: `STWhite` on outline; `STForeground` on primary. */
  textColor?: CSXTextProps["color"]
  /** Forwards to inner `CSXText` (e.g. `id`, `title`, `aria-*`). */
  labelProps?: Omit<CSXTextProps, "children" | "variant" | "color">
}

export const CSXButton = React.forwardRef<HTMLButtonElement, CSXButtonProps>(
  function CSXButton(
    {
      variant,
      label,
      size = "default",
      textVariant,
      textColor,
      labelProps,
      type = "button",
      ...rest
    },
    ref
  ) {
    const def = DEFAULT_TEXT[variant]
    const tv = textVariant ?? defaultTextVariant(variant, size)
    const tc = textColor !== undefined ? textColor : def.color
    const shell = CHROME[variant] + " " + SIZE_PAD[size]
    const variantStyle = variant === "translucent" ? TRANSLUCENT_STYLE : undefined
    return (
      <button
        ref={ref}
        type={type}
        className={shell}
        style={variantStyle}
        {...rest}
      >
        <CSXText variant={tv} color={tc} {...labelProps}>
          {label}
        </CSXText>
      </button>
    )
  }
)
