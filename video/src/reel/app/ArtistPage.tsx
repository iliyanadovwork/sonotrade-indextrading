import React from "react";
import { Img, interpolate, useCurrentFrame } from "remotion";
import { colors, fonts } from "../../brand";
import type { ArtistFull } from "../data";
import { OdometerPrice, PriceChart, type PriceChartProps } from "./PriceChart";

// ── 1:1 desktop artist page (app/artist/[ticker] ProfileClient) ─────────────
// Self-contained world block: root width 1600, content max-w 1480 centered.
// Left column 1100 (24px right padding → 1076 content) + right rail 380.
// The right rail renders only the empty bg-[#131313] card frame; the scene
// overlays TradingPanel there.

export const APP_W = 1600;
const CONTENT_W = 1480;
const CONTENT_X = (APP_W - CONTENT_W) / 2; // 60
const LEFT_W = 1100;
const LEFT_PAD_R = 24;
const LEFT_CONTENT_W = LEFT_W - LEFT_PAD_R; // 1076
const RAIL_W = 380;
const RAIL_PAD = 24;
const CHART_W = LEFT_CONTENT_W;
const CHART_H = 400;

// Vertical layout math (see comments inline where each band renders):
// content top pad 8 (md:pt-2)
// header: pt 24 + avatar row 56 + gap 16 + price row 29 + pb 32  = 157 → ends 165
// chart svg: 400                                                  → ends 565
// chart controls: pt 24 + 32 + pb 24 = 80                         → ends 645
// stats band: py 24×2 + ~43 content = 91                          → ends 736
// Important Info accordion (EXPANDED): py-6 ×2 + title 24 + pt-3 12
//   + ~6 lines × 22.75 body ≈ 137 + 1px                            → ends 958
// releases/tracks: header 64 + 3 rows × 76 = 292                  → ends 1101
// cities/tours: heading 56 + 5 rows × 46 = 286                    → ends 1387
const HEADER_TOP = 8;
// About-card banner (SXProfileAboutCard): 26% square = 280 tall + 24 gap.
const ABOUT_H = 280;
const ABOUT_GAP = 24;
const HEADER_BAND_TOP = HEADER_TOP + ABOUT_H + ABOUT_GAP; // 312
const HEADER_H = 157;
const CHART_TOP = HEADER_BAND_TOP + HEADER_H; // 469
const CONTROLS_H = 80;
const STATS_TOP = CHART_TOP + CHART_H + CONTROLS_H; // 645
const STATS_H = 91;
const ACCORDION_TOP = STATS_TOP + STATS_H; // 736
const ACCORDION_H = 222;
const LISTS_TOP = ACCORDION_TOP + ACCORDION_H; // 809
const LISTS_H = 292;
const CITIES_TOP = LISTS_TOP + LISTS_H; // 1101
const CITIES_H = 286;

export const ARTIST_H = CITIES_TOP + CITIES_H + 42; // 1429

// Chart placement in ArtistPage root coordinates (for camera work that needs
// to track points ON the chart, e.g. following the draw tip).
export const CHART_GEOM = {
  left: CONTENT_X, // svg left edge
  top: CHART_TOP, // svg top edge
  width: CHART_W, // svg width (1076); inner plot = width - 56 (FUTURE_PAD)
  height: CHART_H, // 400; plot rows V_PAD_TOP..height - V_PAD_BOTTOM (40..344)
};

// Camera targets in ArtistPage root coordinates.
export const ARTIST_LANDMARKS = {
  // The about-card banner above the header.
  aboutBanner: { x: CONTENT_X + LEFT_CONTENT_W / 2, y: HEADER_TOP + ABOUT_H / 2 },
  // Avatar + name cluster, left-aligned in the header band.
  profileHeader: { x: CONTENT_X + 220, y: HEADER_BAND_TOP + 24 + 28 },
  // Odometer price row center.
  price: { x: CONTENT_X + 160, y: HEADER_BAND_TOP + 24 + 56 + 16 + 15 },
  chartCenter: { x: CONTENT_X + CHART_W / 2, y: CHART_TOP + CHART_H / 2 },
  // Album-circle row: markerY = CHART_TOP + CHART_H - 56 + 10.
  markersCenter: { x: CONTENT_X + CHART_W / 2, y: CHART_TOP + CHART_H - 46 },
  statsRow: { x: CONTENT_X + CHART_W / 2, y: STATS_TOP + STATS_H / 2 },
  // Left half of the two-column releases/tracks row.
  releasesList: { x: CONTENT_X + (LEFT_CONTENT_W - 48) / 4, y: LISTS_TOP + 150 },
  // Center of the Top Cities / Upcoming Shows band.
  citiesRow: { x: CONTENT_X + LEFT_CONTENT_W / 2, y: CITIES_TOP + CITIES_H / 2 },
  tradePanel: { x: CONTENT_X + LEFT_W + RAIL_W / 2, y: 250 },
};

// lib/format.ts fmtVolume
const fmtVolume = (value: number): string => {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return value.toFixed(2);
};

// lib/utils.ts formatPercent
const formatPercent = (pct: number): string => `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;

// SXTopTracks formatPlaycount
const formatPlaycount = (count: number): string => {
  if (count >= 1_000_000_000) return `${(count / 1_000_000_000).toFixed(1)}B streams`;
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M streams`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K streams`;
  return `${count} streams`;
};

const releaseYear = (dateStr?: string | null): string => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? "" : d.getFullYear().toString();
};

// SXTopCities formatListeners
const formatListeners = (count?: number): string => {
  if (count == null) return "";
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return `${count}`;
};

// Social icons from SXProfileHeader (inline brand SVGs, secondary gray).
const SpotifyIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
  </svg>
);

const AppleMusicIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M23.994 6.124a9.23 9.23 0 0 0-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 0 0-1.877-.726 10.496 10.496 0 0 0-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026-.747.043-1.49.123-2.193.4-1.336.53-2.3 1.452-2.865 2.78-.192.448-.292.925-.363 1.408a10.61 10.61 0 0 0-.1 1.18c0 .032-.007.062-.01.093v12.223c.01.14.017.283.027.424.05.815.154 1.624.497 2.373.65 1.42 1.738 2.353 3.234 2.801.42.127.856.187 1.293.228.555.053 1.11.06 1.667.06h11.03a12.5 12.5 0 0 0 1.57-.1c.822-.106 1.596-.35 2.296-.81a5.046 5.046 0 0 0 1.88-2.207c.186-.42.293-.87.37-1.324.113-.675.138-1.358.137-2.04-.002-3.8 0-7.595-.003-11.393zm-6.423 3.99v5.712c0 .417-.058.827-.244 1.206-.29.59-.76.962-1.388 1.14-.35.1-.706.157-1.07.173-.95.045-1.773-.6-1.943-1.536a1.88 1.88 0 0 1 1.038-2.022c.323-.16.67-.25 1.018-.324.378-.082.758-.153 1.134-.24.274-.063.457-.23.51-.516a.904.904 0 0 0 .02-.193c0-1.815 0-3.63-.002-5.443a.725.725 0 0 0-.026-.185c-.04-.15-.15-.243-.304-.234-.16.01-.318.035-.475.066l-5.597 1.09c-.306.06-.43.197-.437.516v7.37c0 .38-.05.753-.203 1.103-.28.64-.77 1.04-1.434 1.233-.365.106-.742.16-1.123.18-.96.05-1.79-.593-1.96-1.53a1.88 1.88 0 0 1 1.048-2.025c.355-.177.735-.267 1.117-.344.27-.055.54-.102.808-.16.39-.084.594-.292.615-.696.004-.08 0-.16 0-.24V5.992c0-.564.15-.915.57-1.04 1.914-.568 3.83-1.132 5.744-1.697.582-.172 1.164-.345 1.746-.516.47-.14.69-.01.69.478v5.896z" />
  </svg>
);

const YoutubeIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

const FilterIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M14 10H3v2h11zm0-4H3v2h11zm4 8v-4h-2v4h-4v2h4v4h2v-4h4v-2zM3 16h7v-2H3z" />
  </svg>
);

const ShareIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
    <polyline points="16 6 12 2 8 6" />
    <line x1="12" y1="2" x2="12" y2="15" />
  </svg>
);

const MusicNoteFallback: React.FC<{ round?: boolean }> = ({ round }) => (
  <div
    style={{
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#52525b",
    }}
  >
    {round ? (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      </svg>
    ) : (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M9 9h6M9 13h4" />
      </svg>
    )}
  </div>
);

const PagerArrows: React.FC<{ pages: number }> = ({ pages }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
    <span
      style={{
        border: "1px solid #3f3f46",
        borderRadius: "50%",
        padding: 4,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#52525b",
        opacity: 0.4,
      }}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
      </svg>
    </span>
    <span
      style={{
        fontSize: 12,
        color: colors.secondary,
        fontFamily: fonts.sans,
        minWidth: 32,
        textAlign: "center",
      }}
    >
      1 of {pages}
    </span>
    <span
      style={{
        border: "1px solid #3f3f46",
        borderRadius: "50%",
        padding: 4,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#a1a1aa",
      }}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
      </svg>
    </span>
  </div>
);

const StatCard: React.FC<{
  label: string;
  value: string;
  change?: number;
  at: number;
}> = ({ label, value, change, at }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [at, at + 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ty = interpolate(frame, [at, at + 10], [8, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const valueColor =
    change !== undefined ? (change >= 0 ? colors.positive : colors.negative) : colors.fg;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        opacity,
        transform: `translateY(${ty}px)`,
      }}
    >
      <span style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.secondary }}>{label}</span>
      <span style={{ fontFamily: fonts.sans, fontSize: 14, fontWeight: 600, letterSpacing: "-0.025em", color: valueColor }}>
        {value}
      </span>
    </div>
  );
};

export type ArtistPageProps = {
  artist: ArtistFull;
  chartProps?: Partial<Omit<PriceChartProps, "data" | "releases" | "width" | "height">>;
  priceAt?: number;
  liveDotOn?: boolean;
  statsAt?: number;
};

export const ArtistPage: React.FC<ArtistPageProps> = ({
  artist,
  chartProps = {},
  priceAt = 0,
  liveDotOn = true,
  statsAt = 0,
}) => {
  const frame = useCurrentFrame();

  // ALL-period change, like the app: (current − first) / first over history.
  const first = artist.history[0]?.price ?? artist.price;
  const lastP = artist.history[artist.history.length - 1]?.price ?? artist.price;
  const changePct = first !== 0 ? ((lastP - first) / first) * 100 : 0;
  const rawChange = lastP - first;
  const isPositive = changePct >= 0;
  const changeColor = isPositive ? colors.positive : colors.negative;

  // livePulse 1.5s (45f): opacity 1 → 0.3 → 1.
  const livePulse = 1 - 0.7 * (0.5 - 0.5 * Math.cos((2 * Math.PI * (frame % 45)) / 45));

  // The app derives stats from the market row: total_forecasts + volume_24h
  // both funnel from `volume`; holders has no public source (renders 0 in
  // the app) — derived deterministically here so the band reads as real.
  const totalForecasts = artist.volume;
  const volume24h = artist.volume;
  const holders = Math.max(12, Math.round(artist.volume * 3.2));

  const releasePages = Math.max(1, Math.ceil(artist.releases.length / 3));
  const trackPages = Math.max(1, Math.ceil(artist.topTracks.length / 3));
  const colW = (LEFT_CONTENT_W - 48) / 2;

  return (
    <div
      style={{
        width: APP_W,
        minHeight: ARTIST_H,
        background: colors.bg,
        color: colors.fg,
        paddingTop: HEADER_TOP,
        fontFamily: fonts.sans,
      }}
    >
      <div style={{ width: CONTENT_W, margin: "0 auto", display: "flex" }}>
        {/* ── Left column ── */}
        <div style={{ width: LEFT_W, paddingRight: LEFT_PAD_R, flexShrink: 0 }}>
          {/* About-card banner (SXProfileAboutCard) above the header */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: "#131313",
              height: ABOUT_H,
              marginBottom: ABOUT_GAP,
              display: "flex",
              alignItems: "stretch",
            }}
          >
            {/* Left: square gallery cover (26%) */}
            <div style={{ flex: `0 0 ${ABOUT_H}px`, minWidth: 0, position: "relative", overflow: "hidden" }}>
              {(artist.gallery[0] ?? artist.image) ? (
                <Img
                  src={(artist.gallery[0] ?? artist.image) as string}
                  alt={artist.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <div style={{ width: "100%", height: "100%", background: "#1a1a1a" }} />
              )}
            </div>
            {/* Right: About text + stats + cities */}
            <div
              className="flex-1 min-w-0"
              style={{ padding: 24, display: "flex", flexDirection: "column", gap: 24 }}
            >
              <div>
                <div className="mb-3">
                  <span className="m-0 p-0 text-[16px] font-normal leading-normal tracking-[-0.025em] text-white">
                    About
                  </span>
                </div>
                {artist.biography ? (
                  <div
                    className="text-xs leading-relaxed tracking-[-0.025em]"
                    style={{
                      color: "var(--st-secondary)",
                      maxHeight: 80,
                      overflow: "hidden",
                    }}
                  >
                    {artist.biography}
                  </div>
                ) : null}
              </div>
              <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
                <div className="flex flex-wrap gap-x-10 gap-y-4">
                  <div>
                    <div className="text-base font-semibold" style={{ color: "var(--st-white)" }}>
                      {formatListeners(artist.followers)}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--st-muted)" }}>
                      Followers
                    </div>
                  </div>
                  <div>
                    <div className="text-base font-semibold" style={{ color: "var(--st-white)" }}>
                      {formatListeners(artist.monthlyListeners)}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--st-muted)" }}>
                      Monthly Listeners
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-10 gap-y-3">
                  {artist.topCities.slice(0, 4).map((c, i) => (
                    <div key={i}>
                      <div className="text-xs font-medium" style={{ color: "var(--st-white)" }}>
                        {c.city}
                        {c.country ? `, ${c.country}` : ""}
                      </div>
                      <div className="text-xs tabular-nums" style={{ color: "var(--st-muted)" }}>
                        {formatListeners(c.numberOfListeners)} listeners
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          {/* Profile header (SXProfileHeader) */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              paddingTop: 24,
              paddingBottom: 32,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                {artist.image ? (
                  <Img
                    src={artist.image}
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: "50%",
                      objectFit: "cover",
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#3f3f46" }} />
                )}
                <h1
                  style={{
                    margin: 0,
                    padding: 0,
                    fontFamily: fonts.sans,
                    fontSize: 30,
                    fontWeight: 400,
                    letterSpacing: "-0.025em",
                    color: colors.fg,
                    whiteSpace: "nowrap",
                  }}
                >
                  {artist.name}
                </h1>
                <div style={{ display: "flex", alignItems: "center", gap: 10, color: colors.secondary }}>
                  <SpotifyIcon />
                  <AppleMusicIcon />
                  <YoutubeIcon />
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <OdometerPrice value={lastP} at={priceAt} fontSize={24} />
                  <span
                    style={{
                      fontFamily: fonts.sans,
                      fontSize: 20,
                      fontWeight: 400,
                      letterSpacing: "-0.025em",
                      color: colors.fg,
                    }}
                  >
                    points
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, transform: "translateY(-2px)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <svg
                      viewBox="0 0 24 18"
                      width="14"
                      height="14"
                      style={{
                        color: changeColor,
                        transform: `rotate(${isPositive ? "0deg" : "180deg"}) translateY(1px)`,
                        flexShrink: 0,
                      }}
                    >
                      <path fill="currentColor" d="m12 0 10.392 14.25H1.608z" />
                    </svg>
                    <OdometerPrice
                      value={Math.abs(changePct)}
                      at={priceAt}
                      fontSize={14}
                      color={changeColor}
                      suffix="%"
                    />
                  </div>
                  <OdometerPrice
                    value={Math.abs(rawChange)}
                    at={priceAt}
                    fontSize={14}
                    color={changeColor}
                    prefix={isPositive ? "+$" : "-$"}
                  />
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    style={{ color: "#52525b", transform: "translateY(-1px)" }}
                  >
                    <path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8" />
                  </svg>
                </div>
              </div>
            </div>
            {/* Right side of header: filter + share buttons, LIVE below */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                justifyContent: "space-between",
                alignSelf: "stretch",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ color: colors.fg, padding: 6, display: "flex", alignItems: "center" }}>
                  <FilterIcon />
                </span>
                <span style={{ color: colors.fg, padding: 6, display: "flex", alignItems: "center" }}>
                  <ShareIcon />
                </span>
              </div>
              {liveDotOn && (
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 12, marginBottom: 12 }}>
                  <span
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: "50%",
                      backgroundColor: colors.positive,
                      display: "inline-block",
                      opacity: livePulse,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 8,
                      fontWeight: 600,
                      letterSpacing: "0.08em",
                      color: colors.positive,
                      fontFamily: fonts.sans,
                      lineHeight: 1,
                    }}
                  >
                    LIVE
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Price chart */}
          <PriceChart
            data={artist.history}
            releases={artist.releases}
            width={CHART_W}
            height={CHART_H}
            {...chartProps}
          />

          {/* Market stats row (SXMarketStatsRow) */}
          <div
            style={{
              paddingTop: 24,
              paddingBottom: 24,
              borderTop: "1px solid #27272a",
              borderBottom: "1px solid #27272a",
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", columnGap: 24 }}>
              <StatCard label="Total Forecasts" value={`$${fmtVolume(totalForecasts)}`} at={statsAt} />
              <StatCard label="24h Volume" value={`$${fmtVolume(volume24h)}`} at={statsAt + 3} />
              <StatCard label="Holders" value={holders.toLocaleString("en-US")} at={statsAt + 6} />
              <StatCard
                label="1H Change"
                value={formatPercent(artist.change_1h)}
                change={artist.change_1h}
                at={statsAt + 9}
              />
              <StatCard
                label="24H Change"
                value={formatPercent(artist.change_1d)}
                change={artist.change_1d}
                at={statsAt + 12}
              />
              <StatCard
                label="7D Change"
                value={formatPercent(artist.change_1w)}
                change={artist.change_1w}
                at={statsAt + 15}
              />
            </div>
          </div>

          {/* Important Info accordion (SXOrderbookDetailsAccordion via
              CSXAccordion), rendered EXPANDED like the app (defaultOpen):
              py-6 band, border-b zinc-800, rotated chevron, pt-3 body. */}
          <div
            style={{
              paddingTop: 24,
              paddingBottom: 24,
              borderBottom: "1px solid #27272a",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontFamily: fonts.sans,
                  fontSize: 16,
                  letterSpacing: "-0.025em",
                  color: colors.fg,
                }}
              >
                Important Info
              </span>
              <svg
                width={12}
                height={12}
                viewBox="0 0 24 24"
                fill="none"
                stroke={colors.secondary}
                strokeWidth={2}
                style={{ flexShrink: 0, transform: "rotate(180deg)" }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            <div
              style={{
                paddingTop: 12,
                fontFamily: fonts.sans,
                fontSize: 14,
                lineHeight: 1.625,
                letterSpacing: "-0.025em",
                color: colors.secondary,
              }}
            >
              The {artist.name} Perpetual-Style Futures Contract is a
              cash-settled, 5-year perpetual-style contract that trades
              continuously and allows participants to gain or reduce exposure
              to changes in the underlying performance of the artist{" "}
              {artist.name}. The underlying index aggregates anonymized signals
              from sources such as Spotify performance, search activity, and
              social media engagement, providing a financial value based on
              real-world performance metrics. Each contract represents a fixed
              unit of the {artist.name} Index. The contract incorporates a
              periodic funding mechanism designed to keep prices closely
              aligned with the index level over time. Positions are settled in
              cash rather than any underlying media or intellectual property.
            </div>
          </div>

          {/* Releases + Top Tracks two-column row */}
          <div style={{ display: "flex", gap: 48, alignItems: "flex-start" }}>
            {/* Releases (SXReleases) */}
            <div style={{ width: colW }}>
              <div
                style={{
                  paddingTop: 24,
                  paddingBottom: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ fontFamily: fonts.sans, fontSize: 16, letterSpacing: "-0.025em", color: colors.fg }}>
                  Releases
                </span>
                {releasePages > 1 && <PagerArrows pages={releasePages} />}
              </div>
              {artist.releases.slice(0, 3).map((release, i) => (
                <div key={release.id ?? i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 0" }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 4,
                      overflow: "hidden",
                      background: "#27272a",
                      flexShrink: 0,
                    }}
                  >
                    {release.image ? (
                      <Img
                        src={release.image}
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      />
                    ) : (
                      <MusicNoteFallback />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: fonts.sans,
                        fontSize: 14,
                        fontWeight: 500,
                        color: colors.fg,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {release.name}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                      {release.type && (
                        <span style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.secondary }}>
                          {release.type.charAt(0) + release.type.slice(1).toLowerCase()}
                        </span>
                      )}
                      {release.type && releaseYear(release.date) && (
                        <span style={{ color: "#3f3f46", fontSize: 10 }}>·</span>
                      )}
                      {releaseYear(release.date) && (
                        <span style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.secondary }}>
                          {releaseYear(release.date)}
                        </span>
                      )}
                      {release.tracks != null && (
                        <>
                          <span style={{ color: "#3f3f46", fontSize: 10 }}>·</span>
                          <span style={{ fontFamily: fonts.sans, fontSize: 12, color: colors.secondary }}>
                            {release.tracks} {release.tracks === 1 ? "track" : "tracks"}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Top Tracks (SXTopTracks) */}
            <div style={{ width: colW }}>
              <div
                style={{
                  paddingTop: 24,
                  paddingBottom: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ fontFamily: fonts.sans, fontSize: 16, letterSpacing: "-0.025em", color: colors.fg }}>
                  Top Tracks
                </span>
                {trackPages > 1 && <PagerArrows pages={trackPages} />}
              </div>
              {artist.topTracks.slice(0, 3).map((track, i) => (
                <div key={track.id ?? i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 0" }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 4,
                      overflow: "hidden",
                      background: "#27272a",
                      flexShrink: 0,
                    }}
                  >
                    {track.image ? (
                      <Img
                        src={track.image}
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      />
                    ) : (
                      <MusicNoteFallback round />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: fonts.sans,
                        fontSize: 14,
                        fontWeight: 500,
                        color: colors.fg,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {track.name}
                    </div>
                    <div
                      style={{
                        fontFamily: fonts.sans,
                        fontSize: 12,
                        color: colors.secondary,
                        marginTop: 2,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {artist.name}
                    </div>
                  </div>
                  <div
                    style={{
                      fontFamily: fonts.sans,
                      fontSize: 12,
                      color: colors.secondary,
                      fontVariantNumeric: "tabular-nums",
                      flexShrink: 0,
                    }}
                  >
                    {formatPlaycount(track.playcount)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Cities + Upcoming Shows two-column row (SXTopCities +
              SXArtistTours; tours shows the app's empty state when there
              are no upcoming events). */}
          <div style={{ display: "flex", gap: 48, alignItems: "flex-start" }}>
            {/* Top Cities */}
            <div style={{ width: colW }}>
              <div style={{ paddingTop: 16, paddingBottom: 16 }}>
                <span
                  style={{
                    fontFamily: fonts.sans,
                    fontSize: 16,
                    letterSpacing: "-0.025em",
                    color: colors.fg,
                  }}
                >
                  Top Cities
                </span>
              </div>
              {(() => {
                const cities = artist.topCities.slice(0, 10);
                const maxListeners = Math.max(
                  1,
                  ...cities.map((c) => c.numberOfListeners ?? 0),
                );
                return cities.map((city, i) => {
                  const pct =
                    city.numberOfListeners != null
                      ? (city.numberOfListeners / maxListeners) * 100
                      : 0;
                  return (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "10px 0",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 8,
                            marginBottom: 4,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              minWidth: 0,
                            }}
                          >
                            <span
                              style={{
                                fontFamily: fonts.sans,
                                fontSize: 14,
                                color: colors.fg,
                                fontVariantNumeric: "tabular-nums",
                                flexShrink: 0,
                              }}
                            >
                              {i + 1}.
                            </span>
                            <span
                              style={{
                                fontFamily: fonts.sans,
                                fontSize: 14,
                                fontWeight: 500,
                                color: colors.fg,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {city.city}
                            </span>
                            {city.country && (
                              <span
                                style={{
                                  fontFamily: fonts.sans,
                                  fontSize: 12,
                                  color: colors.secondary,
                                  flexShrink: 0,
                                }}
                              >
                                {city.country}
                              </span>
                            )}
                          </div>
                          {city.numberOfListeners != null && (
                            <span
                              style={{
                                fontFamily: fonts.sans,
                                fontSize: 12,
                                color: colors.secondary,
                                fontVariantNumeric: "tabular-nums",
                                flexShrink: 0,
                              }}
                            >
                              {formatListeners(city.numberOfListeners)}
                            </span>
                          )}
                        </div>
                        {/* Progress bar (rendered at final width) */}
                        <div
                          style={{
                            width: "100%",
                            height: 2,
                            borderRadius: 999,
                            overflow: "hidden",
                            background: "#27272a",
                          }}
                        >
                          <div
                            style={{
                              width: `${pct}%`,
                              height: "100%",
                              borderRadius: 999,
                              background: colors.fg,
                              opacity: 0.25 + (pct / 100) * 0.65,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Upcoming Shows (empty state) */}
            <div style={{ width: colW }}>
              <div
                style={{
                  paddingTop: 16,
                  paddingBottom: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span
                  style={{
                    fontFamily: fonts.sans,
                    fontSize: 16,
                    letterSpacing: "-0.025em",
                    color: colors.fg,
                  }}
                >
                  Upcoming Shows
                </span>
              </div>
              {artist.events.length === 0 ? (
                <div style={{ paddingTop: 12 }}>
                  <span
                    style={{
                      fontFamily: fonts.sans,
                      fontSize: 12,
                      letterSpacing: "-0.025em",
                      color: colors.secondary,
                    }}
                  >
                    No upcoming shows
                  </span>
                </div>
              ) : (
                artist.events.slice(0, 3).map((event, i) => {
                  const d = event.date ? new Date(event.date) : null;
                  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                  const month = d && !isNaN(d.getTime()) ? months[d.getMonth()] : "—";
                  const day = d && !isNaN(d.getTime()) ? String(d.getDate()).padStart(2, "0") : "—";
                  return (
                    <div
                      key={i}
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 0" }}
                    >
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 4,
                          background: "#27272a",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <div
                          style={{
                            fontFamily: fonts.sans,
                            fontSize: 12,
                            fontWeight: 500,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            lineHeight: 1,
                            color: colors.secondary,
                          }}
                        >
                          {month}
                        </div>
                        <div
                          style={{
                            fontFamily: fonts.sans,
                            fontSize: 16,
                            fontWeight: 600,
                            lineHeight: 1.2,
                            color: colors.fg,
                          }}
                        >
                          {day}
                        </div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontFamily: fonts.sans,
                            fontSize: 14,
                            fontWeight: 500,
                            color: colors.fg,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {event.name ?? event.venue ?? ""}
                        </div>
                        <div
                          style={{
                            fontFamily: fonts.sans,
                            fontSize: 12,
                            color: colors.secondary,
                            marginTop: 2,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {[event.venue, event.city].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ── Right rail: spacer only — the scene overlays TradingPanel ── */}
        <div style={{ width: RAIL_W, flexShrink: 0, padding: `0 ${RAIL_PAD}px` }} />
      </div>
    </div>
  );
};
