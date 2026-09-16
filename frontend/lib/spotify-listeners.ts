// Monthly-listener lookup for on-demand artist listing. SERVER ONLY.
//
// Mirrors scraper/src/sources/spotify-meta.ts: Spotify's official API does
// NOT expose monthly listeners, but it serves them in the og:description meta
// tag to link-preview crawlers. We need this at listing time to seed a new
// market's opening index; the scraper takes over from there.

const CRAWLER_UAS = [
  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  'Twitterbot/1.0',
  'WhatsApp/2.19.81 A',
]
const OG_DESC = /property="og:description"\s+content="([^"]*)"/

/** Parse "Artist · 91.2M monthly listeners." → 91200000 */
export function parseListeners(raw: string): number | null {
  const m = raw.match(/([\d.,]+)\s*([KMB]?)\s*monthly listeners/i)
  if (!m) return null
  const num = parseFloat(m[1].replace(/,/g, ''))
  if (!Number.isFinite(num)) return null
  const u = m[2].toUpperCase()
  const mult = u === 'B' ? 1e9 : u === 'M' ? 1e6 : u === 'K' ? 1e3 : 1
  return Math.round(num * mult)
}

export async function fetchMonthlyListeners(spotifyId: string): Promise<number | null> {
  for (let attempt = 0; attempt < CRAWLER_UAS.length; attempt++) {
    try {
      const res = await fetch(`https://open.spotify.com/artist/${spotifyId}`, {
        headers: { 'User-Agent': CRAWLER_UAS[attempt], 'Accept-Language': 'en' },
        signal: AbortSignal.timeout(10_000),
        cache: 'no-store',
      })
      if (!res.ok) continue
      const listeners = parseListeners((await res.text()).match(OG_DESC)?.[1] ?? '')
      if (listeners != null) return listeners
    } catch {
      // try the next UA
    }
  }
  return null
}

/**
 * Listeners → opening index. Calibrated against the existing catalog, where
 * the ratio is tightly clustered (Drake 1.82M/pt, Bad Bunny 1.97M/pt, Ye
 * 2.15M/pt — median 1.89M/pt), so newly listed artists land on the same
 * scale as everyone already trading.
 */
export const LISTENERS_PER_INDEX_POINT = 1_890_000

/**
 * Lowest index any writer publishes: one millionth, the 6-dp resolution. An
 * epsilon so the price is never zero, NOT a pricing floor — the old 0.01
 * froze every artist under ~20k listeners at a fake price. Keep in sync with
 * the poller (sonotrade/index), scraper/src/index-math.ts and the DB clamp
 * trigger (sql/20260906_index_floor_epsilon.sql).
 */
export const MIN_INDEX_VALUE = 0.000001

export function seedIndexFromListeners(listeners: number): number {
  return Math.max(MIN_INDEX_VALUE, Math.round((listeners / LISTENERS_PER_INDEX_POINT) * 1e6) / 1e6)
}
