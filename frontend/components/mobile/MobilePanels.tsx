'use client'

import { useIsMobile } from '@/context/MobileContext'
import { MobileProfilePanel } from './MobileProfilePanel'
import { MobilePortfolioPanel } from './MobilePortfolioPanel'

export function MobilePanels() {
  const isMobile = useIsMobile()
  if (!isMobile) return null
  return (
    <>
      <MobileProfilePanel />
      <MobilePortfolioPanel />
    </>
  )
}
