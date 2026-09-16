'use client'

import { useEffect, useState, useRef } from 'react'
import { fetchJsonDeduped } from '@/lib/fetch-dedup'
import { subscribeToArtistRow } from './artistRowSubscription'

export interface PricePoint {
  price: number
  timestamp: number
}

export type HistoryPeriod = '1H' | '1D' | '1W' | '1M' | 'ALL'

/**
 * Sliding-window cap on realtime tick accumulation. Without it a profile
 * tab left open on an active market grows the array (and the SVG path the
 * chart rebuilds per tick) without bound. 2000 points is far above what
 * the chart can visually resolve, so trimming the oldest is invisible.
 */
const MAX_LIVE_POINTS = 2000

const PERIOD_TO_WINDOW: Record<HistoryPeriod, string> = {
  '1H':  '1h',
  '1D':  '24h',
  '1W':  '7d',
  '1M':  '30d',
  'ALL': 'all',
}

function parsePoints(data: unknown): PricePoint[] {
  if (!Array.isArray(data)) return []
  return data
    .map((item: unknown) => {
      if (!item || typeof item !== 'object') return null
      const d = item as Record<string, unknown>
      const price = typeof d.price === 'number' ? d.price : parseFloat(String(d.price ?? ''))
      const ts = typeof d.timestamp === 'string'
        ? new Date(d.timestamp).getTime()
        : typeof d.timestamp === 'number' ? d.timestamp : NaN
      if (isNaN(price) || isNaN(ts)) return null
      return { price, timestamp: ts }
    })
    .filter(Boolean) as PricePoint[]
}

// A seed with non-finite prices/timestamps would render as an invalid SVG
// path (NaN coordinates draw nothing) AND suppress the corrective API fetch
// below — a blank chart with no self-heal. Drop bad points up front.
function sanitizePoints(points: PricePoint[]): PricePoint[] {
  const clean = points.filter(p => Number.isFinite(p.price) && Number.isFinite(p.timestamp))
  return clean.length === points.length ? points : clean
}

export function useLivePriceHistory(
  slug: string | null,
  profileId: string | null,
  period: HistoryPeriod = 'ALL',
  initial: PricePoint[] = [],
): PricePoint[] {
  const seed = sanitizePoints(initial)

  // Seed from the SSR-rendered history (matches OLD's pattern). The
  // server already pulled up to 1000 ticks via `getMarketPriceHistory`
  // and embedded them in `initialProfile.price_history`; using that seed
  // means the chart paints with real data immediately instead of flat-
  // lining while the API fetch resolves.
  const [history, setHistory] = useState<PricePoint[]>(seed)

  // Reset when navigating to a different profile. React's documented
  // adjust-state-during-render pattern uses state, not a ref: a ref read or
  // written during render is not tracked, so the reset can be missed.
  const [trackedSlug, setTrackedSlug] = useState(slug)
  if (slug !== trackedSlug) {
    setTrackedSlug(slug)
    setHistory(seed)
  }

  const fetchKeyRef = useRef('')

  // The SSR seed already covers the initial period's full history, so the
  // first API fetch for that period would just swap in a near-identical
  // (differently-downsampled) array — making the chart visibly re-render /
  // jump right after its draw animation. Skip that one redundant fetch; the
  // realtime channel keeps the seed current from there. Captured once on the
  // first render so later period switches (or a stale return to this period)
  // still fetch fresh data.
  const seededPeriodRef = useRef<HistoryPeriod | null>(seed.length > 1 ? period : null)

  useEffect(() => {
    if (!slug) return
    const window = PERIOD_TO_WINDOW[period]
    const key = `${slug}:${window}`
    fetchKeyRef.current = key

    if (seededPeriodRef.current === period) {
      seededPeriodRef.current = null
      return
    }

    fetchJsonDeduped<unknown>(
      `/api/markets/${encodeURIComponent(slug)}/history?window=${window}`
    )
      .then(async data => {
        if (fetchKeyRef.current !== key) return
        const points = parsePoints(data)
        // Use API points only when they're richer than what we already
        // have. Empty / sparse responses keep the SSR seed visible
        // (downsampled buckets for narrow windows can drop to 1–2 points
        // on small markets, which would otherwise flat-line the chart).
        if (points.length > 1) { setHistory(points); return }
        if (window === 'all') {
          if (points.length === 1) {
            const last = points[0]!
            setHistory([last, { price: last.price, timestamp: Date.now() }])
          }
          return
        }
        const allData = await fetchJsonDeduped<unknown>(
          `/api/markets/${encodeURIComponent(slug)}/history?window=all`
        ).catch(() => null)
        if (!allData || fetchKeyRef.current !== key) return
        const allPoints = parsePoints(allData)
        if (allPoints.length > 1) { setHistory(allPoints); return }
        if (allPoints.length === 1) {
          const last = allPoints[0]!
          setHistory([last, { price: last.price, timestamp: Date.now() }])
        }
      })
      .catch(() => {})
  }, [slug, period])

  // Append live price ticks from the shared realtime subscription
  useEffect(() => {
    if (!profileId || !slug) return
    return subscribeToArtistRow(profileId, slug, (row) => {
      // Defense in depth: the server-side filter scopes the channel, but a
      // mis-scoped event appending another artist's price would corrupt
      // this chart — drop anything that isn't ours.
      if (row.spotify_id && row.spotify_id !== slug) return
      const price = row.current_index_value != null ? Number(row.current_index_value) : null
      if (price == null || isNaN(price)) return
      // Append every tick with ms precision. Two trades in the same
      // second on a flat curve can produce two distinct ticks; bucketing
      // to 1s would silently drop one.
      setHistory(prev => {
        const next = [...prev, { price, timestamp: Date.now() }]
        return next.length > MAX_LIVE_POINTS
          ? next.slice(next.length - MAX_LIVE_POINTS)
          : next
      })
    })
  }, [profileId, slug])

  return history
}
