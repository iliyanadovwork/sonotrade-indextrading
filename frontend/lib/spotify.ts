// Official Spotify Web API client (client-credentials flow) — SERVER ONLY.
//
// Used to search Spotify's full catalog so users can list and trade artists
// that aren't in our DB yet. The official API is free, legal, and stable; it
// does NOT expose monthly listeners (that's what the scraper is for), but it
// gives us identity: id, name, image, followers, popularity — everything
// needed to create the market.

const TOKEN_URL = 'https://accounts.spotify.com/api/token'
const API = 'https://api.spotify.com/v1'

let cachedToken: { value: string; expiresAt: number } | null = null

async function getToken(): Promise<string> {
  const id = process.env.SPOTIFY_CLIENT_ID
  const secret = process.env.SPOTIFY_CLIENT_SECRET
  if (!id || !secret) throw new Error('SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET not set')

  // Reuse until 60s before expiry — tokens last an hour, and re-minting on
  // every keystroke of a search box would rate-limit us fast.
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) return cachedToken.value

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Spotify token failed: ${res.status}`)
  const json = (await res.json()) as { access_token: string; expires_in: number }
  cachedToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 }
  return cachedToken.value
}

export interface SpotifyArtist {
  id: string
  name: string
  image_url: string | null
  followers: number | null
  popularity: number | null
  genres: string[]
}

function mapArtist(a: Record<string, unknown>): SpotifyArtist {
  const images = (a.images as { url: string }[] | undefined) ?? []
  return {
    id: String(a.id),
    name: String(a.name),
    // images are ordered largest-first; take a mid-size one when present
    image_url: images[1]?.url ?? images[0]?.url ?? null,
    followers: (a.followers as { total?: number } | undefined)?.total ?? null,
    popularity: typeof a.popularity === 'number' ? a.popularity : null,
    genres: (a.genres as string[] | undefined) ?? [],
  }
}

/**
 * Search Spotify's catalog for artists by name.
 *
 * NB: `limit` is clamped to 1–10. Spotify's docs still say the max is 50, but
 * as of 2026-07 anything above 10 returns 400 "Invalid limit", and a limit of
 * 0 is rejected too — so callers passing a computed "slots remaining" must
 * not be able to send either.
 */
export async function searchSpotifyArtists(q: string, limit = 10): Promise<SpotifyArtist[]> {
  const token = await getToken()
  const safeLimit = Math.max(1, Math.min(Math.floor(limit) || 1, 10))
  const url = `${API}/search?q=${encodeURIComponent(q)}&type=artist&limit=${safeLimit}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    // Spotify's catalog barely changes; cache identical queries briefly so a
    // typed search doesn't hammer the API.
    next: { revalidate: 300 },
  })
  if (!res.ok) throw new Error(`Spotify search failed: ${res.status}`)
  const json = (await res.json()) as { artists?: { items?: Record<string, unknown>[] } }
  return (json.artists?.items ?? []).map(mapArtist)
}

/** Fetch one artist by Spotify ID — used when listing a new market. */
export async function getSpotifyArtist(id: string): Promise<SpotifyArtist | null> {
  const token = await getToken()
  const res = await fetch(`${API}/artists/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Spotify artist fetch failed: ${res.status}`)
  return mapArtist((await res.json()) as Record<string, unknown>)
}

export function isSpotifyConfigured(): boolean {
  return Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET)
}

/** All artist images, largest first — used to seed the About gallery. */
export async function getSpotifyArtistImages(id: string): Promise<string[]> {
  const token = await getToken()
  const res = await fetch(`${API}/artists/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 86_400 },
  })
  if (!res.ok) return []
  const json = (await res.json()) as { images?: { url: string }[] }
  return (json.images ?? []).map(i => i.url).filter(Boolean)
}

/**
 * Albums + singles, newest first, in the shape the catalog already stores
 * (uppercase type, `date`, `url`, `image`).
 *
 * Preferred over the Apify equivalent because this includes cover art, which
 * the actor's release list omits.
 */
export async function getSpotifyArtistReleases(id: string, limit = 10) {
  const token = await getToken()
  // Same 10-item ceiling as /search: this app's credentials 400 with
  // "Invalid limit" above 10 on every paged endpoint, despite the docs
  // advertising 50. Silently returning [] here would make callers fall back
  // to a worse source, so the cap is enforced rather than requested.
  const res = await fetch(
    `${API}/artists/${encodeURIComponent(id)}/albums` +
      `?include_groups=album,single&limit=${Math.max(1, Math.min(limit, 10))}&market=US`,
    { headers: { Authorization: `Bearer ${token}` }, next: { revalidate: 86_400 } },
  )
  if (!res.ok) return []
  const json = (await res.json()) as {
    items?: {
      id: string; name: string; album_type?: string; release_date?: string
      images?: { url: string }[]; external_urls?: { spotify?: string }
    }[]
  }
  const seen = new Set<string>()
  return (json.items ?? [])
    .filter(a => a.id && !seen.has(a.id) && seen.add(a.id))
    .map(a => ({
      id: a.id,
      name: a.name,
      type: (a.album_type ?? '').toUpperCase(),
      date: a.release_date ?? null,
      url: a.external_urls?.spotify ?? `https://open.spotify.com/album/${a.id}`,
      image: a.images?.[0]?.url ?? null,
    }))
    .sort((x, y) => String(y.date ?? '').localeCompare(String(x.date ?? '')))
}
