// ============================================================
// Pauv data layer — the single server-side read funnel
// ============================================================
// REWIRED to read SONOTRADE data: the `artists_with_history` table (one row
// per artist, keyed by spotify_id) instead of pauv's profiles + markets.
// Results are mapped into pauv's existing Profile / MarketStatsLive / PricePoint
// shapes so the UI is unchanged. Writes (trade engine, funds) are stubbed.

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/db/supabase";
import type { Profile, PricePoint } from "@/lib/types";
import { sumLedgerNotional } from "@/lib/volume";

interface ArtistRow {
  spotify_id: string;
  artist_name: string;
  biography: string | null;
  spotify_img: string | null;
  current_index_value: number | null;
  change_1h: number | null;
  change_1d: number | null;
  change_1w: number | null;
  change_1m: number | null;
  volume: number | null;
  last_updated: string | null;
  instagram: string | null;
  twitter: string | null;
  tiktok: string | null;
  facebook: string | null;
  other: string | null;
  releases?: unknown;
  top_tracks?: unknown;
  top_cities?: unknown;
  events?: unknown;
  gallery?: unknown;
  related?: unknown;
  followers?: number | null;
  monthly_listeners?: number | null;
}

// NOTE: `data_points` is deliberately absent from EVERY column list here.
// It is an unbounded, TOASTed jsonb array (~76KB/artist, appended daily), so a
// single 50-row list query that includes it ships ~3.8MB. Price series come
// from the artist_history / artist_history_batch RPCs behind
// /api/markets/[ticker]/history and /api/markets/batch-history, which window
// and downsample inside Postgres.
const ARTIST_COLUMNS_SLIM =
  "spotify_id, artist_name, biography, spotify_img, current_index_value, change_1h, change_1d, change_1w, change_1m, volume, last_updated, instagram, twitter, tiktok, facebook, other, releases, top_tracks, top_cities, events, gallery, related, followers, monthly_listeners";
// List/grid views don't need the heavy jsonb music blobs.

function parseJsonish(raw: unknown): unknown[] {
  if (!raw) return [];
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return []; }
  }
  return Array.isArray(raw) ? raw : [];
}

// ---- 24h traded volume -----------------------------------------------------
// `artists_with_history.volume` is a LIFETIME accumulator: place_order_tx adds
// every fill's notional and nothing ever subtracts or expires, so it can only
// grow and cannot back a "24h Volume" stat (it was being shown as one). The
// rolling figure is derived from the audit trail instead: every fill (open,
// add, reduce, flip, close) writes a trade_ledger row, so the notional
// (quantity × price) of the last 24h of rows is the traded volume. Fill counts
// per artist per day are small, so the sum happens here; if that stops being
// true, move the same query into a SQL function.
//
// trade_ledger has RLS with no anon access (hardening part 3), so this goes
// through the service-role client. Only quantity/price leave the query and
// only their sum leaves this function — no per-user data is exposed.
const VOLUME_24H_WINDOW_MS = 24 * 60 * 60 * 1000;

async function getVolume24h(spotifyId: string): Promise<number> {
  const since = new Date(Date.now() - VOLUME_24H_WINDOW_MS).toISOString();
  const { data, error } = await supabaseAdmin
    .from("trade_ledger")
    .select("quantity, price")
    .eq("spotify_id", spotifyId)
    .gte("created_at", since);
  if (error) {
    console.error("getVolume24h error", error.message);
    return 0;
  }
  return sumLedgerNotional(data ?? []);
}

function toProfile(a: ArtistRow, volume24h = 0): Profile {
  const price = a.current_index_value ?? 0;
  const lifetimeVolumeUsd = a.volume ?? 0;
  const spotifyUrl = a.spotify_id ? `https://open.spotify.com/artist/${a.spotify_id}` : "";
  return {
    id: a.spotify_id,
    talent_id: null,
    name: a.artist_name,
    ticker: a.spotify_id,
    industry: "",
    bio: a.biography ?? "",
    photo_url: a.spotify_img ?? "",
    price,
    market_cap: 0,
    change_24h: a.change_1d ?? 0,
    change_1h: a.change_1h ?? 0,
    change_7d: a.change_1w ?? 0,
    change_30d: a.change_1m ?? 0,
    volume_24h: volume24h,
    total_forecasts: lifetimeVolumeUsd,
    holders: 0,
    social_spotify: spotifyUrl,
    social_applemusic: "",
    social_genius: "",
    social_x: a.twitter ?? "",
    social_instagram: a.instagram ?? "",
    social_tiktok: a.tiktok ?? "",
    social_youtube: "",
    social_facebook: a.facebook ?? "",
    social_linkedin: "",
    social_linktree: "",
    social_reddit: "",
    social_telegram: "",
    social_threads: "",
    social_twitch: "",
    social_ticketmaster: "",
    social_imdb: "",
    social_website: a.other ?? "",
    info_location: "",
    info_subcategory: "",
    info_active_since: "",
    info_language: "",
    // Never seeded from the jsonb. getProfileByTicker's full path overwrites
    // this from the artist_history RPC; everyone else renders from an empty
    // seed and lets useLivePriceHistory fetch the series it needs.
    price_history: [] as PricePoint[],
    claim_status: "unclaimed",
    view_count: 0,
    created_at: a.last_updated ?? new Date(0).toISOString(),
    // Music widgets (sonotrade artists_with_history jsonb columns)
    releases: parseJsonish(a.releases),
    top_tracks: parseJsonish(a.top_tracks),
    top_cities: parseJsonish(a.top_cities),
    events: parseJsonish(a.events),
    gallery: parseJsonish(a.gallery),
    related: parseJsonish(a.related) as Array<{ id: string; name: string; image?: string }>,
    followers: a.followers ?? null,
    monthly_listeners: a.monthly_listeners ?? null,
  };
}

export async function getProfileByTicker(
  ticker: string,
  opts?: { slim?: boolean },
): Promise<Profile | null> {
  const supabase = await createClient();

  if (opts?.slim) {
    // Slim: no chart seed. Consumers (mobile panel, top-gainer slides) either
    // don't render a chart or fetch it from /api/markets/[ticker]/history —
    // useLivePriceHistory self-heals on an empty seed.
    const [{ data, error }, volume24h] = await Promise.all([
      supabase
        .from("artists_with_history")
        .select(ARTIST_COLUMNS_SLIM)
        .eq("spotify_id", ticker)
        .maybeSingle<ArtistRow>(),
      getVolume24h(ticker),
    ]);
    if (error) console.error("getProfileByTicker error", error.message);
    if (!data) return null;
    return toProfile(data, volume24h);
  }

  // Full: fetch slim columns + a server-side windowed/downsampled chart seed
  // via the artist_history RPC in parallel — the raw data_points jsonb
  // (~76KB, 1000+ points) never crosses the wire.
  const [profileRes, historyRes, volume24h] = await Promise.all([
    supabase
      .from("artists_with_history")
      .select(ARTIST_COLUMNS_SLIM)
      .eq("spotify_id", ticker)
      .maybeSingle<ArtistRow>(),
    supabase.rpc("artist_history", { p_spotify_id: ticker, p_window: "all" }),
    getVolume24h(ticker),
  ]);
  if (profileRes.error) console.error("getProfileByTicker error", profileRes.error.message);
  if (!profileRes.data) return null;

  if (!historyRes.error && Array.isArray(historyRes.data)) {
    const profile = toProfile(profileRes.data, volume24h);
    profile.price_history = (historyRes.data as { price: number; timestamp: string }[])
      .map((p) => ({ price: Number(p.price), t: new Date(p.timestamp).getTime() }))
      .filter((p) => Number.isFinite(p.price) && Number.isFinite(p.t));
    return profile;
  }

  // RPC unavailable. The old behaviour here was a second query selecting the
  // full data_points jsonb, i.e. every artist-page SSR paid ~76KB + a TOAST
  // detoast. Degrade to an empty chart instead: the client's
  // useLivePriceHistory self-heals from /api/markets/[ticker]/history, and a
  // missing RPC is an operational fault we want to see in the logs rather than
  // absorb as a per-request cost.
  console.error(
    "getProfileByTicker: artist_history RPC unavailable — serving empty price history",
    historyRes.error?.message ?? "non-array response",
  );
  return toProfile(profileRes.data, volume24h);
}

export interface MarketStatsLive {
  price: number; change_1h: number; change_24h: number; change_7d: number;
  volume_24h: number; total_forecasts: number; holders: number; market_cap: number;
}
const EMPTY_MARKET_STATS: MarketStatsLive = {
  price: 0, change_1h: 0, change_24h: 0, change_7d: 0, volume_24h: 0, total_forecasts: 0, holders: 0, market_cap: 0,
};

export async function getMarketStats(profileId: string): Promise<MarketStatsLive> {
  const supabase = await createClient();
  const [{ data, error }, volume24h] = await Promise.all([
    supabase
      .from("artists_with_history")
      .select("current_index_value, change_1h, change_1d, change_1w, volume")
      .eq("spotify_id", profileId)
      .maybeSingle<{
        current_index_value: number | null; change_1h: number | null;
        change_1d: number | null; change_1w: number | null; volume: number | null;
      }>(),
    getVolume24h(profileId),
  ]);
  if (error || !data) return EMPTY_MARKET_STATS;
  return {
    price: data.current_index_value ?? 0,
    change_1h: data.change_1h ?? 0,
    change_24h: data.change_1d ?? 0,
    change_7d: data.change_1w ?? 0,
    volume_24h: volume24h,
    // Lifetime traded volume (the raw accumulator); see getVolume24h.
    total_forecasts: data.volume ?? 0,
    holders: 0,
    market_cap: 0,
  };
}
