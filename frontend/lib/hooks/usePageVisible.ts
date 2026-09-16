'use client'

import { useSyncExternalStore } from 'react'

function subscribe(cb: () => void) {
  document.addEventListener('visibilitychange', cb)
  return () => document.removeEventListener('visibilitychange', cb)
}

/**
 * True while the tab is visible. Used to pause carousel auto-advance
 * timers when the tab is backgrounded — the intervals otherwise keep
 * firing state updates (and re-renders) forever in hidden tabs, burning
 * CPU/battery for nothing. Server snapshot is `true` so SSR markup
 * matches the common case.
 */
export function usePageVisible(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => document.visibilityState === 'visible',
    () => true,
  )
}
