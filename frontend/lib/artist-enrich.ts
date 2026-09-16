import { getSpotifyArtistImages, getSpotifyArtistReleases, isSpotifyConfigured } from '@/lib/spotify'
import { fetchWikipediaBio, isUsableBio } from '@/lib/wikipedia-bio'
// Content enrichment for newly listed artists. SERVER ONLY.
//
// Listing an artist from search creates a market, but the About section reads
// biography / top_cities / releases / top_tracks / gallery. Sources are split
// by what each can actually supply (see fetchArtistContent below): the free
// official API covers gallery + releases, and Apify fills the rest.
//
// Best-effort by design: if a source is unavailable the artist is still listed
// and tradeable, just with a sparser About section.

interface ApifyArtistDetail {
  biography?: string
  followers?: number
  monthlyListeners?: number
  worldRank?: number
  topCities?: { city?: string; country?: string; numberOfListeners?: number }[]
  topTracks?: { id?: string; name?: string; streamCount?: number; duration?: number }[]
  popularReleases?: { id?: string; name?: string; type?: string; releaseDate?: string }[]
  albums?: { id?: string; name?: string; type?: string; releaseDate?: string }[]
  singles?: { id?: string; name?: string; type?: string; releaseDate?: string }[]
  coverArt?: { url?: string; width?: number; height?: number }[]
  externalLinks?: { label?: string; url?: string }[]
}

/** Columns on artists_with_history that the About section renders. */
export interface ArtistContent {
  biography?: string | null
  top_cities?: unknown[]
  top_tracks?: unknown[]
  releases?: unknown[]
  gallery?: string[]
  followers?: number | null
  /** Social handles, mapped from the actor's externalLinks. */
  instagram?: string | null
  twitter?: string | null
  tiktok?: string | null
  facebook?: string | null
}

/** Pick a social URL out of the actor's externalLinks by label. */
function linkFor(links: { label?: string; url?: string }[] | undefined, name: string): string | null {
  return links?.find(l => (l.label ?? '').toLowerCase() === name)?.url ?? null
}

const ACTOR = process.env.APIFY_ACTOR ?? 'beatanalytics~spotify-play-count-scraper'

/**
 * Map the actor payload onto the shapes the existing catalog already uses, so
 * a newly listed artist renders identically to one the old scraper ingested.
 */
function mapContent(d: ApifyArtistDetail, spotifyId: string): ArtistContent {
  const releasesRaw = [
    ...(d.popularReleases ?? []),
    ...(d.albums ?? []),
    ...(d.singles ?? []),
  ]
  // De-dupe: popularReleases overlaps albums/singles.
  const seen = new Set<string>()
  const releases = releasesRaw
    .filter(r => r.id && !seen.has(r.id) && seen.add(r.id))
    .slice(0, 30)
    .map(r => ({
      id: r.id,
      name: r.name,
      // Existing rows use uppercase type ("ALBUM") and a `date` key.
      type: (r.type ?? '').toUpperCase(),
      date: r.releaseDate ?? null,
      url: r.id ? `https://open.spotify.com/album/${r.id}` : null,
      image: null as string | null,
    }))

  return {
    biography: d.biography ?? null,
    top_cities: (d.topCities ?? []).slice(0, 10),
    top_tracks: (d.topTracks ?? []).slice(0, 10).map(t => ({
      id: t.id,
      name: t.name,
      // Existing rows carry these keys; the actor doesn't provide per-track
      // art or album linkage, so they stay null rather than faked.
      album: null,
      image: null,
      artists: null,
      duration: t.duration ?? null,
      streamCount: t.streamCount ?? null,
    })),
    releases,
    gallery: (d.coverArt ?? []).map(c => c.url).filter((u): u is string => Boolean(u)).slice(0, 8),
    followers: d.followers ?? null,
    instagram: linkFor(d.externalLinks, 'instagram'),
    twitter: linkFor(d.externalLinks, 'twitter') ?? linkFor(d.externalLinks, 'x'),
    tiktok: linkFor(d.externalLinks, 'tiktok'),
    facebook: linkFor(d.externalLinks, 'facebook'),
  }
}

/**
 * Full About-section content for one artist, from the cheapest source that
 * can supply each field.
 *
 * The official Spotify API is preferred wherever it works — it's free, and its
 * release list even carries cover art the Apify actor omits. But this app's
 * credentials hit Spotify's 2024 restrictions: /top-tracks and
 * /related-artists return 403, and /artists omits followers. Biography and
 * top-cities aren't in the official API at all. So Apify fills only what
 * Spotify won't give:
 *
 *   Spotify (free) → gallery, releases
 *   Apify (~$0.004, once) → biography, top_cities, top_tracks, followers
 *
 * With no Apify token you still get gallery + releases, so the About section
 * is never empty.
 */
export async function fetchArtistContent(spotifyId: string, artistName?: string): Promise<ArtistContent | null> {
  const [spotifyPart, apifyPart] = await Promise.all([
    fetchSpotifyContent(spotifyId),
    fetchApifyContent(spotifyId),
  ])
  if (!spotifyPart && !apifyPart) return null

  // The "Apify bio" IS the Spotify bio — the actor scrapes the artist page,
  // where the text is author-supplied. Smaller acts routinely leave it as
  // emoji, a booking email, or "333". Try Wikipedia prose instead, and if that
  // has nothing either, store NULL rather than the junk: the About card omits
  // the paragraph when there's no bio, which reads as intentional, whereas
  // rendering "333" as a biography reads as broken.
  const rawBio = apifyPart?.biography ?? null
  let biography = isUsableBio(rawBio) ? rawBio : null
  if (!biography && artistName) {
    biography = await fetchWikipediaBio(artistName)
  }

  return {
    biography,
    top_cities: apifyPart?.top_cities ?? [],
    top_tracks: apifyPart?.top_tracks ?? [],
    followers: apifyPart?.followers ?? null,
    // Spotify preferred (has artwork); fall back to Apify's barer version
    releases: spotifyPart?.releases?.length ? spotifyPart.releases : (apifyPart?.releases ?? []),
    gallery: spotifyPart?.gallery?.length ? spotifyPart.gallery : (apifyPart?.gallery ?? []),
    instagram: apifyPart?.instagram ?? null,
    twitter: apifyPart?.twitter ?? null,
    tiktok: apifyPart?.tiktok ?? null,
    facebook: apifyPart?.facebook ?? null,
  }
}

/**
 * Fast half only — the free Spotify calls (~1.5s).
 *
 * Listing blocks on this so the market opens quickly with artwork and
 * releases; the slow Apify half (bio/cities/tracks, ~5s) is filled in
 * afterwards by the refresh endpoint, which the profile page triggers on
 * mount. See app/api/artists/list/route.ts.
 */
export async function fetchFastContent(spotifyId: string): Promise<ArtistContent | null> {
  return fetchSpotifyContent(spotifyId)
}

/** Free tier: everything the official API will still serve. */
async function fetchSpotifyContent(spotifyId: string): Promise<ArtistContent | null> {
  if (!isSpotifyConfigured()) return null
  try {
    const [gallery, releases] = await Promise.all([
      getSpotifyArtistImages(spotifyId),
      getSpotifyArtistReleases(spotifyId),
    ])
    return { gallery, releases }
  } catch (err) {
    console.error('[enrich] spotify content failed', err)
    return null
  }
}

/** Paid tier: biography / top cities / top tracks / followers. */
async function fetchApifyContent(spotifyId: string): Promise<ArtistContent | null> {
  const token = process.env.APIFY_TOKEN
  if (!token) return null
  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls: [{ url: `https://open.spotify.com/artist/${spotifyId}` }],
          // Every followed release is another billed unit — artist page only.
          followAlbums: false,
          followSingles: false,
          followPopularReleases: false,
        }),
        signal: AbortSignal.timeout(120_000),
        cache: 'no-store',
      },
    )
    if (!res.ok) {
      console.error(`[enrich] apify ${res.status} for ${spotifyId}`)
      return null
    }
    const items = (await res.json()) as ApifyArtistDetail[]
    if (!items.length) return null
    return mapContent(items[0], spotifyId)
  } catch (err) {
    console.error('[enrich] failed', err)
    return null
  }
}
