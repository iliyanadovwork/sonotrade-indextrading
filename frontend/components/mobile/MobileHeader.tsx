'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/auth/AuthProvider'
import { usePortfolioPanel } from '@/context/PortfolioPanelContext'
import { supabaseImage } from '@/lib/supabaseImage'
import { CSXText } from '@/components/sx/core/CSXText'

export function MobileHeader() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { user } = useAuth()

  // Open the same auth popup the bottom-nav Portfolio button triggers when
  // signed out (driven by the ?auth=signin|signup query param → <AuthModal />).
  function openAuth(mode: 'signin' | 'signup') {
    const params = new URLSearchParams(searchParams.toString())
    params.set('auth', mode)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }
  const { openPortfolio } = usePortfolioPanel()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const displayUser = mounted && user ? {
    // Never fall back to the email — it's private. Usernames always exist
    // (chosen or generated at signup).
    username: (user.user_metadata?.username as string | undefined) ?? user.username ?? 'trader',
    avatar_url: (user.user_metadata?.avatar_url as string | null | undefined) ?? null,
  } : null

  return (
    <>
      <header className="sticky top-0 z-[1000] bg-[rgb(10,10,10)]">
        {/* Logo + auth row */}
        <div className="flex items-center justify-between px-3 pt-3 pb-2">
          <Link href="/" className="flex items-center gap-0.5 select-none" style={{ textDecoration: 'none' }}>
            <Image
              src="/sonotrade_glyph_square_transparent.png"
              alt="Sonotrade"
              width={25.2}
              height={25.2}
              priority
              unoptimized
              className="w-auto"
              style={{ width: 'auto', height: '1.75rem' }}
            />
            <CSXText variant="wordmark" color="STWhite" style={{ fontSize: '1.3rem' }}>Sonotrade</CSXText>
          </Link>

          {displayUser ? (
            <button
              onClick={openPortfolio}
              className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full text-[0.8125rem] font-semibold text-white"
              style={{ background: '#3f3f46', border: 'none', cursor: 'pointer', padding: '0rem' }}
            >
              {displayUser.avatar_url
                ? <img src={supabaseImage(displayUser.avatar_url, 128)} alt="" className="h-full w-full object-cover" loading="lazy" />
                : displayUser.username.charAt(0).toUpperCase()
              }
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                onClick={() => openAuth('signin')}
                style={{ padding: '0.375rem 0.875rem', borderRadius: '62.4375rem', border: '1px solid #3f3f46', background: 'transparent', color: '#a1a1aa', fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer' }}
              >
                Log In
              </button>
              <button
                onClick={() => openAuth('signup')}
                style={{ padding: '0.375rem 0.875rem', borderRadius: '62.4375rem', border: 'none', background: '#fff', color: '#000', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Sign Up
              </button>
            </div>
          )}
        </div>
      </header>
    </>
  )
}
