'use client'

import { usePathname } from 'next/navigation'
import { useIsMobile } from '@/context/MobileContext'
import { Header } from '@/components/sx/SXHeader'
import { MobileHeader } from '@/components/mobile/MobileHeader'

export function AppHeader() {
  const isMobile = useIsMobile()
  const pathname = usePathname()

  // Auth + landing pages are full-screen and bring their own header (like /frontend) — no global header
  if (pathname === '/sign-in' || pathname === '/sign-up' || pathname === '/how-it-works') return null

  if (isMobile) {
    return <MobileHeader />
  }

  const borderedHeaderRoutes = ['/feed', '/leaderboard', '/profile']
  const bordered = borderedHeaderRoutes.some((r) => pathname === r || pathname.startsWith(`${r}/`))
  return <Header bordered={bordered} />
}
