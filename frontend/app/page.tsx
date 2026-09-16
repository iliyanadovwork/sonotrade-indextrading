import { headers } from 'next/headers'
import HomeClient from './HomeClient'
import type { SlideProfile } from '@/components/sx/useSXTopGainerSlides'

export const dynamic = 'force-dynamic'

/**
 * Server-fetch the hero carousel's FIRST slide (the "Biggest Gainer" by
 * 1-month change — the exact query the client uses for slide 0) so we can:
 *
 *   1. Emit a high-priority `<link rel="preload">` for its image, making the
 *      LCP image discoverable in the initial HTML instead of only after the
 *      client bundle downloads, hydrates, and runs its data fetch (~3.3s of
 *      "resource load delay" on mobile Slow-4G in PageSpeed).
 *   2. Seed the hero widget (via initialHeroProfile) so the image renders in
 *      the SSR markup and paints on first paint rather than after hydration.
 *
 * Cached at the data layer (`revalidate: 60`, reinforced by the endpoint's
 * own `s-maxage=30, stale-while-revalidate=60`), so it adds no per-request
 * latency to TTFB — at most one request per minute pays for the upstream
 * query, the rest are served from the Data Cache (stale-while-revalidate).
 */
async function fetchHeroProfile(): Promise<SlideProfile | null> {
  try {
    const h = await headers()
    const proto = h.get('x-forwarded-proto') ?? 'https'
    const host = h.get('x-forwarded-host') ?? h.get('host')
    const origin =
      process.env.APP_BASE_URL?.replace(/\/$/, '') || (host ? `${proto}://${host}` : '')
    if (!origin) return null

    const res = await fetch(
      `${origin}/api/trade?limit=1&offset=0&sort_by=change_1m&sort_dir=desc`,
      { next: { revalidate: 60 } },
    )
    if (!res.ok) return null
    const data = await res.json()
    const a = data?.artists?.[0]
    if (!a?.image_url) return null

    // The hero slide prefers the first gallery image (matches the artist-page
    // banner). /api/trade doesn't carry gallery, so fetch the full profile —
    // same 60s data-layer cache, so no per-request cost.
    let galleryImage: string | null = null
    try {
      const profileRes = await fetch(
        `${origin}/api/profile/${encodeURIComponent(a.id)}`,
        { next: { revalidate: 60 } },
      )
      if (profileRes.ok) {
        const profileData = await profileRes.json()
        const gallery = profileData?.profile?.gallery
        if (Array.isArray(gallery) && typeof gallery[0] === 'string' && gallery[0]) {
          galleryImage = gallery[0]
        }
      }
    } catch {
      // fall back to spotify_img
    }

    return {
      id: a.id,
      name: a.name,
      ticker: a.id,
      image_url: a.image_url,
      gallery_image: galleryImage,
      industry: a.industry ?? null,
      index_price: a.index_price ?? null,
      change_1d: a.change_1d ?? null,
      change_1w: a.change_1w ?? null,
      change_1m: a.change_1m ?? null,
      volume: a.volume ?? null,
      market_cap: null,
      listed_at: null,
      holders: a.holders ?? null,
    }
  } catch {
    return null
  }
}

export default async function Page() {
  const hero = await fetchHeroProfile()

  // The LCP image is made discoverable + high-priority by seeding the hero
  // widget: it renders the slide-0 <img> directly into the SSR HTML with
  // fetchPriority="high" (see SXTopGainerWidget / HeroImageLayers). The
  // browser's preload scanner finds it during HTML parse and fetches it at
  // high priority — no separate <link rel="preload"> needed (React 19
  // deduplicates one against the already-present <img> anyway).
  return <HomeClient initialHeroProfile={hero} />
}
