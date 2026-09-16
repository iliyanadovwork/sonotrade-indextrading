'use client'

import * as React from 'react'
import { CSXText } from './core/CSXText'
import { cn } from './utils'

export type SXSectionHeadingProps = {
  title: React.ReactNode
  subtitle?: React.ReactNode
  subtitleUnstyled?: boolean
  as?: 'h1' | 'h2'
  className?: string
}

export function SXSectionHeading({
  title,
  subtitle,
  subtitleUnstyled = false,
  as: TitleTag = 'h2',
  className,
}: SXSectionHeadingProps) {
  return (
    <div className={cn('flex flex-col gap-0.5 pb-4', className)}>
      <TitleTag className="m-0 flex items-center gap-1.5 p-0">
        <CSXText variant="subtitle" color="STWhite">
          {title}
        </CSXText>
      </TitleTag>
      {subtitle != null &&
        (subtitleUnstyled ? (
          <div className="min-w-0">{subtitle}</div>
        ) : (
          <CSXText variant="body2" color="STSecondary">
            {subtitle}
          </CSXText>
        ))}
    </div>
  )
}
