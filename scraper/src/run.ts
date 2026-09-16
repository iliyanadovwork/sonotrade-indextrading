import { config } from './config.ts'
import { fetchArtists, fetchArtistsByIds, fetchHotArtistIds, ingest } from './db.ts'
import { nextIndex } from './index-math.ts'
import { spotifyMetaSource } from './sources/spotify-meta.ts'
import { apifySource } from './sources/apify.ts'

async function main() {
  const source = config.signalSource === 'apify' ? apifySource : spotifyMetaSource
  console.log(`[scraper] source=${source.name} dryRun=${config.dryRun} limit=${config.limit || 'ALL'}`)

  let artists = config.artistIds.length
    ? await fetchArtistsByIds(config.artistIds)
    : await fetchArtists(config.limit)

  // 'hot' scope: restrict the whole run to the traded tier. The long tail is
  // refreshed lazily when someone actually opens the profile, so we neither
  // pay for nor hammer Spotify over ~2,400 artists nobody is looking at.
  if (config.scope === 'hot' && !config.artistIds.length && config.apifyTopN > 0) {
    const hot = await fetchHotArtistIds(config.apifyTopN)
    artists = artists.filter(a => hot.has(a.spotify_id))
  }
  console.log(`[scraper] loaded ${artists.length} artists (scope=${config.scope})`)

  // Tiered sourcing: the hot list (held positions + top volume) gets exact
  // counts from Apify; everyone else uses the free rounded source. When
  // APIFY_TOP_N=0 or SIGNAL_SOURCE is pinned, this collapses to one source.
  const listeners = new Map<string, number>()
  const allIds = artists.map(a => a.spotify_id)
  let hotIds: string[] = []

  if (config.apifyTopN > 0 && config.signalSource !== 'apify' && config.apifyToken) {
    const hot = await fetchHotArtistIds(config.apifyTopN)
    hotIds = allIds.filter(id => hot.has(id))
    if (hotIds.length) {
      console.log(`[scraper] tier 1 (exact/apify): ${hotIds.length} artists ≈ $${(hotIds.length * 0.005).toFixed(2)}`)
      const exact = await apifySource.fetchListeners(hotIds, (d, t) =>
        console.log(`[scraper] apify ${d}/${t}`))
      for (const [k, v] of exact) listeners.set(k, v)
    }
  }

  const restIds = allIds.filter(id => !listeners.has(id))
  if (restIds.length) {
    console.log(`[scraper] tier 2 (free): ${restIds.length} artists`)
    const rough = await source.fetchListeners(restIds, (d, t) =>
      console.log(`[scraper] fetched ${d}/${t}`))
    for (const [k, v] of rough) listeners.set(k, v)
  }
  console.log(`[scraper] signals resolved for ${listeners.size}/${artists.length} artists`)

  let ok = 0, skipped = 0, failed = 0, clampedCount = 0
  for (const a of artists) {
    const newListeners = listeners.get(a.spotify_id)
    if (newListeners == null) { skipped++; continue }

    const prevIndex = a.current_index_value ?? 50 // unlisted-index fallback baseline
    // BASELINE_ONLY: store today's listeners, leave the index untouched
    // (pass prevListeners=null → nextIndex returns prevIndex unchanged).
    const step = nextIndex(
      prevIndex,
      config.baselineOnly ? null : a.monthly_listeners,
      newListeners,
      config.sensitivity,
      config.maxDailyMove,
    )
    if (step.clamped) {
      clampedCount++
      console.warn(`[scraper] CLAMPED ${a.artist_name}: listeners ${a.monthly_listeners} → ${newListeners}`)
    }

    if (config.dryRun) {
      console.log(`  [dry] ${a.artist_name}: listeners=${newListeners} index ${prevIndex} → ${step.index} (${(step.applied * 100).toFixed(3)}%)`)
      ok++
      continue
    }
    try {
      await ingest({
        spotify_id: a.spotify_id,
        artist_name: a.artist_name,
        monthly_listeners: newListeners,
        index: step.index,
      })
      ok++
    } catch (err) {
      failed++
      console.error(`  ingest failed: ${(err as Error).message}`)
    }
  }

  console.log(`[scraper] done: ok=${ok} skipped=${skipped} failed=${failed} clamped=${clampedCount}`)
  // Fail the CI run loudly when a large share of the catalog didn't resolve —
  // that's the "Spotify started blocking us" signal. Flip SIGNAL_SOURCE=apify.
  const failureShare = (skipped + failed) / Math.max(artists.length, 1)
  if (failureShare > 0.2) {
    console.error(`[scraper] failure share ${(failureShare * 100).toFixed(1)}% > 20% — investigate (blocked?)`)
    process.exit(1)
  }
}

main().catch(err => { console.error(err); process.exit(1) })
