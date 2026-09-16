// Data layer — makes the SAME requests the Sonotrade frontend makes.
// The app's API routes (app/api/trade, app/api/markets/[ticker]/history) all
// funnel to Supabase PostgREST on the `artists_with_history` table with the
// anon key; we hit the identical URLs here and reuse the app's mapping logic.

const SUPABASE_URL =
  process.env.REMOTION_SUPABASE_URL ?? "https://zvgsjbphobukppeyymfp.supabase.co";
const ANON_KEY = process.env.REMOTION_SUPABASE_ANON_KEY ?? "";

const HEADERS = {
  apikey: ANON_KEY,
  Authorization: `Bearer ${ANON_KEY}`,
};

export type PricePoint = { price: number; timestamp: number };

export type Release = {
  id: string;
  name: string;
  date: string | null;
  type: string | null;
  image: string | null;
  url?: string;
  tracks?: number;
};

export type Track = {
  id: string;
  name: string;
  image: string | null;
  playcount: number;
};

export type City = {
  city: string;
  region?: string;
  country?: string;
  numberOfListeners: number;
};

export type TourEvent = {
  name?: string;
  date?: string;
  venue?: string;
  city?: string;
  url?: string;
};

export type ArtistLite = {
  id: string;
  name: string;
  image: string | null;
  price: number;
  change_1h: number;
  change_1d: number;
  change_1w: number;
  change_1m: number;
  volume: number;
  history: PricePoint[];
};

export type ArtistFull = ArtistLite & {
  releases: Release[];
  topTracks: Track[];
  topCities: City[];
  events: TourEvent[];
  followers: number;
  monthlyListeners: number;
  biography: string;
  gallery: string[];
  relatedIds: Array<{ id: string; name: string; image: string | null }>;
};

// Spotlight "Latest Albums" slide (mirrors /api/latest-albums shape).
export type AlbumSlide = {
  name: string;
  image: string;
  artist: string;
  date: string;
  change: number | null;
};

export type FilmData = {
  artists: ArtistLite[];
  hero: ArtistFull;
  heroRelated: ArtistLite[];
  albums: AlbumSlide[];
};

const parseJsonish = <T>(v: unknown, fallback: T): T => {
  if (v == null) return fallback;
  if (typeof v === "string") {
    try {
      return JSON.parse(v) as T;
    } catch {
      return fallback;
    }
  }
  return v as T;
};

// Mirrors app/api/markets/[ticker]/history: map data_points -> PricePoint[],
// sort, and downsample to <= 240 points.
const historyFromDataPoints = (
  dataPoints: unknown,
  maxPoints = 240,
): PricePoint[] => {
  const raw = parseJsonish<Array<{ index: unknown; timestamp: unknown }>>(
    dataPoints,
    [],
  );
  const pts = raw
    .map((dp) => ({
      price: Number(dp.index),
      timestamp: new Date(dp.timestamp as string).getTime(),
    }))
    .filter((p) => Number.isFinite(p.price) && Number.isFinite(p.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);
  if (pts.length <= maxPoints) return pts;
  const step = (pts.length - 1) / (maxPoints - 1);
  const out: PricePoint[] = [];
  for (let i = 0; i < maxPoints; i++) {
    out.push(pts[Math.round(i * step)]);
  }
  return out;
};

const LITE_COLS =
  "spotify_id,artist_name,spotify_img,current_index_value,change_1h,change_1d,change_1w,change_1m,volume,data_points";

const FULL_COLS = `${LITE_COLS},releases,top_tracks,top_cities,events,followers,monthly_listeners,biography,gallery,related`;

type Row = {
  spotify_id: string;
  artist_name: string;
  spotify_img: string | null;
  current_index_value: number | null;
  change_1h: number | null;
  change_1d: number | null;
  change_1w: number | null;
  change_1m: number | null;
  volume: number | null;
  data_points: unknown;
  releases?: unknown;
  top_tracks?: unknown;
  top_cities?: unknown;
  events?: unknown;
  followers?: number | null;
  monthly_listeners?: number | null;
  biography?: string | null;
  gallery?: unknown;
  related?: unknown;
};

const toLite = (r: Row, sparkPoints = 60): ArtistLite => ({
  id: r.spotify_id,
  name: r.artist_name,
  image: r.spotify_img,
  price: Number(r.current_index_value ?? 0),
  change_1h: Number(r.change_1h ?? 0),
  change_1d: Number(r.change_1d ?? 0),
  change_1w: Number(r.change_1w ?? 0),
  change_1m: Number(r.change_1m ?? 0),
  volume: Number(r.volume ?? 0),
  history: historyFromDataPoints(r.data_points, sparkPoints),
});

const toFull = (r: Row): ArtistFull => ({
  ...toLite(r, 240),
  releases: parseJsonish<Release[]>(r.releases, []).filter((x) => x && x.name),
  topTracks: parseJsonish<Track[]>(r.top_tracks, []).slice(0, 5),
  topCities: parseJsonish<City[]>(r.top_cities, []).slice(0, 5),
  events: parseJsonish<TourEvent[]>(r.events, []),
  followers: Number(r.followers ?? 0),
  monthlyListeners: Number(r.monthly_listeners ?? 0),
  // Bio arrives with embedded anchor tags — strip to plain text like the app.
  biography: (r.biography ?? "").replace(/<[^>]+>/g, ""),
  gallery: parseJsonish<string[]>(r.gallery, []).filter(Boolean),
  relatedIds: parseJsonish<Array<{ id: string; name: string; image: string | null }>>(
    r.related,
    [],
  ).filter((x) => x && x.id),
});

// Same request as app/api/trade/route.ts (ordered by volume, top N).
export const fetchTopArtists = async (limit = 30): Promise<ArtistLite[]> => {
  const url = `${SUPABASE_URL}/rest/v1/artists_with_history?select=${LITE_COLS}&order=volume.desc.nullslast&limit=${limit}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`artists fetch failed: ${res.status}`);
  const rows = (await res.json()) as Row[];
  return rows.map((r) => toLite(r));
};

// Same request as app/api/related: lite rows for a set of spotify_ids.
export const fetchRelated = async (
  ids: string[],
  limit = 3,
): Promise<ArtistLite[]> => {
  if (ids.length === 0) return [];
  const idList = ids.slice(0, 10).join(",");
  const url = `${SUPABASE_URL}/rest/v1/artists_with_history?select=${LITE_COLS}&spotify_id=in.(${idList})&limit=${limit}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`related fetch failed: ${res.status}`);
  const rows = (await res.json()) as Row[];
  return rows.map((r) => toLite(r));
};

// Latest albums for the Spotlight slideshow — newest release with artwork per
// top-volume artist, same table/requests as the app's /api/latest-albums.
export const fetchLatestAlbums = async (limit = 6): Promise<AlbumSlide[]> => {
  const url = `${SUPABASE_URL}/rest/v1/artists_with_history?select=artist_name,change_1m,releases&order=volume.desc.nullslast&limit=14`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`albums fetch failed: ${res.status}`);
  const rows = (await res.json()) as Array<{
    artist_name: string;
    change_1m: number | null;
    releases: unknown;
  }>;
  const albums: AlbumSlide[] = [];
  for (const r of rows) {
    const rels = parseJsonish<Release[]>(r.releases, [])
      .filter((x) => x && x.image && x.date)
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
    const newest = rels[0];
    if (newest) {
      albums.push({
        name: newest.name,
        image: newest.image as string,
        artist: r.artist_name,
        date: newest.date as string,
        change: r.change_1m == null ? null : Number(r.change_1m),
      });
    }
  }
  return albums
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
};

// Same request as lib/data.ts getProfileByTicker (full columns for one artist).
export const fetchArtistFull = async (spotifyId: string): Promise<ArtistFull> => {
  const url = `${SUPABASE_URL}/rest/v1/artists_with_history?select=${FULL_COLS}&spotify_id=eq.${spotifyId}&limit=1`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`artist fetch failed: ${res.status}`);
  const rows = (await res.json()) as Row[];
  if (!rows[0]) throw new Error(`artist not found: ${spotifyId}`);
  return toFull(rows[0]);
};

// Artists that read poorly on camera: no artwork, or artwork that renders as
// a near-blank image (Ye's current Spotify photo is a plain white gradient).
const AD_EXCLUDED_IDS = new Set(["3NlsBPwqJuDgtXZ2rv5Dmq"]);

export const filterAdArtists = (artists: ArtistLite[]): ArtistLite[] =>
  artists.filter((a) => a.image && !AD_EXCLUDED_IDS.has(a.id));

export const DEMO_EVENTS: TourEvent[] = [
  {
    name: "ICEMAN World Tour",
    date: "2026-08-14",
    venue: "Scotiabank Arena",
    city: "Toronto",
  },
  {
    name: "ICEMAN World Tour",
    date: "2026-08-21",
    venue: "Madison Square Garden",
    city: "New York",
  },
  {
    name: "ICEMAN World Tour",
    date: "2026-09-02",
    venue: "The O2",
    city: "London",
  },
];

// ---------------------------------------------------------------------------
// Deterministic fallback so the studio renders offline. No Math.random —
// Remotion frames must be reproducible.
const seeded = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
};

const synthHistory = (seed: number, base: number, n = 120): PricePoint[] => {
  const rnd = seeded(seed);
  const end = new Date("2026-07-20T00:00:00Z").getTime();
  const pts: PricePoint[] = [];
  let p = base * 0.82;
  for (let i = 0; i < n; i++) {
    p = Math.max(0.5, p + (rnd() - 0.47) * base * 0.02);
    pts.push({ price: p, timestamp: end - (n - i) * 86400000 * 3 });
  }
  pts[n - 1] = { price: base, timestamp: end };
  return pts;
};

const FALLBACK_NAMES: Array<[string, number, number]> = [
  ["Drake", 50.03, 0.29],
  ["Bruno Mars", 68.25, -0.22],
  ["Coldplay", 46.96, -0.06],
  ["Ye", 4.28, 6.35],
  ["Tame Impala", 31.65, -0.32],
  ["Taylor Swift", 82.4, 1.12],
  ["Billie Eilish", 44.1, 0.74],
  ["Kendrick Lamar", 57.8, -0.41],
  ["The Weeknd", 61.2, 0.18],
  ["Bad Bunny", 72.9, 2.03],
  ["SZA", 38.5, -1.11],
  ["Travis Scott", 41.7, 0.56],
];

export const FALLBACK_DATA: FilmData = (() => {
  const artists: ArtistLite[] = FALLBACK_NAMES.map(([name, price, chg], i) => ({
    id: `fallback-${i}`,
    name,
    image: null,
    price,
    change_1h: chg / 4,
    change_1d: chg,
    change_1w: chg * 2.1,
    change_1m: chg * 3.4,
    volume: 4200 / (i + 1),
    history: synthHistory(i + 7, price),
  }));
  const hero: ArtistFull = {
    ...artists[0],
    history: synthHistory(7, artists[0].price, 240),
    releases: [
      { id: "r1", name: "ICEMAN", date: "2026-05-15", type: "ALBUM", image: null },
      { id: "r2", name: "Some Sexy Songs 4 U", date: "2025-02-14", type: "ALBUM", image: null },
      { id: "r3", name: "For All The Dogs", date: "2023-10-06", type: "ALBUM", image: null },
    ],
    topTracks: [
      { id: "t1", name: "Janice STFU", image: null, playcount: 126249206 },
      { id: "t2", name: "NOKIA", image: null, playcount: 512348441 },
      { id: "t3", name: "God's Plan", image: null, playcount: 2913448120 },
    ],
    topCities: [
      { city: "London", region: "ENG", country: "GB", numberOfListeners: 2299129 },
      { city: "Sydney", region: "NSW", country: "AU", numberOfListeners: 1104501 },
      { city: "Toronto", region: "ON", country: "CA", numberOfListeners: 987420 },
      { city: "Chicago", region: "IL", country: "US", numberOfListeners: 902113 },
      { city: "Houston", region: "TX", country: "US", numberOfListeners: 851209 },
    ],
    events: DEMO_EVENTS,
    followers: 96421338,
    monthlyListeners: 81234410,
    biography:
      "Canadian rapper and vocalist Drake has retained a bigger-than-life commercial presence since he hit the scene, blending hip-hop and R&B into global hits.",
    gallery: [],
    relatedIds: [],
  };
  const albums: AlbumSlide[] = [
    { name: "ICEMAN", image: "", artist: "Drake", date: "2026-05-15", change: 11.56 },
    { name: "Some Sexy Songs 4 U", image: "", artist: "Drake", date: "2025-02-14", change: 11.56 },
    { name: "MAID OF HONOUR", image: "", artist: "Bruno Mars", date: "2026-03-02", change: -1.15 },
  ];
  return { artists, hero, heroRelated: artists.slice(1, 4), albums };
})();

// ---------------------------------------------------------------------------
// One fetch per render session, shared by every composition's
// calculateMetadata. Falls back to deterministic data offline.
let filmDataPromise: Promise<FilmData> | null = null;

export const loadFilmData = (): Promise<FilmData> => {
  if (!filmDataPromise) {
    filmDataPromise = (async () => {
      try {
        const artists = await fetchTopArtists(30);
        // Hero = highest-volume artist that actually has release artwork for
        // the chart's album markers.
        let hero: ArtistFull | null = null;
        for (const a of artists.slice(0, 5)) {
          const full = await fetchArtistFull(a.id);
          if (full.releases.some((rl) => rl.image && rl.date)) {
            hero = full;
            break;
          }
        }
        if (!hero) hero = await fetchArtistFull(artists[0].id);
        // The ad shows the tours section populated; fall back to plausible
        // dates when the live row has no events.
        if (hero.events.length === 0) {
          hero = { ...hero, events: DEMO_EVENTS };
        }
        const albums = await fetchLatestAlbums(6).catch(() => [] as AlbumSlide[]);
        const heroRelated = await fetchRelated(
          hero.relatedIds.map((x) => x.id),
          3,
        ).catch(() => filterAdArtists(artists).filter((a) => a.id !== hero!.id).slice(0, 3));
        return { artists, hero, heroRelated, albums };
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("Sonotrade data fetch failed, using fallback:", e);
        return FALLBACK_DATA;
      }
    })();
  }
  return filmDataPromise;
};
