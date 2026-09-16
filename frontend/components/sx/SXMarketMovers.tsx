'use client'

import { SXSidebarProfileList } from './SXSidebarProfileList'

interface SXMarketMoversProps {
  noMarginTop?: boolean
  displayCount?: number
}

export function SXMarketMovers({ noMarginTop = false, displayCount = 5 }: SXMarketMoversProps) {
  return (
    <SXSidebarProfileList
      title="Highest volume"
      subtitle="Last 24 hours"
      sortBy="volume"
      sortDir="desc"
      fetchLimit={displayCount > 5 ? displayCount * 2 : 15}
      className={noMarginTop ? '' : 'mt-6'}
      displayCount={displayCount}
    />
  )
}
