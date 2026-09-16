// Wikipedia biography fallback. SERVER ONLY.
//
// Spotify's biography field is whatever the artist typed, and for most small
// acts that's emoji, booking emails, or nothing ("💒💗💐", "333"). Wikipedia
// has real prose for a surprising share of them — including fairly obscure
// artists — so it fills the About section when Spotify's own bio is unusable.
//
// Content is CC BY-SA; surface attribution alongside the text if you display
// it prominently.

const API = 'https://en.wikipedia.org/w/api.php'
const SUMMARY = 'https://en.wikipedia.org/api/rest_v1/page/summary'

/** Words that mark a summary as being about a musician rather than a namesake. */
const MUSIC_TERMS = /\b(singer|rapper|musician|producer|band|dj|songwriter|composer|duo|group|music|recording artist|vocalist)\b/i

/**
 * A Spotify bio counts as unusable when it's too short to be prose, or has no
 * sentence structure — emoji strings, "333", and booking-contact blurbs all
 * fail this, while a real paragraph passes.
 */
export function isUsableBio(bio: string | null | undefined): boolean {
  if (!bio) return false
  const text = bio.replace(/<[^>]+>/g, '').replace(/&#x[0-9a-f]+;|&#\d+;/gi, '').trim()

  // Booking/management blurbs are the most common non-bio: they're long
  // enough and contain periods (from email addresses), so length-and-
  // punctuation checks alone let them through.
  if (/\S+@\S+\.\S+/.test(text)) return false

  // Prose has many multi-letter words; "333", emoji strings, and handle lists
  // do not.
  const words = text.split(/\s+/).filter(w => /[a-zA-Z]{2,}/.test(w))
  if (words.length < 20) return false

  return /[.!?]/.test(text)
}

async function findPageTitle(artistName: string): Promise<string | null> {
  const url = `${API}?action=query&list=search&srsearch=${encodeURIComponent(
    `${artistName} musician`,
  )}&srlimit=3&format=json&origin=*`
  const res = await fetch(url, { next: { revalidate: 86_400 } })
  if (!res.ok) return null
  const json = (await res.json()) as { query?: { search?: { title: string }[] } }
  return json.query?.search?.[0]?.title ?? null
}

/**
 * Best-effort biography for an artist. Returns null when no confident
 * music-related match exists — a wrong bio is worse than none.
 */
export async function fetchWikipediaBio(artistName: string): Promise<string | null> {
  try {
    const title = await findPageTitle(artistName)
    if (!title) return null

    const res = await fetch(`${SUMMARY}/${encodeURIComponent(title)}`, {
      next: { revalidate: 86_400 },
    })
    if (!res.ok) return null
    const json = (await res.json()) as { extract?: string; type?: string; title?: string }
    const extract = json.extract?.trim()
    if (!extract || json.type === 'disambiguation') return null

    // Guard against namesakes: "Wisp" could be a will-o'-the-wisp article, and
    // plenty of artist names collide with common nouns. Require both a music
    // term and the artist's name to appear.
    const firstWord = artistName.split(/\s+/)[0]?.toLowerCase() ?? ''
    if (!MUSIC_TERMS.test(extract)) return null
    if (firstWord.length > 2 && !extract.toLowerCase().includes(firstWord)) return null

    return extract
  } catch {
    return null
  }
}
