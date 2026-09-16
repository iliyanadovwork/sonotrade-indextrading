'use client'

import { Suspense, useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import posthog from 'posthog-js'
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react'

function PostHogPageView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const ph = usePostHog()

  useEffect(() => {
    if (!pathname || !ph) return
    let url = window.location.origin + pathname
    if (searchParams.toString()) url += `?${searchParams.toString()}`
    ph.capture('$pageview', { $current_url: url })
  }, [pathname, searchParams, ph])

  return null
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
    if (!key) return
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? '/ingest',
      defaults: '2026-01-30',
      capture_pageview: false,
      person_profiles: 'identified_only',
      // Perf: don't pull session-replay (rrweb ~50KB + 300ms main-thread)
      // or surveys (~32KB incl. preact) on the initial load — PSI flagged
      // both as unused JS competing with first paint. Replay can still be
      // turned on per-session with `posthog.startSessionRecording()`, and
      // surveys re-enabled by flipping disable_surveys, without redeploying.
      // Analytics events + pageviews are unaffected.
      disable_session_recording: true,
      disable_surveys: true,
    })
  }, [])

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </PHProvider>
  )
}
