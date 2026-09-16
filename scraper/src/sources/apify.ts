import { config } from '../config.ts'
import type { SignalSource } from './types.ts'

// Fallback source: the rented Apify actor (residential proxies). Requires:
//   1. Renting the actor in the Apify console (it 403s otherwise):
//      https://console.apify.com/actors/gHQGvgLYfHjgMRL3t
//   2. SIGNAL_SOURCE=apify and APIFY_TOKEN in the environment.
// Runs in chunks; each chunk is one actor run whose dataset we collect.

const CHUNK = 200

// Field names vary by actor, so accept every spelling seen in the wild:
//  - augeas/spotify-monthly-listeners      → artist_id + monthlyListeners
//  - beatanalytics/spotify-play-count-...  → url/id + monthlyListeners
interface ApifyItem {
  url?: string
  id?: string
  artistId?: string
  artist_id?: string
  monthlyListeners?: number
  monthly_listeners?: number
  monthly_listener_count?: number
  listeners?: number
}

async function runChunk(ids: string[]): Promise<Map<string, number>> {
  // Input shape differs per actor, so build it from the configured actor:
  //  - augeas/spotify-monthly-listeners:      startUrls + maxDepth/maxArtists
  //  - beatanalytics/spotify-play-count-scraper: urls + follow* flags
  // In both cases we want ARTIST-LEVEL data only and never any crawl
  // expansion — related artists / albums / singles each bill as extra units.
  const urls = ids.map(id => ({ url: `https://open.spotify.com/artist/${id}` }))
  const input = config.apifyActor.includes('spotify-monthly-listeners')
    ? { startUrls: urls, flatten: 'artists', maxDepth: 0, maxArtists: ids.length }
    : { urls, followAlbums: false, followSingles: false, followPopularReleases: false }
  const res = await fetch(
    `https://api.apify.com/v2/acts/${config.apifyActor}/run-sync-get-dataset-items?token=${config.apifyToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(300_000),
    },
  )
  if (!res.ok) throw new Error(`Apify run failed: HTTP ${res.status} ${await res.text()}`)
  const items = (await res.json()) as ApifyItem[]
  const out = new Map<string, number>()
  for (const it of items) {
    const id = it.artist_id ?? it.artistId ?? it.id ?? it.url?.match(/artist\/([A-Za-z0-9]+)/)?.[1]
    const listeners =
      it.monthlyListeners ?? it.monthly_listeners ?? it.monthly_listener_count ?? it.listeners
    if (id && typeof listeners === 'number') out.set(id, listeners)
  }
  if (out.size === 0 && items.length > 0) {
    // Field names vary by actor — surface the real shape instead of silently
    // reporting "0 resolved".
    console.error('[apify] no listeners parsed; sample item:', JSON.stringify(items[0]).slice(0, 500))
  }
  return out
}

export const apifySource: SignalSource = {
  name: 'apify',
  async fetchListeners(ids, onProgress) {
    if (!config.apifyToken) throw new Error('SIGNAL_SOURCE=apify requires APIFY_TOKEN')
    const out = new Map<string, number>()
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK)
      const m = await runChunk(chunk)
      for (const [k, v] of m) out.set(k, v)
      onProgress?.(Math.min(i + CHUNK, ids.length), ids.length)
    }
    return out
  },
}
