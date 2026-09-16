import { useEffect, useState } from 'react'
import { preloadImage } from '@/lib/imageCache'
import { fetchJsonDeduped } from '@/lib/fetch-dedup'

export interface SlideProfile {
  id: string
  name: string
  index_price: number | null
  change_1d: number | null
  change_1w: number | null
  change_1m: number | null
  volume: number | null
  market_cap: number | null
  listed_at: string | null
  holders: number | null
  data_points?: Array<{ value: number; price: number; timestamp: number }>
  image_url?: string | null
  /** First image from the artist's scraped gallery — preferred for the hero
   *  image slide (same source as the artist-page banner). Falls back to
   *  image_url (spotify_img) when the gallery is empty. */
  gallery_image?: string | null
  bio?: string | null
  industry?: string | null
  ticker?: string | null
  info_location?: string | null
  info_subcategory?: string | null
  info_active_since?: string | null
  social_instagram?: string | null
  social_x?: string | null
  social_tiktok?: string | null
  social_spotify?: string | null
  social_youtube?: string | null
  social_twitch?: string | null
}

export interface SlideConfig {
  category: string
  badge: string
  bullets: string[]
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  fixedId?: string
}

export const SLIDE_CONFIGS: SlideConfig[] = [
  {
    category: 'Biggest Gainer',
    badge: 'Top Gainer',
    bullets: ['Highest 1M return', 'Strong momentum signal', 'Top monthly performer'],
    sortBy: 'change_1m',
    sortDir: 'desc',
  },
  {
    category: 'Highest Index',
    badge: 'Top Ranked',
    bullets: ['Highest index value', 'Blue-chip Index', 'Market leader'],
    sortBy: 'current_index_value',
    sortDir: 'desc',
  },
  {
    category: 'Highest Volume',
    badge: 'Most Traded',
    bullets: ['Highest trading activity', 'Deep liquidity pool', 'High market interest'],
    sortBy: 'volume',
    sortDir: 'desc',
  },
  {
    category: 'Biggest Dip',
    badge: 'Dip Alert',
    bullets: ['Largest 1M pullback', 'Potential mean reversion', 'Discounted entry point'],
    sortBy: 'change_1m',
    sortDir: 'asc',
  },
  {
    category: 'Long Term Pick',
    badge: 'Top 1Y',
    bullets: ['Highest 1Y return', 'Sustained growth trend', 'Long-term outperformer'],
    sortBy: 'change_1m',
    sortDir: 'desc',
  },
  {
    category: 'Weekly Winner',
    badge: 'Top 1W',
    bullets: ['Best 7-day performer', 'Breakout momentum', 'Short-term strength'],
    sortBy: 'change_1w',
    sortDir: 'desc',
  },
]

async function fetchProfileById(spotifyId: string): Promise<SlideProfile | null> {
  try {
    const data = await fetchJsonDeduped<{ profile?: SlideProfile } & SlideProfile>(
      `/api/profile/${encodeURIComponent(spotifyId)}?slim=true`
    )
    const a = data.profile ?? data
    if (!a?.name) return null
    return {
      id: a.id ?? a.name,
      name: a.name,
      index_price: a.index_price ?? null,
      change_1d: a.change_1d ?? null,
      change_1w: a.change_1w ?? null,
      change_1m: a.change_1m ?? null,
      volume: a.volume ?? null,
      market_cap: a.market_cap ?? null,
      holders: a.holders ?? null,
      listed_at: a.listed_at ?? null,
      data_points: a.data_points ?? [],
      image_url: a.image_url ?? null,
    }
  } catch {
    return null
  }
}

/**
 * Fetch the top-30 leaderboard for a given sort. Each (sortBy, sortDir)
 * combination is deduped via `fetchJsonDeduped` so two slides asking for
 * the same ranking share one network round-trip.
 */
async function fetchSortedProfiles(sortBy: string, sortDir: string): Promise<SlideProfile[]> {
  try {
    const data = await fetchJsonDeduped<{ artists?: SlideProfile[] }>(
      `/api/trade?limit=30&offset=0&sort_by=${sortBy}&sort_dir=${sortDir}`
    )
    return data.artists ?? []
  } catch {
    return []
  }
}

async function enrichWithGalleryFields(profile: SlideProfile): Promise<SlideProfile> {
  try {
    const data = await fetchJsonDeduped<{ profile?: Record<string, unknown> } & Record<string, unknown>>(
      `/api/profile/${encodeURIComponent(profile.id)}?slim=true`
    )
    const a = (data.profile ?? data) as Record<string, unknown>
    const gallery = Array.isArray(a.gallery) ? (a.gallery as unknown[]).filter((g): g is string => typeof g === 'string' && g.length > 0) : []
    return {
      ...profile,
      gallery_image: gallery[0] ?? null,
      bio: (a.bio as string | null | undefined) || null,
      industry: (a.industry as string | null | undefined) || null,
      ticker: (a.ticker as string | null | undefined) || null,
      info_location: (a.info_location as string | null | undefined) || null,
      info_subcategory: (a.info_subcategory as string | null | undefined) || null,
      info_active_since: (a.info_active_since as string | null | undefined) || null,
      image_url: (a.photo_url as string | null | undefined) || profile.image_url || null,
      social_instagram: (a.social_instagram as string | null | undefined) || null,
      social_x: (a.social_x as string | null | undefined) || null,
      social_tiktok: (a.social_tiktok as string | null | undefined) || null,
      social_spotify: (a.social_spotify as string | null | undefined) || null,
      social_youtube: (a.social_youtube as string | null | undefined) || null,
      social_twitch: (a.social_twitch as string | null | undefined) || null,
    }
  } catch {
    return profile
  }
}

export function useTopGainerSlides(initialHeroProfile?: SlideProfile | null) {
  // Seed slide 0 with the server-fetched hero profile (if provided) so the
  // first render — both SSR and the initial client render — paints the LCP
  // image immediately instead of a skeleton. Server and client seed from the
  // same prop, so there is no hydration mismatch. The effect below still runs
  // to refresh + enrich slide 0 and fill slides 1-6.
  const [profiles, setProfiles] = useState<(SlideProfile | null)[]>(() => {
    const seeded = SLIDE_CONFIGS.map(() => null) as (SlideProfile | null)[]
    if (initialHeroProfile) seeded[0] = initialHeroProfile
    return seeded
  })
  const [chartHistories, setChartHistories] = useState<Record<string, { price: number; timestamp: number }[]>>({})

  useEffect(() => {
    let cancelled = false
    async function fetchAll() {
      // Step 1: kick off all sorted-leaderboard fetches AND fixed-id
      // fetches in parallel. Same-key requests are deduped by
      // fetchJsonDeduped, so two slides asking for the same sort share
      // one network call. Previously this was sequential (6 round-trips
      // serialized = ~6× latency).
      const sortedListPromises = new Map<string, Promise<SlideProfile[]>>()
      const fixedIdPromises = new Map<string, Promise<SlideProfile | null>>()
      for (const cfg of SLIDE_CONFIGS) {
        if (cfg.fixedId) {
          if (!fixedIdPromises.has(cfg.fixedId)) {
            fixedIdPromises.set(cfg.fixedId, fetchProfileById(cfg.fixedId))
          }
        } else {
          const key = `${cfg.sortBy}:${cfg.sortDir}`
          if (!sortedListPromises.has(key)) {
            sortedListPromises.set(key, fetchSortedProfiles(cfg.sortBy!, cfg.sortDir!))
          }
        }
      }

      // Resolve every distinct fetch in parallel.
      await Promise.all([
        ...sortedListPromises.values(),
        ...fixedIdPromises.values(),
      ])

      // Step 2: assign profiles to slots in order, excluding IDs already
      // claimed by earlier slots. This preserves the "no duplicate
      // profile across slides" invariant from the old sequential loop.
      const usedIds = new Set<string>()
      const basics: (SlideProfile | null)[] = []
      for (const cfg of SLIDE_CONFIGS) {
        let profile: SlideProfile | null = null
        if (cfg.fixedId) {
          profile = (await fixedIdPromises.get(cfg.fixedId)!) ?? null
        } else {
          const key = `${cfg.sortBy}:${cfg.sortDir}`
          const list = (await sortedListPromises.get(key)!) ?? []
          profile = list.find(a => !usedIds.has(a.id)) ?? null
        }
        if (profile) usedIds.add(profile.id)
        basics.push(profile)
      }

      // Keep the SSR seed's gallery image on slide 0 — the /api/trade row has
      // no gallery, and dropping it here would flash spotify_img until the
      // enrichment pass below restores it.
      if (initialHeroProfile?.gallery_image && basics[0]?.id === initialHeroProfile.id) {
        basics[0] = { ...basics[0], gallery_image: initialHeroProfile.gallery_image }
      }

      // Preload the first slide's image immediately for LCP.
      const firstImage = basics[0]?.gallery_image || basics[0]?.image_url
      if (firstImage) preloadImage(firstImage)
      if (!cancelled) setProfiles(basics)

      // Step 3: enrich each non-null profile with gallery fields (parallel)
      const enriched = await Promise.all(
        basics.map(a => a ? enrichWithGalleryFields(a) : Promise.resolve(null))
      )
      if (!cancelled) setProfiles(enriched)

      // Step 4: one batch-history call for ALL slide tickers — replaces
      // 6 separate per-ticker fetches. The endpoint sets a 30s public
      // Cache-Control so concurrent home-page mounts also hit CDN cache.
      const validProfiles = basics.filter((a): a is SlideProfile => a !== null)
      if (validProfiles.length > 0) {
        try {
          const slugs = validProfiles.map(p => encodeURIComponent(p.id)).join(',')
          // credentials:'omit' — public endpoint, drops cookies to keep
          // request headers under CloudFront's 431 limit. See the matching
          // comment in app/page.tsx fetchSparklines.
          const data = await fetchJsonDeduped<Record<string, { price: number; timestamp: string }[]>>(
            // points=96: the hero slide chart is a few hundred px wide —
            // 96 points renders identically to the full 240 at ~40% the bytes.
            `/api/markets/batch-history?slugs=${slugs}&window=all&points=96`,
            { credentials: 'omit' }
          )
          if (!cancelled) {
            const map: Record<string, { price: number; timestamp: number }[]> = {}
            for (const profile of validProfiles) {
              const pts = data[profile.id]
              if (Array.isArray(pts) && pts.length > 0) {
                map[profile.id] = pts.map(p => ({
                  price: p.price,
                  timestamp: new Date(p.timestamp).getTime(),
                }))
              }
            }
            setChartHistories(map)
          }
        } catch {
          // Non-critical — slide chart sparklines just stay empty.
        }
      }
    }
    fetchAll()
    return () => { cancelled = true }
    // initialHeroProfile is a mount-time SSR seed (never changes) — rerunning
    // the full fetch pipeline on its identity would only duplicate requests.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { profiles, chartHistories }
}
