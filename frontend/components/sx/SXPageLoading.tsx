"use client"

import { SXGlyphDrawLoader, type SXGlyphDrawLoaderProps } from "./SXGlyphDrawLoader"
import { cn } from "./utils"

export type SXPageLoadingProps = SXGlyphDrawLoaderProps & {
  /** Applied to the outer flex wrapper (default: fill space below the fixed header). */
  minHeightClassName?: string
}

/**
 * Full-area centered loader: the self-drawing Sonotrade glyph.
 */
export function SXPageLoading({
  className,
  minHeightClassName = "min-h-[calc(100vh-69px)]",
  ...loaderProps
}: SXPageLoadingProps) {
  return (
    <div
      className={cn(
        "flex w-full flex-1 flex-col items-center justify-center",
        minHeightClassName,
        className,
      )}
    >
      <SXGlyphDrawLoader {...loaderProps} />
    </div>
  )
}
