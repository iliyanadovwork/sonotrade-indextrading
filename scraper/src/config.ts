// Environment-driven config. Secrets come from the environment (GitHub
// Actions secrets in CI, your shell locally) — never hardcode them here.

function required(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing required env var: ${name}`)
  return v
}

export const config = {
  supabaseUrl: required('SUPABASE_URL').replace(/\/$/, ''),
  serviceKey: required('SUPABASE_SERVICE_ROLE_KEY'),

  /** 'meta' = free crawler-UA og:description route (default). 'apify' = rented actor fallback. */
  signalSource: (process.env.SIGNAL_SOURCE ?? 'meta') as 'meta' | 'apify',
  /**
   * Tiering: the N most-traded artists get EXACT listener counts from Apify;
   * everyone else uses the free (3-significant-figure) source.
   *
   * Why: real daily listener moves are ~0.13%, but the free source's rounding
   * step is 0.11–0.81% — so the traded artists would sit visibly frozen most
   * days. Exact data is only worth paying for where people hold positions.
   * 75 artists ≈ $0.38/day ≈ $11.25/month at $0.005/artist.
   * Set 0 to disable (everything free).
   */
  apifyTopN: Number(process.env.APIFY_TOP_N ?? 0),
  /**
   * 'hot' = only scrape the apifyTopN tier (traded artists). 'all' = the whole
   * catalog.
   *
   * Default is 'hot': scraping 2,493 artists daily to serve ~26 users means
   * almost every request is for an artist nobody will look at. The long tail
   * is refreshed on demand instead (POST /api/artists/refresh, fired when a
   * profile is actually opened), and any artist someone opens a position on is
   * promoted into the hot tier automatically on the next run.
   */
  scope: (process.env.SCRAPE_SCOPE ?? 'hot') as 'hot' | 'all',
  apifyToken: process.env.APIFY_TOKEN ?? '',
  apifyActor: process.env.APIFY_ACTOR ?? 'beatanalytics~spotify-play-count-scraper',

  /** Max artists this run (0 = all). Use LIMIT=25 for cheap test runs. */
  limit: Number(process.env.LIMIT ?? 0),
  /**
   * Comma-separated spotify_ids to scrape instead of the whole catalog.
   * Powers single-artist runs and the tiered schedule (hot artists daily,
   * long tail weekly) without paying for the full 2,493 every time.
   */
  artistIds: (process.env.ARTIST_IDS ?? '').split(',').map(s => s.trim()).filter(Boolean),
  /** Parallel fetches against Spotify. Keep modest — we are a polite guest. */
  concurrency: Number(process.env.CONCURRENCY ?? 4),
  /** Compute + log everything, write nothing. */
  dryRun: process.env.DRY_RUN === '1',

  /**
   * Index sensitivity: index_t = index_{t-1} * (1 + K * pctChange(listeners)).
   * K=1 → a 1% listener move is a 1% index move.
   */
  sensitivity: Number(process.env.INDEX_SENSITIVITY ?? 1.0),
  /**
   * Revival mode: record today's listeners as each artist's baseline WITHOUT
   * moving the index. The stored monthly_listeners are ~6 weeks stale (feed
   * froze 2026-06-13), so the first live run would otherwise apply six weeks
   * of drift as a single-day shock (dry run showed ±25% jumps). Run once with
   * BASELINE_ONLY=1, then daily normally.
   */
  baselineOnly: process.env.BASELINE_ONLY === '1',
  /**
   * Per-run clamp on listener pct change (fraction). Protects the index from
   * parse glitches / upstream anomalies: a "±60%" overnight swing is far more
   * likely a bug than reality. Clamped moves are logged loudly.
   */
  maxDailyMove: Number(process.env.MAX_DAILY_MOVE ?? 0.25),
}
