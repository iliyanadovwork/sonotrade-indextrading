'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useUser } from '@/lib/use-user'
import { usePortfolioPanel } from '@/context/PortfolioPanelContext'

// Mobile sidebar navigation — internal pages (same targets as the footer).
const LINKS: { label: string; href: string; external?: boolean; howItWorks?: boolean }[] = [
  { label: 'How it works', href: '/how-it-works' },
  { label: 'FAQ',          href: '/faq' },
  { label: 'Privacy',      href: '/privacy' },
  { label: 'Terms',        href: '/terms' },
  { label: 'Contact',      href: '/contact' },
]

const SOCIALS = [
  {
    label: 'Instagram',
    href: 'https://instagram.com/sonotradehq',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" width="22" height="22">
        <path d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2Zm0 1.5A4.25 4.25 0 0 0 3.5 7.75v8.5A4.25 4.25 0 0 0 7.75 20.5h8.5A4.25 4.25 0 0 0 20.5 16.25v-8.5A4.25 4.25 0 0 0 16.25 3.5h-8.5ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 1.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm5.25-.88a.88.88 0 1 1 0 1.76.88.88 0 0 1 0-1.76Z" />
      </svg>
    ),
  },
  {
    label: 'X',
    href: 'https://x.com/SonotradeHQ',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1227" fill="currentColor" width="20" height="20">
        <path d="M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866L515.491 750.218L842.672 1226.37H1200L714.137 519.284H714.163ZM569.165 687.828L521.697 619.934L144.011 87.6944H306.615L611.412 515.685L658.88 583.579L1055.08 1143.69H892.476L569.165 687.854V687.828Z" />
      </svg>
    ),
  },
  {
    label: 'Discord',
    href: 'https://discord.com/invite/sonotrade',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -28.5 256 256" fill="currentColor" width="22" height="22">
        <path fillRule="nonzero" d="M216.856339,16.5966031 C200.285002,8.84328665 182.566144,3.2084988 164.041564,0 C161.766523,4.11318106 159.108624,9.64549908 157.276099,14.0464379 C137.583995,11.0849896 118.072967,11.0849896 98.7430163,14.0464379 C96.9108417,9.64549908 94.1925838,4.11318106 91.8971895,0 C73.3526068,3.2084988 55.6133949,8.86399117 39.0420583,16.6376612 C5.61752293,67.146514 -3.4433191,116.400813 1.08711069,164.955721 C23.2560196,181.510915 44.7403634,191.567697 65.8621325,198.148576 C71.0772151,190.971126 75.7283628,183.341335 79.7352139,175.300261 C72.104019,172.400575 64.7949724,168.822202 57.8887866,164.667963 C59.7209612,163.310589 61.5131304,161.891452 63.2445898,160.431257 C105.36741,180.133187 151.134928,180.133187 192.754523,160.431257 C194.506336,161.891452 196.298154,163.310589 198.110326,164.667963 C191.183787,168.842556 183.854737,172.420929 176.223542,175.320965 C180.230393,183.341335 184.861538,190.991831 190.096624,198.16893 C211.238746,191.588051 232.743023,181.531619 254.911949,164.955721 C260.227747,108.668201 245.831087,59.8662432 216.856339,16.5966031 Z M85.4738752,135.09489 C72.8290281,135.09489 62.4592217,123.290155 62.4592217,108.914901 C62.4592217,94.5396472 72.607595,82.7145587 85.4738752,82.7145587 C98.3405064,82.7145587 108.709962,94.5189427 108.488529,108.914901 C108.508531,123.290155 98.3405064,135.09489 85.4738752,135.09489 Z M170.525237,135.09489 C157.88039,135.09489 147.510584,123.290155 147.510584,108.914901 C147.510584,94.5396472 157.658606,82.7145587 170.525237,82.7145587 C183.391518,82.7145587 193.761324,94.5189427 193.539891,108.914901 C193.539891,123.290155 183.391518,135.09489 170.525237,135.09489 Z" />
      </svg>
    ),
  },
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/company/105421065',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" width="22" height="22">
        <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-9h3v9zm-1.5-10.271c-.966 0-1.75-.784-1.75-1.75s.784-1.75 1.75-1.75 1.75.784 1.75 1.75-.784 1.75-1.75 1.75zm13.5 10.271h-3v-4.5c0-1.121-.879-2-2-2s-2 .879-2 2v4.5h-3v-9h3v1.189c.819-1.064 2.319-1.189 3.5-1.189 2.209 0 4 1.791 4 4v5z" />
      </svg>
    ),
  },
]

interface MobileMorePanelProps {
  isOpen: boolean
  onClose: () => void
}

export function MobileMorePanel({ isOpen, onClose }: MobileMorePanelProps) {
  const router = useRouter()
  const [shouldRender, setShouldRender] = useState(false)
  const [visible, setVisible] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const { user } = useUser()
  const balanceUsd = Number(user?.balance ?? 0)
  const { openPortfolio } = usePortfolioPanel()

  const handleOpenPortfolio = () => {
    onClose()
    setTimeout(openPortfolio, 320)
  }

  /* eslint-disable react-hooks/set-state-in-effect --
     Synchronously syncs `shouldRender` + `visible` with the parent's
     `isOpen` so the panel mounts before the enter animation and unmounts
     300 ms after the exit animation. The cascading-render concern the
     rule targets doesn't apply here: each `isOpen` change schedules at
     most ONE synchronous transition, bounded by the prop. Refactoring
     around the rule (state machine via useReducer, CSS-only animation)
     would add more code than it saves. */
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true)
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    }
    setVisible(false)
    const t = setTimeout(() => setShouldRender(false), 300)
    return () => clearTimeout(t)
  }, [isOpen])
  /* eslint-enable react-hooks/set-state-in-effect */

  useLayoutEffect(() => {
    if (!shouldRender || !isOpen) return
    panelRef.current?.getBoundingClientRect()
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [shouldRender, isOpen])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  const handleAuth = (mode: 'login' | 'signup') => {
    const dest = mode === 'signup' ? '/sign-up' : '/sign-in'
    onClose()
    setTimeout(() => router.push(dest), 320)
  }

  if (!shouldRender) return null

  const linkStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '0.75rem',
    height: '3rem', width: '100%',
    paddingLeft: '0.75rem', paddingRight: '1rem',
    borderRadius: '62.4375rem',
    color: 'var(--st-secondary)',
    background: 'none', border: 'none', cursor: 'pointer',
    textDecoration: 'none',
    transition: 'color 200ms ease-out',
  }

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 1100 }}>
        {/* Backdrop */}
        <div
          onClick={onClose}
          style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.5)',
            opacity: visible ? 1 : 0,
            transition: 'opacity 300ms ease',
          }}
        />

        {/* Panel — slides in from left */}
        <div
          ref={panelRef}
          style={{
            position: 'absolute', top: '0rem', left: '0rem', bottom: '0rem',
            width: '75%', maxWidth: '17.5rem',
            background: 'rgb(10,10,10)',
            borderRight: '1px solid #1a1a1a',
            display: 'flex', flexDirection: 'column',
            transform: visible ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'transform 300ms cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          {/* Header */}
          <div style={{
            paddingTop: 'max(env(safe-area-inset-top), 1rem)',
            paddingBottom: '0.5rem', paddingLeft: '0.75rem', paddingRight: '0.75rem',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <span style={{ fontFamily: 'var(--font-geist-sans)', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--st-secondary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>More</span>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '2rem', height: '2rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--st-secondary)', padding: '0rem' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Scrollable content */}
          <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none', display: 'flex', flexDirection: 'column' }}
            className="[&::-webkit-scrollbar]:hidden">

            {/* Nav links */}
            <nav style={{ padding: '0 0.5rem' }}>
              {LINKS.map(({ label, href, external, howItWorks }) => {
                const inner = (
                  <span style={{ fontFamily: 'var(--font-geist-sans)', fontSize: '0.875rem', fontWeight: 500, position: 'relative', top: '0.0625rem' }}>
                    {label}
                  </span>
                )
                if (howItWorks) {
                  return (
                    <button
                      key={label}
                      style={{ ...linkStyle, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }}
                      onClick={() => {
                        onClose();
                        const params = new URLSearchParams(window.location.search);
                        params.set('how', 'open');
                        router.push(`${window.location.pathname}?${params.toString()}`);
                      }}
                    >
                      {inner}
                    </button>
                  )
                }
                if (external) {
                  return (
                    <a key={label} href={href} target="_blank" rel="noopener noreferrer" style={linkStyle} onClick={onClose}>
                      {inner}
                    </a>
                  )
                }
                return (
                  <Link key={label} href={href} style={linkStyle} onClick={onClose}>
                    {inner}
                  </Link>
                )
              })}
            </nav>

            {/* Divider */}
            <div style={{ height: '0.0625rem', background: '#1a1a1a', margin: '0.5rem 0.75rem' }} />

            {/* Social icons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.75rem 0.5rem' }}>
              {SOCIALS.map(({ label, href, icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: '2.5rem', height: '2.5rem', borderRadius: '62.4375rem',
                    color: 'var(--st-secondary)',
                    textDecoration: 'none',
                    transition: 'color 150ms ease',
                  }}
                >
                  {icon}
                </a>
              ))}
            </div>

            {/* Divider */}
            <div style={{ height: '0.0625rem', background: '#1a1a1a', margin: '0.5rem 0.75rem' }} />

            {/* Auth area */}
            {user ? (
              <button
                onClick={handleOpenPortfolio}
                style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '0.5rem 1.25rem 1.5rem', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
                  <span style={{ fontFamily: 'var(--font-geist-sans)', fontSize: '0.75rem', color: 'var(--st-secondary)', fontWeight: 500 }}>Cash</span>
                  <span style={{ fontFamily: 'var(--font-inter)', fontSize: '0.875rem', fontWeight: 500, color: 'var(--st-positive)' }}>
                    {`$${balanceUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  </span>
                </div>
              </button>
            ) : (
              <div style={{ padding: '0.5rem 0.75rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <button
                  onClick={() => handleAuth('login')}
                  style={{
                    width: '100%', padding: '0.625rem 0', borderRadius: '62.4375rem',
                    border: '1px solid #3f3f46', background: 'transparent',
                    color: '#a1a1aa', fontSize: '0.875rem', fontWeight: 500,
                    cursor: 'pointer', fontFamily: 'var(--font-geist-sans)',
                    letterSpacing: '-0.015em',
                  }}
                >
                  Log In
                </button>
                <button
                  onClick={() => handleAuth('signup')}
                  style={{
                    width: '100%', padding: '0.625rem 0', borderRadius: '62.4375rem',
                    border: 'none', background: '#fff',
                    color: '#000', fontSize: '0.875rem', fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'var(--font-geist-sans)',
                    letterSpacing: '-0.015em',
                  }}
                >
                  Sign Up
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
