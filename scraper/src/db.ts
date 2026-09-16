import { config } from './config.ts'

// Thin Supabase PostgREST client using the service-role key (bypasses RLS —
// this is exactly what the key is for; the anon-INSERT policies that let the
// OLD scraper write were deliberately dropped in the RLS hardening pass).

function headers(): Record<string, string> {
  return {
    apikey: config.serviceKey,
    Authorization: `Bearer ${config.serviceKey}`,
    'Content-Type': 'application/json',
  }
}

export interface ArtistState {
  spotify_id: string
  artist_name: string
  current_index_value: number | null
  monthly_listeners: number | null
}

const SLIM = 'spotify_id,artist_name,current_index_value,monthly_listeners'

/**
 * The "hot" tier that gets exact (paid) listener data: artists people
 * actually hold positions in, topped up to `n` by trading volume. Positions
 * come first because a stale price on a held position is the one that
 * actually costs a user money.
 */
export async function fetchHotArtistIds(n: number): Promise<Set<string>> {
  const hot = new Set<string>()
  if (n <= 0) return hot

  // 1. every artist with an open position
  const posRes = await fetch(
    `${config.supabaseUrl}/rest/v1/positions?select=spotify_id&status=eq.open`,
    { headers: headers() },
  )
  if (posRes.ok) {
    for (const r of (await posRes.json()) as { spotify_id: string }[]) hot.add(r.spotify_id)
  }

  // 2. top up by volume until we hit n
  const volRes = await fetch(
    `${config.supabaseUrl}/rest/v1/artists_with_history` +
      `?select=spotify_id&order=volume.desc.nullslast,spotify_id.asc&limit=${n}`,
    { headers: headers() },
  )
  if (volRes.ok) {
    for (const r of (await volRes.json()) as { spotify_id: string }[]) {
      if (hot.size >= n) break
      hot.add(r.spotify_id)
    }
  }
  return hot
}

/** Fetch a specific set of artists by spotify_id (ARTIST_IDS runs). */
export async function fetchArtistsByIds(ids: string[]): Promise<ArtistState[]> {
  const list = ids.map(encodeURIComponent).join(',')
  const res = await fetch(
    `${config.supabaseUrl}/rest/v1/artists_with_history?select=${SLIM}&spotify_id=in.(${list})`,
    { headers: headers() },
  )
  if (!res.ok) throw new Error(`fetchArtistsByIds failed: HTTP ${res.status}`)
  return (await res.json()) as ArtistState[]
}

/** Page through all artists — slim columns only (data_points never leaves the DB). */
export async function fetchArtists(limit: number): Promise<ArtistState[]> {
  const out: ArtistState[] = []
  const page = 1000
  for (let offset = 0; ; offset += page) {
    const res = await fetch(
      `${config.supabaseUrl}/rest/v1/artists_with_history` +
        `?select=spotify_id,artist_name,current_index_value,monthly_listeners` +
        `&order=spotify_id.asc&limit=${page}&offset=${offset}`,
      { headers: headers() },
    )
    if (!res.ok) throw new Error(`fetchArtists failed: HTTP ${res.status}`)
    const rows = (await res.json()) as ArtistState[]
    out.push(...rows)
    if (rows.length < page) break
    if (limit > 0 && out.length >= limit) break
  }
  return limit > 0 ? out.slice(0, limit) : out
}

export interface IngestRow {
  spotify_id: string
  artist_name: string
  monthly_listeners: number
  index: number
}

/**
 * One RPC per artist: appends the data_points entry, refreshes
 * current_index_value / change_* / monthly_listeners / last_updated, and
 * inserts the artist_daily_streams observation — all inside the database, so
 * the 70KB+ data_points jsonb never crosses the network.
 * (SQL: scraper/sql/20260728_scraper_ingest.sql — apply via the SQL editor.)
 */
export async function ingest(row: IngestRow): Promise<void> {
  const res = await fetch(`${config.supabaseUrl}/rest/v1/rpc/scraper_ingest`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      p_spotify_id: row.spotify_id,
      p_artist_name: row.artist_name,
      p_monthly_listeners: row.monthly_listeners,
      p_index: row.index,
    }),
  })
  if (!res.ok) {
    throw new Error(`scraper_ingest(${row.spotify_id}) failed: HTTP ${res.status} ${await res.text()}`)
  }
}
