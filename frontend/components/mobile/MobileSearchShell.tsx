'use client'

import { usePathname } from 'next/navigation'
import { MobileBottomNav } from './MobileBottomNav'
import { SearchDrawer } from './SearchDrawer'
import { useSearchDrawer } from '@/context/SearchDrawerContext'
import { useIsMobile } from '@/context/MobileContext'

export function MobileSearchShell() {
  const isMobile = useIsMobile()
  const pathname = usePathname()
  const { isOpen, initialCategory, openSearch, closeSearch } = useSearchDrawer()

  if (!isMobile) return null

  // Full-screen landing / auth pages bring their own chrome — no exchange bottom nav
  if (pathname === '/how-it-works' || pathname === '/sign-in' || pathname === '/sign-up') return null

  return (
    <>
      <MobileBottomNav onSearchOpen={() => openSearch()} />
      <SearchDrawer isOpen={isOpen} onClose={closeSearch} initialCategory={initialCategory} />
    </>
  )
}
