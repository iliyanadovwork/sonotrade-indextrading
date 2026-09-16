'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { LineChart, Newspaper, Trophy, User, type LucideIcon } from 'lucide-react'
import { CSXText } from '@/components/sx/core/CSXText'
import { useUser } from '@/lib/use-user'

const RAIL_ITEMS: { href: string; icon: LucideIcon; label: string }[] = [
  { href: '/', icon: LineChart, label: 'Trade' },
  { href: '/feed', icon: Newspaper, label: 'Feed' },
  { href: '/leaderboard', icon: Trophy, label: 'Leaderboard' },
  { href: '/profile', icon: User, label: 'Profile' },
]

// Mirror AppHeader: these pages are full-screen and bring their own chrome.
const HIDDEN_ROUTES = ['/sign-in', '/sign-up', '/how-it-works']

// Proximity thresholds (viewport px). Hysteresis — the expand trigger sits
// well inside the collapse trigger — so the rail never flickers when the
// cursor hovers right at a boundary. Collapse waits until the cursor is
// clearly past the expanded panel's width.
const EXPAND_WITHIN = 90
const COLLAPSE_BEYOND = 200

const RAIL_W = 64
const RAIL_W_EXPANDED = 200

function RailTab({
  href,
  icon: Icon,
  label,
  active,
  expanded,
  staggerIndex,
}: {
  href: string
  icon: LucideIcon
  label: string
  active: boolean
  expanded: boolean
  staggerIndex: number
}) {
  const [hovered, setHovered] = useState(false)
  const labelColor = active || hovered ? 'STWhite' : 'STWhiteMuted'

  return (
    <Link
      href={href}
      aria-label={label}
      title={expanded ? undefined : label}
      aria-current={active ? 'page' : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      className={`flex h-11 items-center overflow-hidden rounded-full outline-none transition-colors duration-200 ease-out hover:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-white/20 ${active ? 'bg-white/[0.12]' : ''}`}
    >
      {/* Fixed 44px icon box — the icon's x never moves, so the rail
          reads as unfolding around it rather than jumping. */}
      <span
        className="flex h-11 w-11 flex-shrink-0 items-center justify-center"
        style={{ color: active || hovered ? 'var(--st-white)' : 'var(--st-white-muted)' }}
      >
        <Icon className="size-[1.375rem] shrink-0" strokeWidth={1.75} aria-hidden />
      </span>
      <span
        className="whitespace-nowrap pr-4"
        style={{
          opacity: expanded ? 1 : 0,
          transform: expanded ? 'translateX(0)' : 'translateX(-10px)',
          // Staggered slide-in per row on expand; quick uniform fade
          // on collapse so folding feels snappy.
          transition: expanded
            ? `opacity 240ms ease ${80 + staggerIndex * 35}ms, transform 320ms cubic-bezier(0.16, 1, 0.3, 1) ${80 + staggerIndex * 35}ms`
            : 'opacity 120ms ease, transform 160ms ease',
        }}
      >
        <CSXText variant="body2Medium" color={labelColor}>
          {label}
        </CSXText>
      </span>
    </Link>
  )
}

/**
 * Icon navigation rail on the left edge of the screen on desktop. Hidden on
 * mobile. Two-layer design reconciling two lineages of this component:
 *
 * 1. The OUTER <nav> is an **in-flow** flex item (see the row wrapper in
 *    `app/layout.tsx`), not `position: fixed`. It used to be fixed, which
 *    reserved no space: once the viewport narrowed enough that the centering
 *    margin fell below 64px, the rail painted over the page and content read
 *    as *clipped* ("Sonotrade" → "onotrade"). Being in-flow reserves the 64px
 *    column by construction. `self-start` is load-bearing: flex-stretch would
 *    size it to the full row height and leave `sticky` nothing to move within.
 *
 * 2. The INNER panel is absolutely positioned inside that column and is what
 *    animates on cursor proximity — unfolding 64→200px to reveal labels. It
 *    overlays the content to its right (macOS-dock style) instead of resizing
 *    the column, so expansion never reflows the page and the in-flow
 *    guarantee of layer 1 is preserved.
 */
export function GlobalSideRail() {
  const pathname = usePathname()
  const { user, loading } = useUser()

  const [expanded, setExpanded] = useState(false)
  // Mirrors `expanded` so the mousemove handler reads fresh state without
  // re-subscribing on every toggle.
  const expandedRef = useRef(false)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const setExpandedBoth = (next: boolean) => {
      if (next === expandedRef.current) return
      expandedRef.current = next
      setExpanded(next)
    }
    const onMove = (e: MouseEvent) => {
      if (rafRef.current != null) return
      const x = e.clientX
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        setExpandedBoth(expandedRef.current ? x < COLLAPSE_BEYOND : x < EXPAND_WITHIN)
      })
    }
    // Cursor leaving the window entirely should always fold the rail back.
    const onLeave = () => setExpandedBoth(false)
    window.addEventListener('mousemove', onMove, { passive: true })
    document.documentElement.addEventListener('mouseleave', onLeave)
    return () => {
      window.removeEventListener('mousemove', onMove)
      document.documentElement.removeEventListener('mouseleave', onLeave)
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  if (HIDDEN_ROUTES.includes(pathname)) return null

  // Profile requires auth — send signed-out users to the login/signup page.
  const hrefFor = (href: string) =>
    href === '/profile' && !loading && !user ? '/sign-up?mode=login' : href

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)

  return (
    <nav
      aria-label="Primary"
      // Keyboard parity with the pointer proximity: tabbing into the rail
      // unfolds it, tabbing out folds it back.
      onFocusCapture={() => { expandedRef.current = true; setExpanded(true) }}
      onBlurCapture={() => { expandedRef.current = false; setExpanded(false) }}
      className="sticky top-0 z-[1001] hidden w-16 shrink-0 self-start md:block"
      style={{ height: '100vh' }}
    >
      <div
        data-testid="side-rail-panel"
        className="absolute inset-y-0 left-0 flex flex-col justify-center gap-2 overflow-hidden border-r border-[#262626] px-2.5"
        style={{
          background: '#0A0A0A',
          width: expanded ? RAIL_W_EXPANDED : RAIL_W,
          transition: 'width 320ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 320ms ease',
          boxShadow: expanded ? '24px 0 48px rgba(0,0,0,0.45)' : 'none',
          willChange: 'width',
        }}
      >
        {RAIL_ITEMS.map(({ href, icon, label }, i) => (
          <RailTab
            key={href}
            href={hrefFor(href)}
            icon={icon}
            label={label}
            active={isActive(href)}
            expanded={expanded}
            staggerIndex={i}
          />
        ))}
      </div>
    </nav>
  )
}
