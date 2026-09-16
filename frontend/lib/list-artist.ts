/**
 * Create a market for a Spotify artist that isn't listed yet.
 *
 * Search surfaces every artist on Spotify, not just the ones we track — so
 * opening an unlisted result has to mint its market first. The endpoint is
 * idempotent, so double-taps and two users racing on the same artist are
 * both safe.
 */

export type ListArtistResult =
  /** The artist is listed (already was, or now is). Safe to navigate. */
  | { ok: true }
  /**
   * Anonymous listing is allowed (throttled per IP), so a 401 should no
   * longer occur — kept so callers still handle a future tightening.
   */
  | { ok: false; reason: 'auth_required' }
  | { ok: false; reason: 'rate_limited' }
  | { ok: false; reason: 'failed' }

export async function ensureArtistListed(spotifyId: string): Promise<ListArtistResult> {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
    const res = await fetch('/api/artists/list', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ spotify_id: spotifyId }),
    })
    if (res.ok) return { ok: true }
    if (res.status === 401) return { ok: false, reason: 'auth_required' }
    if (res.status === 429) return { ok: false, reason: 'rate_limited' }
    return { ok: false, reason: 'failed' }
  } catch {
    return { ok: false, reason: 'failed' }
  }
}
