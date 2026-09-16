import type { MetadataRoute } from 'next'
import { TAG_GROUPS } from '@/lib/tagGroups'
import { SUPABASE_ANON_KEY } from '@/lib/supabase/env'
import { siteOrigin } from '@/lib/canonical-origin'

// Was hardcoded to the retired product's domain, so every emitted URL pointed
// at a site this app does not serve.
const SITE_URL = siteOrigin()

/**
 * Served as /sitemap.xml. Lists the canonical URLs Google should crawl,
 * with `lastModified` + `changeFrequency` hints to help allocate crawl
 * budget intelligently.
 *
 * What's included:
 *   - Homepage + static marketing routes (sign-in / sign-up)
 *   - All public tag pages (driven by TAG_GROUPS + live industries)
 *   - All public profile pages (fetched from Supabase at request time)
 *
 * What's excluded (deliberately, mirrored in robots.ts):
 *   - Account / portfolio / admin (private)
 *   - Auth callback / confirm routes (transient)
 *   - API routes (no SEO value)
 *
 * Failure mode: if Supabase is unreachable at sitemap-generation time,
 * we return what we have (static pages + tag pages we already know).
 * Google will retry on next crawl. Better than throwing and surfacing
 * an HTTP 500 to the crawler — that gets the sitemap dropped entirely.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'hourly', priority: 1.0 },
    { url: `${SITE_URL}/sign-in`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${SITE_URL}/sign-up`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
  ]

  // Tag pages derived from the same group config the nav uses.
  const tagEntries: MetadataRoute.Sitemap = TAG_GROUPS.flatMap(group =>
    group.map(industry => ({
      url: `${SITE_URL}/tag/${encodeURIComponent(industry)}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.6,
    }))
  )

  // Profile pages from Supabase. Cached for 1 hour so we don't slam the
  // DB on every crawler hit.
  let profileEntries: MetadataRoute.Sitemap = []
  try {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?select=ticker,updated_at&limit=50000`
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      next: { revalidate: 3600 },
    })
    if (res.ok) {
      const rows: { ticker: string | null; updated_at: string | null }[] = await res.json()
      profileEntries = rows
        .filter((r): r is { ticker: string; updated_at: string | null } => !!r.ticker)
        .map(r => ({
          url: `${SITE_URL}/profile/${encodeURIComponent(r.ticker)}`,
          lastModified: r.updated_at ? new Date(r.updated_at) : now,
          changeFrequency: 'daily' as const,
          priority: 0.8,
        }))
    }
  } catch {
    // swallow; static + tag entries still ship
  }

  return [...staticEntries, ...tagEntries, ...profileEntries]
}
