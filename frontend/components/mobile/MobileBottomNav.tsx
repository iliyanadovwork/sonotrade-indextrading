'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import { usePortfolioPanel } from '@/context/PortfolioPanelContext'
import { MobileMorePanel } from './MobileMorePanel'

const NAV_ITEMS = [
  {
    key: 'trade',
    href: '/',
    label: 'Trade',
    icon: (active: boolean) => (
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.75} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
        <polyline points="16 7 22 7 22 13" />
      </svg>
    ),
  },
  {
    key: 'search',
    href: null,
    label: 'Search',
    icon: (active: boolean) => (
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.75} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
  {
    key: 'portfolio',
    href: null,
    label: 'Portfolio',
    icon: (active: boolean) => (
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.75} strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    key: 'more',
    href: '/more',
    label: 'More',
    icon: (active: boolean) => (
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.75} strokeLinecap="round" strokeLinejoin="round">
        <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
      </svg>
    ),
  },
]

const itemStyle = (active: boolean): React.CSSProperties => ({
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.1875rem',
  minWidth: '4rem', color: active ? '#fff' : '#52525b',
  textDecoration: 'none', transition: 'color 150ms',
  background: 'none', border: 'none', cursor: 'pointer', padding: '0rem',
  fontFamily: 'inherit',
})

export function MobileBottomNav({ onSearchOpen }: { onSearchOpen?: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const { openPortfolio } = usePortfolioPanel()
  const [moreOpen, setMoreOpen] = useState(false)

  const goSignIn = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('auth', 'signin')
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const handlePortfolioClick = () => {
    if (user) {
      openPortfolio()
    } else {
      goSignIn()
    }
  }

  return (
    <>
      <nav
        aria-label="Main navigation"
        className="fixed bottom-0 inset-x-0 z-[1000] border-t border-[#1a1a1a] bg-[rgb(10,10,10)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)', transform: 'translateZ(0)', WebkitTransform: 'translateZ(0)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', height: '3.75rem' }}>
          {NAV_ITEMS.map(({ key, href, label, icon }) => {
            const active = href ? pathname === href : false

            if (key === 'search') {
              return (
                <button key={key} onClick={onSearchOpen} style={itemStyle(active)}>
                  {icon(active)}
                  <span style={{ fontSize: '0.625rem', fontWeight: active ? 600 : 400, letterSpacing: '-0.01em' }}>{label}</span>
                </button>
              )
            }

            if (key === 'portfolio') {
              return (
                <button key={key} onClick={handlePortfolioClick} style={itemStyle(false)}>
                  {icon(false)}
                  <span style={{ fontSize: '0.625rem', fontWeight: 400, letterSpacing: '-0.01em' }}>{label}</span>
                </button>
              )
            }

            if (key === 'more') {
              return (
                <button key={key} onClick={() => setMoreOpen(true)} style={itemStyle(false)}>
                  {icon(false)}
                  <span style={{ fontSize: '0.625rem', fontWeight: 400, letterSpacing: '-0.01em' }}>{label}</span>
                </button>
              )
            }

            return (
              <Link key={key} href={href!} style={itemStyle(active)}>
                {icon(active)}
                <span style={{ fontSize: '0.625rem', fontWeight: active ? 600 : 400, letterSpacing: '-0.01em' }}>{label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      <MobileMorePanel isOpen={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  )
}
