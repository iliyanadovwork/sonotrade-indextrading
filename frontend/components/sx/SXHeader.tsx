'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SXSearchModal } from './SXSearchModal'
import { avatarColor } from './avatarColor'
import { CSXButton } from './core/CSXButton'
import { CSXText } from './core/CSXText'
import { CSXTextualLink } from './core/CSXTextualLink'
import { useUser } from '@/lib/use-user'
import { fmtNumber } from '@/lib/format'

function formatUsd(value: number | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return `$${fmtNumber(Number(value))}`
}

export function Header({ children, bordered = false }: { children?: React.ReactNode; bordered?: boolean }) {
  const router = useRouter()
  const { user, loading } = useUser()
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  const openAuth = (mode: 'signin' | 'signup') => {
    router.push(mode === 'signup' ? '/sign-up' : '/sign-up?mode=login')
  }

  return (
    <>
      <header className={`sticky top-0 z-[1000] bg-[rgb(10,10,10)] h-auto${bordered ? ' border-b border-[#262626]' : ''}`} style={{ transform: 'translateZ(0)', WebkitTransform: 'translateZ(0)' }}>
        {/* Horizontal gutters use --st-page-gutter-x (same token as .st-page-x
            on the app shell) so chrome and page body stay aligned. Left cluster
            may shrink below xl; search compresses, logo + auth stay put. */}
        <div className="mx-auto flex min-w-0 max-w-[92.5rem] items-center justify-between gap-3 pt-4 pb-4 sm:gap-4 xl:gap-12 px-[var(--st-page-gutter-x)]">

          {/* Left cluster mirrors the home content column ([flex:0_0_73%] +
              mr-12) so the search bar's right edge aligns with the hero's. */}
          <div className="flex min-w-0 flex-1 items-center gap-4 xl:grow-0 xl:shrink xl:basis-[73%] xl:gap-8">
            <Link
              href="/"
              className="flex shrink-0 translate-x-0 items-center gap-0 select-none no-underline origin-left scale-100 max-[48rem]:scale-90 xl:-translate-x-[0.4375rem]"
              style={{ textDecoration: 'none' }}
            >
              <Image
                src="/sonotrade_glyph_square_transparent.png"
                alt="Sonotrade"
                width={28.8}
                height={28.8}
                priority
                unoptimized
                className="block h-8 w-auto"
                style={{ height: '2rem' }}
              />
              <div className="flex items-center gap-2">
                <CSXText variant="wordmark" color="STWhite">
                  Sonotrade
                </CSXText>
              </div>
            </Link>
            <nav className="hidden items-center gap-6 xl:flex xl:gap-8" aria-label="Primary">
              <CSXTextualLink
                href="/"
                variant="body2Button"
                color="STSecondary"
                hoverColor="STWhite"
                className="shrink-0"
              >
                Trade
              </CSXTextualLink>
              <Link
                href="/feed"
                className="font-sans m-0 indent-0 p-0 text-sm font-normal leading-snug tracking-[-0.025em] shrink-0 no-underline"
              >
                <span className="header-rainbow-text">Feed</span>
              </Link>
              <CSXTextualLink
                href="/how-it-works"
                variant="body2Button"
                color="STSecondary"
                hoverColor="STWhite"
                className="shrink-0"
              >
                How it works
              </CSXTextualLink>
            </nav>
            <div
              className="flex min-w-0 w-full max-w-sm cursor-pointer items-center gap-2 rounded-full border border-transparent px-4 py-[0.4375rem] sm:max-w-md xl:max-w-none xl:flex-1"
              style={{ background: '#131313' }}
              onClick={() => setIsSearchOpen(true)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-st-muted">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <div className="min-w-0 truncate">
                <CSXText variant="body2Button" color="STMuted">
                  Search markets...
                </CSXText>
              </div>
            </div>
          </div>

          <div className="flex h-9 shrink-0 items-center justify-end gap-3 sm:gap-4">
            {loading ? (
              <div
                className="flex shrink-0 items-center justify-end gap-4 sm:gap-5"
                aria-busy="true"
                aria-label="Loading account"
              >
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-center gap-0.5">
                    <CSXText variant="body2" color="STSecondary">Cash</CSXText>
                    <div className="h-[1rem] w-14 mb-1 shrink-0 rounded bg-st-surface-raised motion-safe:animate-pulse" />
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <CSXText variant="body2" color="STSecondary">Portfolio</CSXText>
                    <div className="h-[1rem] w-14 mb-1 shrink-0 rounded bg-st-surface-raised motion-safe:animate-pulse" />
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-4 sm:gap-5">
                  <div className="h-6 w-px shrink-0 bg-st-border-strong opacity-50" aria-hidden />
                  <div className="relative">
                    <div className="h-9 w-9 shrink-0 rounded-full bg-st-surface-raised motion-safe:animate-pulse" />
                  </div>
                </div>
              </div>
            ) : user ? (
              <div className="flex min-w-0 max-w-full items-center justify-end gap-4 sm:gap-5">
                <Link href="/portfolio" className="flex items-center gap-4 no-underline cursor-pointer" style={{ textDecoration: 'none' }}>
                  <div className="flex flex-col items-center gap-0.5">
                    <CSXText variant="body2" color="STSecondary">Cash</CSXText>
                    <CSXText variant="body2Medium" color="STPositive">
                      <span style={{ fontFamily: 'var(--font-inter)' }}>{formatUsd(user.balance)}</span>
                    </CSXText>
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <CSXText variant="body2" color="STSecondary">Portfolio</CSXText>
                    <CSXText variant="body2Medium" color="STPositive">
                      <span style={{ fontFamily: 'var(--font-inter)' }}>{formatUsd(user.balance)}</span>
                    </CSXText>
                  </div>
                </Link>
                <div className="flex shrink-0 items-center gap-4 sm:gap-5">
                  <div className="h-6 w-px shrink-0 bg-st-border-strong" aria-hidden />
                  <Link
                    href="/profile"
                    className="relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full text-[0.8125rem] font-semibold text-white focus:outline-none no-underline"
                    style={{
                      backgroundColor: user.avatar_url ? undefined : avatarColor(user.username),
                    }}
                  >
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      (user.username || '?').charAt(0).toUpperCase()
                    )}
                  </Link>
                </div>
              </div>
            ) : (
              <div className="flex shrink-0 items-center gap-2">
                <CSXButton
                  variant="outline"
                  label="Log In"
                  onClick={() => openAuth('signin')}
                />
                <CSXButton
                  variant="primary"
                  label="Sign Up"
                  onClick={() => openAuth('signup')}
                />
              </div>
            )}
          </div>
        </div>
        {children}
      </header>

      {isSearchOpen && <SXSearchModal onClose={() => setIsSearchOpen(false)} />}
    </>
  )
}
