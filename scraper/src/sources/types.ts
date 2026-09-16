/**
 * A signal source resolves spotify artist IDs → current monthly listeners.
 * Two implementations:
 *   - spotify-meta (default): free, plain GETs with link-preview UAs
 *   - apify (fallback): rented Apify actor behind residential proxies —
 *     switch with SIGNAL_SOURCE=apify if Spotify ever blocks the free route.
 * Returning a Map lets batch-oriented sources (apify) resolve many IDs per
 * upstream call while the per-page source streams through a worker pool.
 */
export interface SignalSource {
  name: string
  fetchListeners(spotifyIds: string[], onProgress?: (done: number, total: number) => void): Promise<Map<string, number>>
}
