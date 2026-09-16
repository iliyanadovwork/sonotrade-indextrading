import { parseListeners } from '../index-math.ts'
import { config } from '../config.ts'
import type { SignalSource } from './types.ts'

// Spotify serves artist metadata (incl. monthly listeners) in og: meta tags
// to link-preview crawlers — a plain browser UA gets the empty SPA shell
// instead. Verified live 2026-07-28: all three UAs below return
// `og:description content="Artist · 91.2M monthly listeners."`.
const CRAWLER_UAS = [
  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  'Twitterbot/1.0',
  'WhatsApp/2.19.81 A',
]

const OG_DESC = /property="og:description"\s+content="([^"]*)"/

async function fetchOne(spotifyId: string, attempt = 0): Promise<number | null> {
  const ua = CRAWLER_UAS[attempt % CRAWLER_UAS.length]
  try {
    const res = await fetch(`https://open.spotify.com/artist/${spotifyId}`, {
      headers: { 'User-Agent': ua, 'Accept-Language': 'en' },
      signal: AbortSignal.timeout(15_000),
    })
    if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`)
    if (!res.ok) return null // 404 etc — artist gone; skip, don't retry
    const html = await res.text()
    const desc = html.match(OG_DESC)?.[1] ?? ''
    return parseListeners(desc)
  } catch (err) {
    if (attempt < 2) {
      // Exponential backoff + next UA in the rotation.
      await new Promise(r => setTimeout(r, 1000 * 2 ** attempt))
      return fetchOne(spotifyId, attempt + 1)
    }
    console.error(`  fetch failed for ${spotifyId}: ${(err as Error).message}`)
    return null
  }
}

export const spotifyMetaSource: SignalSource = {
  name: 'spotify-meta',
  async fetchListeners(ids, onProgress) {
    const out = new Map<string, number>()
    let cursor = 0
    let done = 0
    // Simple worker pool — config.concurrency parallel fetches, ~250ms
    // spacing per worker keeps us at a polite handful of requests/second.
    const worker = async () => {
      while (cursor < ids.length) {
        const id = ids[cursor++]
        const listeners = await fetchOne(id)
        if (listeners != null) out.set(id, listeners)
        done++
        if (done % 100 === 0) onProgress?.(done, ids.length)
        await new Promise(r => setTimeout(r, 250))
      }
    }
    await Promise.all(Array.from({ length: config.concurrency }, worker))
    return out
  },
}
