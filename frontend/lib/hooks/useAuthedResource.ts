'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * A shared cache for authenticated JSON GETs.
 *
 * Nine components each hand-rolled fetch-on-mount for the same two endpoints,
 * with their own useEffect + useState + loading + error. Opening the portfolio
 * panel over the portfolio page fetched identical data twice, and the 41
 * set-state-in-effect lint warnings were the symptom rather than 41 separate
 * mistakes.
 *
 * This is deliberately NOT a general data library. SWR or React Query would be
 * the right call for one, and this is not trying to be either — it is ~90 lines
 * covering exactly the shape this app has:
 *
 *   - authed GET returning JSON
 *   - shared across every component asking for the same URL
 *   - revalidated when a trade happens, which the app already broadcasts as
 *     'tradeComplete' and 'storage' window events
 *
 * If a third pattern shows up, that is the signal to replace this with a real
 * library rather than grow it.
 */

type Entry<T> = {
  data: T | null
  error: string | null
  loading: boolean
  fetchedAt: number
  inFlight: Promise<void> | null
  subscribers: Set<() => void>
}

const store = new Map<string, Entry<unknown>>()

/** Below this age a mount reuses the cached value instead of refetching. */
const FRESH_MS = 10_000

function entryFor<T>(key: string): Entry<T> {
  let e = store.get(key) as Entry<T> | undefined
  if (!e) {
    e = { data: null, error: null, loading: false, fetchedAt: 0, inFlight: null, subscribers: new Set() }
    store.set(key, e as Entry<unknown>)
  }
  return e
}

function notify(e: Entry<unknown>) {
  for (const fn of e.subscribers) fn()
}

async function load<T>(key: string, force: boolean): Promise<void> {
  const e = entryFor<T>(key)
  if (e.inFlight) return e.inFlight
  if (!force && e.data !== null && Date.now() - e.fetchedAt < FRESH_MS) return

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
  if (!token) {
    e.data = null
    e.error = null
    e.loading = false
    notify(e as Entry<unknown>)
    return
  }

  e.loading = true
  notify(e as Entry<unknown>)

  e.inFlight = (async () => {
    try {
      const res = await fetch(key, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      e.data = (await res.json()) as T
      e.error = null
      e.fetchedAt = Date.now()
    } catch (err) {
      e.error = err instanceof Error ? err.message : 'Request failed'
    } finally {
      e.loading = false
      e.inFlight = null
      notify(e as Entry<unknown>)
    }
  })()

  return e.inFlight
}

/**
 * Imperative read for call sites that are not hooks — TradePicker fetches
 * inside an event handler and flips between two endpoints mid-flight, so it
 * cannot express its access as a hook subscription. Shares the same cache.
 */
export async function fetchAuthedResource<T>(url: string): Promise<T | null> {
  await load<T>(url, false)
  return (entryFor<T>(url).data as T | null) ?? null
}

/** Drop cached values so the next read refetches. Called after a trade. */
export function invalidateAuthedResources(): void {
  for (const [key, e] of store) {
    e.fetchedAt = 0
    void load(key, true)
  }
}

export interface AuthedResource<T> {
  data: T | null
  error: string | null
  loading: boolean
  refetch: () => Promise<void>
}

/**
 * @param url  the endpoint, also the cache key. Pass null to skip entirely
 *             (e.g. a panel that has not been opened yet).
 */
export function useAuthedResource<T>(url: string | null): AuthedResource<T> {
  const [, forceRender] = useState(0)
  const rerender = useCallback(() => forceRender(n => n + 1), [])

  useEffect(() => {
    if (!url) return
    const e = entryFor<T>(url)
    e.subscribers.add(rerender)
    void load<T>(url, false)

    const onTrade = () => void load<T>(url, true)
    window.addEventListener('tradeComplete', onTrade)
    window.addEventListener('storage', onTrade)
    return () => {
      e.subscribers.delete(rerender)
      window.removeEventListener('tradeComplete', onTrade)
      window.removeEventListener('storage', onTrade)
    }
  }, [url, rerender])

  const e = url ? entryFor<T>(url) : null
  return {
    data: (e?.data as T | null) ?? null,
    error: e?.error ?? null,
    loading: e?.loading ?? false,
    // Closes over `url` directly rather than a ref. The first draft stashed it
    // in a ref and assigned during render — the same react-hooks/refs violation
    // this refactor exists to remove.
    refetch: useCallback(async () => {
      if (url) await load<T>(url, true)
    }, [url]),
  }
}
