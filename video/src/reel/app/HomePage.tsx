import React from "react";
import { Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { SNAP } from "../text";
import { colors, fonts } from "../../brand";
import type { AlbumSlide, ArtistLite } from "../data";
import { Avatar } from "./avatar";
import { Sparkline } from "./Sparkline";

// The app's carousel/slide easing (0.4s cubic-bezier(0.4,0,0.2,1)).
const SLIDE_EASE = Easing.bezier(0.4, 0, 0.2, 1);

// ---------------------------------------------------------------------------
// Layout math (world-space, y from top of AppFrame):
//   header 69 + pt-2 8                        -> contentTop = 77
//   hero row h-[420px]                        -> heroCenter y = 77 + 210 = 287
//   left col = 73% of 1480 = 1080 (mr-12 48)  -> left col x: 60..1140, center 600
//   featured: mt-12 48 + heading 44 + mb-4 16 -> cards top 605
//     card w 249 (4 cols gap-7), img 233 + body ~125 -> ends ~971
//   rail: gainers ~505 + movers mt-6 ~465     -> flex block ends ~1010
//   spotlight: mt-12 48 + heading 60          -> row top ~1118, ~534 tall -> 1652
//   forecast: mt-12 48 + header 44+16 + strip 38 -> table top ~1806
//   table: head 32 + 10 rows x 64             -> bottom ~2478; load-more -> 2536
//   footer: mt-40 160 + ~576                  -> HOME_H ~3272
// ---------------------------------------------------------------------------
export const HOME_H = 3272;

export const HOME_LANDMARKS = {
  heroCenter: { x: 600, y: 287 },
  discoverCenter: { x: 600, y: 790 },
  spotlightCenter: { x: 740, y: 1385 },
  tableTop: { x: 800, y: 1806 },
  tableCenter: { x: 800, y: 2142 },
  firstRowSparkline: { x: 1492, y: 1870 },
};

// Center of featured card i's ARTWORK: left col starts x 60; 249px cards +
// 28px gaps (gap-7); image inset 8px, 233px square starting at cards-top 605.
export const discoverCardCenter = (i: number) => ({
  x: 184 + 277 * i,
  y: 729,
});

const fmtChange = (value: number | null): string => {
  if (value == null) return "-";
  const sign = value >= 0 ? "+ " : "- ";
  return `${sign}${Math.abs(value).toFixed(2)}%`;
};

const fmtVolume = (value: number | null): string => {
  if (value == null) return "-";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return value.toFixed(2);
};

const fmtVolumeUSD = (value: number | null): string =>
  value == null ? "-" : `$${fmtVolume(value)}`;

const fmtGridVolume = (value: number | null): string => {
  if (value == null) return "Vol. $0";
  if (value >= 1_000_000) return `Vol. $${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `Vol. $${(value / 1_000).toFixed(1)}K`;
  return `Vol. $${value.toFixed(0)}`;
};

const fmtPrice = (value: number | null): string =>
  value != null
    ? value.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "-";

// Deterministic holders fallback — mirrors holderCount in SXTopGainerWidget.
const holderCount = (name: string): number => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return 42 + (h % 900);
};

const TrendArrow: React.FC<{ positive: boolean; size?: number }> = ({
  positive,
  size = 12,
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 18"
    width={size}
    height={size}
    className="shrink-0"
    style={{
      color: `var(--${positive ? "st-positive" : "st-chart-negative"})`,
      transform: `rotate(${positive ? "0deg" : "180deg"}) translateY(1px)`,
    }}
  >
    <path fill="currentColor" d="m12 0 10.392 14.25H1.608z" />
  </svg>
);

const changeCss = (v: number | null) =>
  v == null
    ? "var(--st-secondary)"
    : v >= 0
      ? "var(--st-chart-positive)"
      : "var(--st-chart-negative)";

const SectionHeading: React.FC<{ title: string; subtitle: string }> = ({
  title,
  subtitle,
}) => (
  <div className="flex flex-col gap-0.5">
    <h2 className="m-0 p-0">
      <span className="m-0 p-0 text-[16px] font-normal leading-normal tracking-[-0.025em] text-white">
        {title}
      </span>
    </h2>
    <span
      className="m-0 p-0 text-xs font-normal leading-normal tracking-[-0.025em]"
      style={{ color: "var(--st-secondary)" }}
    >
      {subtitle}
    </span>
  </div>
);

// ── Hero: SXTopGainerWidget — ANIMATED image-slide carousel ────────────────
// Auto-cycles through the top gainers with the app's slide-in transition
// (translateX 32→0 + fade over 0.4s, cubic-bezier(0.4,0,0.2,1)).
export const HERO_CYCLE = 50; // frames per slide

const HeroCarousel: React.FC<{ artists: ArtistLite[] }> = ({ artists }) => {
  const frame = useCurrentFrame();
  const n = Math.max(1, Math.min(7, artists.length));
  const slideIdx = Math.floor(Math.max(0, frame) / HERO_CYCLE) % n;
  const local = Math.max(0, frame) - Math.floor(Math.max(0, frame) / HERO_CYCLE) * HERO_CYCLE;
  // First slide starts settled; later slides animate in.
  const entering = frame >= HERO_CYCLE;
  const slideX = entering
    ? interpolate(local, [0, 12], [32, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: SLIDE_EASE,
      })
    : 0;
  const slideOpacity = entering
    ? interpolate(local, [0, 12], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1;
  const artist = artists[slideIdx] ?? artists[0];
  const totalSlides = n;
  const positive = (artist.change_1d ?? 0) >= 0;
  const slideStyle: React.CSSProperties = {
    translate: `${slideX}px 0px`,
    opacity: slideOpacity,
  };
  return (
    <div
      className="rounded-2xl"
      style={{
        position: "relative",
        width: "100%",
        height: 420,
        background: "#131313",
        overflow: "hidden",
      }}
    >
      <div key={slideIdx} style={{ position: "absolute", inset: 0, ...slideStyle }}>
      {/* Backdrop: same image, blurred ambient fill */}
      {artist.image && (
        <Img
          src={artist.image}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            filter: "blur(48px) brightness(0.7) saturate(1.1)",
            transform: "scale(1.15)",
            objectPosition: "center",
          }}
        />
      )}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to right, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0) 25%, rgba(0,0,0,0) 75%, rgba(0,0,0,0.15) 100%)",
        }}
      />
      {/* Foreground: contain-fit, side-masked */}
      {artist.image && (
        <Img
          src={artist.image}
          alt={artist.name}
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            height: "100%",
            width: "auto",
            maxWidth: "100%",
            maxHeight: "100%",
            WebkitMaskImage:
              "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.5) 10%, black 22%, black 78%, rgba(0,0,0,0.5) 90%, transparent 100%)",
            maskImage:
              "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.5) 10%, black 22%, black 78%, rgba(0,0,0,0.5) 90%, transparent 100%)",
          }}
        />
      )}
      {/* Bottom gradient */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: -1,
          background:
            "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.4) 55%, rgba(0,0,0,0.05) 100%)",
        }}
      />
      </div>
      {/* Industry pill — top left */}
      <div style={{ position: "absolute", top: 20, left: 24, zIndex: 10 }}>
        <span
          className="inline-flex items-center rounded-full"
          style={{
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(0,0,0,0.4)",
            padding: "4px 10px",
          }}
        >
          <span className="m-0 p-0 text-[0.625rem] font-medium leading-normal tracking-[0.01em] text-white">
            Musician
          </span>
        </span>
      </div>
      {/* Nav arrows — top right */}
      <div
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span
          style={{
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(0,0,0,0.4)",
            borderRadius: "50%",
            padding: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#a1a1aa",
          }}
        >
          <svg viewBox="0 0 24 24" width={14} height={14} fill="currentColor">
            <path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
          </svg>
        </span>
        <span
          style={{
            fontSize: 10,
            color: "rgba(255,255,255,0.45)",
            minWidth: 28,
            textAlign: "center",
          }}
        >
          {slideIdx + 1}/{totalSlides}
        </span>
        <span
          style={{
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(0,0,0,0.4)",
            borderRadius: "50%",
            padding: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#a1a1aa",
          }}
        >
          <svg viewBox="0 0 24 24" width={14} height={14} fill="currentColor">
            <path d="M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
          </svg>
        </span>
      </div>
      {/* Bottom content */}
      <div
        key={`info-${slideIdx}`}
        className="absolute inset-0 flex flex-col justify-end"
        style={{ padding: "20px 24px", gap: 8, ...slideStyle }}
      >
        <div
          style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}
        >
          <span
            style={{ fontSize: 22, fontWeight: 700, color: "#fff", lineHeight: 1.2 }}
          >
            {artist.name}
          </span>
          <span
            style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.8)" }}
          >
            {fmtPrice(artist.price)}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <TrendArrow positive={positive} size={13} />
            <span
              style={{ fontSize: 12, fontWeight: 500, color: changeCss(artist.change_1d) }}
            >
              {Math.abs(artist.change_1d ?? 0).toFixed(2)}%
            </span>
          </span>
        </div>
        <div
          style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}
        >
          <span
            className="m-0 p-0 text-xs font-normal leading-normal tracking-[-0.025em]"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              color: "var(--st-secondary)",
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ opacity: 0.5, flexShrink: 0 }}
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            {holderCount(artist.name).toLocaleString()} holders
          </span>
          <span
            className="m-0 p-0 text-xs font-normal leading-normal tracking-[-0.025em]"
            style={{ color: "var(--st-secondary)" }}
          >
            {fmtVolumeUSD(artist.volume)} vol
          </span>
        </div>
        {/* Dot indicators */}
        <div
          style={{ display: "flex", alignItems: "center", gap: 4, paddingTop: 2 }}
        >
          {Array.from({ length: totalSlides }).map((_, i) => (
            <span
              key={i}
              style={{
                width: i === slideIdx ? 20 : 5,
                height: 5,
                borderRadius: 3,
                background:
                  i === slideIdx
                    ? "rgba(255,255,255,0.9)"
                    : "rgba(255,255,255,0.3)",
                flexShrink: 0,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Right rail: SXSidebarProfileList "Biggest gainers" ─────────────────────
const GainerRow: React.FC<{ artist: ArtistLite }> = ({ artist }) => {
  const change = artist.change_1d;
  return (
    <div className="relative w-full text-left">
      <span className="relative z-10 flex w-full items-center gap-3 py-3">
        <Avatar src={artist.image} name={artist.name} size={36} />
        <div className="flex min-w-0 flex-1 flex-col gap-px">
          <div className="min-w-0 truncate">
            <span className="m-0 p-0 text-sm font-normal leading-normal tracking-[-0.025em] text-white">
              {artist.name}
            </span>
          </div>
          <span
            className="m-0 p-0 text-xs font-normal leading-normal tracking-[-0.025em]"
            style={{ color: "var(--st-secondary)" }}
          >
            Index
          </span>
        </div>
        <div className="flex gap-2 flex-shrink-0 flex-col items-end text-right">
          <span
            className="m-0 p-0 text-xs font-normal leading-normal tracking-[-0.025em]"
            style={{ color: "var(--st-secondary)" }}
          >
            {fmtPrice(artist.price)}
          </span>
          <div className="flex items-center gap-1">
            <TrendArrow positive={(change ?? 0) >= 0} />
            <span
              className="text-xs font-medium leading-none tracking-[-0.025em] tabular-nums"
              style={{
                color: `var(--${(change ?? 0) >= 0 ? "st-positive" : "st-chart-negative"})`,
              }}
            >
              {Math.abs(change ?? 0).toFixed(2)}%
            </span>
          </div>
        </div>
      </span>
    </div>
  );
};

// ── Shared header nav arrows + "n of N" (SXSidebarProfileList / SXFeaturedCards)
const NavArrows: React.FC<{ label: string; prevDisabled?: boolean }> = ({
  label,
  prevDisabled = true,
}) => (
  <div className="flex items-center gap-2 flex-shrink-0">
    <span
      style={{
        border: "1px solid #3f3f46",
        background: "transparent",
        borderRadius: "50%",
        padding: 4,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: prevDisabled ? "#52525b" : "#a1a1aa",
        opacity: prevDisabled ? 0.4 : 1,
      }}
    >
      <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor">
        <path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
      </svg>
    </span>
    <span
      className="text-xs"
      style={{ color: "var(--st-muted)", minWidth: 32, textAlign: "center" }}
    >
      {label}
    </span>
    <span
      style={{
        border: "1px solid #3f3f46",
        background: "transparent",
        borderRadius: "50%",
        padding: 4,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#a1a1aa",
      }}
    >
      <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor">
        <path d="M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
      </svg>
    </span>
  </div>
);

// ── Featured cards (SXFeaturedCards) ───────────────────────────────────────
// Per-card curated bullet sets (CARD_CONFIGS order).
const FEATURED_BULLETS: Array<[string, string, string]> = [
  ["Highest 1M return", "Strong momentum signal", "Trending this month"],
  ["Highest trading activity", "Deep liquidity pool", "High volume leader"],
  ["Highest index value", "Blue-chip Index", "Market benchmark"],
  ["Largest 1M pullback", "Potential mean reversion", "Discounted entry point"],
];

// Fallback bullet glyphs (SXFeaturedCards), picked deterministically by label.
const BULLET_GLYPHS = [
  <svg key="arrow" width="12" height="12" viewBox="0 0 20 20" fill="none"><path d="M10 16V4M10 4l5 5M10 4l-5 5" stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  <svg key="star" width="12" height="12" viewBox="0 0 20 20" fill="none"><polygon points="10,2 12.4,7.2 18,8 14,12 15,17.6 10,15 5,17.6 6,12 2,8 7.6,7.2" stroke="#a1a1aa" strokeWidth="1.5" fill="none" strokeLinejoin="round" /></svg>,
  <svg key="bars" width="12" height="12" viewBox="0 0 20 20" fill="none"><rect x="3" y="10" width="3" height="7" rx="1" fill="#a1a1aa" /><rect x="8.5" y="6" width="3" height="11" rx="1" fill="#a1a1aa" /><rect x="14" y="3" width="3" height="14" rx="1" fill="#a1a1aa" /></svg>,
  <svg key="pulse" width="12" height="12" viewBox="0 0 20 20" fill="none"><path d="M3 10h3l2-5 2 10 2-5h3" stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  <svg key="bolt" width="12" height="12" viewBox="0 0 20 20" fill="none"><path d="M11 2 4 12h4l-1 6 7-10h-4z" stroke="#a1a1aa" strokeWidth="1.5" fill="none" strokeLinejoin="round" /></svg>,
  <svg key="target" width="12" height="12" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7" stroke="#a1a1aa" strokeWidth="1.5" /><circle cx="10" cy="10" r="2" fill="#a1a1aa" /></svg>,
];

const bulletGlyph = (label: string) => {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) >>> 0;
  return BULLET_GLYPHS[h % BULLET_GLYPHS.length];
};

const FeaturedCard: React.FC<{
  artist: ArtistLite;
  bullets: [string, string, string];
  pressAt?: number;
}> = ({ artist, bullets, pressAt }) => {
  const frame = useCurrentFrame();
  const isUp = (artist.change_1m ?? 0) >= 0;
  const press =
    pressAt === undefined
      ? 1
      : interpolate(frame, [pressAt, pressAt + 4, pressAt + 13], [1, 0.96, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: SNAP,
        });
  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ background: "rgb(19, 19, 19)", scale: `${press}`, transformOrigin: "center" }}
    >
      {/* Banner image */}
      <div style={{ padding: 8, paddingBottom: 0 }}>
        <div
          className="relative rounded-lg"
          style={{ aspectRatio: "1", background: "#1a1a1a", overflow: "hidden" }}
        >
          {artist.image ? (
            <Img
              src={artist.image}
              alt={artist.name}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "center center",
              }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                background: "linear-gradient(135deg, #1c1c1c 0%, #111 100%)",
              }}
            />
          )}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to bottom, transparent 35%, rgba(0,0,0,0.65) 100%)",
            }}
          />
          <div
            className="absolute flex items-center gap-1 shrink-0"
            style={{ bottom: 8, right: 8, zIndex: 10, filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.9))" }}
          >
            <TrendArrow positive={isUp} />
            <span
              className="whitespace-nowrap tabular-nums text-xs"
              style={{ color: changeCss(artist.change_1m) }}
            >
              {Math.abs(artist.change_1m ?? 0).toFixed(2)}%
            </span>
          </div>
        </div>
      </div>
      {/* Card body */}
      <div className="flex flex-col" style={{ padding: 10, gap: 6 }}>
        <div className="flex items-baseline justify-between gap-2">
          <span
            className="truncate"
            style={{ fontSize: 16, fontWeight: 600, color: "#ffffff" }}
          >
            {artist.name}
          </span>
          <span
            className="flex-shrink-0"
            style={{ fontSize: 16, fontWeight: 600, color: "#ffffff", lineHeight: 1 }}
          >
            {fmtPrice(artist.price)}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: -3,
          }}
        >
          <span
            className="m-0 p-0 text-xs font-normal leading-normal tracking-[-0.025em]"
            style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--st-secondary)" }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            {holderCount(artist.name).toLocaleString()} holders
          </span>
          <span
            className="m-0 p-0 text-xs font-normal leading-normal tracking-[-0.025em] flex-shrink-0"
            style={{ color: "var(--st-secondary)" }}
          >
            {fmtGridVolume(artist.volume)}
          </span>
        </div>
        <div className="flex flex-col" style={{ gap: 3 }}>
          {bullets.map((b, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="shrink-0 flex items-center">{bulletGlyph(b)}</span>
              <span
                className="m-0 p-0 text-xs font-normal leading-normal tracking-[-0.025em] truncate"
                style={{ color: "var(--st-secondary)" }}
              >
                {b}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Spotlight: SXAlbumSlideshow — ANIMATED cross-fade ──────────────────────
export const ALBUM_CYCLE = 60; // frames per album

const AlbumSlideshow: React.FC<{ albums: AlbumSlide[] }> = ({ albums }) => {
  const frame = useCurrentFrame();
  const n = Math.max(1, albums.length);
  const idx = Math.floor(Math.max(0, frame) / ALBUM_CYCLE) % n;
  const local = Math.max(0, frame) - Math.floor(Math.max(0, frame) / ALBUM_CYCLE) * ALBUM_CYCLE;
  const prevIdx = (idx - 1 + n) % n;
  // 0.7s (21f) cross-fade between covers, like the app.
  const fade =
    frame >= ALBUM_CYCLE
      ? interpolate(local, [0, 21], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1;
  const album = albums[idx];
  const prev = albums[prevIdx];
  return (
    <div
      className="select-none"
      style={{
        width: "100%",
        height: "100%",
        minHeight: 300,
        borderRadius: 8,
        backgroundColor: "#111111",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Outgoing + incoming covers, cross-faded */}
      {albums.length > 0 && (
        <>
          {prev && prev.image && fade < 1 && (
            <Img
              src={prev.image}
              alt=""
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          )}
          {album && album.image ? (
            <Img
              src={album.image}
              alt={album.name}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                opacity: fade,
              }}
            />
          ) : (
            <div className="absolute inset-0 bg-zinc-800" />
          )}
        </>
      )}
      {/* Gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.1) 100%)",
        }}
      />
      {/* Nav arrows — top right */}
      {albums.length > 1 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            position: "absolute",
            top: 16,
            right: 16,
            zIndex: 20,
            filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.9))",
          }}
        >
          <span style={{ border: "1px solid rgba(255,255,255,0.15)", background: "rgba(0,0,0,0.4)", borderRadius: "50%", padding: 4, display: "flex", alignItems: "center", justifyContent: "center", color: "#a1a1aa" }}>
            <svg viewBox="0 0 24 24" width={14} height={14} fill="currentColor">
              <path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
            </svg>
          </span>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", minWidth: 28, textAlign: "center" }}>
            {idx + 1}/{n}
          </span>
          <span style={{ border: "1px solid rgba(255,255,255,0.15)", background: "rgba(0,0,0,0.4)", borderRadius: "50%", padding: 4, display: "flex", alignItems: "center", justifyContent: "center", color: "#a1a1aa" }}>
            <svg viewBox="0 0 24 24" width={14} height={14} fill="currentColor">
              <path d="M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
            </svg>
          </span>
        </div>
      )}
      {/* Content */}
      <div className="absolute inset-0 flex flex-col justify-between p-6">
        <div>
          <span className="m-0 p-0 text-[16px] font-normal leading-normal tracking-[-0.025em] text-white">
            Latest Albums
          </span>
        </div>
        {album && (
          <div className="flex flex-col" style={{ gap: 8, opacity: fade }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>
                {album.name}
              </span>
              {album.change != null && (
                <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                  <TrendArrow positive={album.change >= 0} size={13} />
                  <span style={{ fontSize: 12, fontWeight: 500, color: changeCss(album.change) }}>
                    {Math.abs(album.change).toFixed(2)}%
                  </span>
                </span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <span className="m-0 p-0 text-xs font-normal leading-normal tracking-[-0.025em]" style={{ color: "var(--st-secondary)" }}>
                {album.artist}
              </span>
              <span className="m-0 p-0 text-xs font-normal leading-normal tracking-[-0.025em]" style={{ color: "var(--st-secondary)" }}>
                {new Date(album.date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
              </span>
            </div>
            {/* Dot indicators */}
            <div style={{ display: "flex", alignItems: "center", gap: 4, paddingTop: 2 }}>
              {albums.map((_, i) => (
                <span
                  key={i}
                  style={{
                    width: i === idx ? 20 : 5,
                    height: 5,
                    borderRadius: 3,
                    background: i === idx ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.3)",
                    flexShrink: 0,
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Spotlight grid card: SXDiscoverGrid GridCard ───────────────────────────
const DiscoverCard: React.FC<{ artist: ArtistLite; pressAt?: number }> = ({
  artist,
  pressAt,
}) => {
  const frame = useCurrentFrame();
  const isPositive = (artist.change_1m ?? 0) >= 0;
  // Tap feedback: quick press dip then settle, like the app's active:scale.
  const press =
    pressAt === undefined
      ? 1
      : interpolate(frame, [pressAt, pressAt + 4, pressAt + 13], [1, 0.94, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: SNAP,
        });
  return (
    <li className="w-full list-none" style={{ scale: `${press}` }}>
      <div className="flex flex-col gap-1 p-2 rounded-lg">
        <div className="relative w-full">
          <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-zinc-800">
            {artist.image ? (
              <Img
                src={artist.image}
                alt={artist.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center bg-zinc-800">
                <span className="text-2xl font-semibold text-zinc-500 select-none">
                  {artist.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "linear-gradient(to bottom, transparent 35%, rgba(0,0,0,0.65) 100%)",
              }}
            />
          </div>
        </div>
        <div className="flex w-full flex-col gap-0.5 pt-0.5">
          <div className="flex items-center justify-between gap-2">
            <div className="truncate min-w-0">
              <span className="m-0 p-0 text-sm font-medium leading-normal tracking-[-0.025em] text-white">
                {artist.name}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <TrendArrow positive={isPositive} />
              <span
                className="whitespace-nowrap tabular-nums text-xs"
                style={{ color: changeCss(artist.change_1m) }}
              >
                {Math.abs(artist.change_1m ?? 0).toFixed(2)}%
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span
              className="m-0 p-0 text-xs font-normal leading-normal tracking-[-0.025em]"
              style={{ color: "var(--st-secondary)" }}
            >
              {fmtPrice(artist.price)}
            </span>
            <span
              className="m-0 p-0 text-xs font-normal leading-normal"
              style={{ color: "var(--st-muted)" }}
            >
              {fmtGridVolume(artist.volume)}
            </span>
          </div>
        </div>
      </div>
    </li>
  );
};

// ── Forecast table row (HomeTableRow, bloomberg variant) ───────────────────
const TableRow: React.FC<{
  artist: ArtistLite;
  rank: number;
  appearAt?: number;
  sparklineAt?: number;
}> = ({ artist, rank, appearAt, sparklineAt }) => {
  const frame = useCurrentFrame();
  const at = appearAt ?? -999;
  const opacity = interpolate(frame, [at, at + 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: SNAP,
  });
  const ty = interpolate(frame, [at, at + 12], [12, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: SNAP,
  });
  const cellText =
    "m-0 p-0 text-xs font-normal leading-normal";
  return (
    <tr
      className="border-b-0"
      style={{ opacity, transform: `translateY(${ty}px)` }}
    >
      <td className="pl-0 pr-3 py-3 text-left tabular-nums whitespace-nowrap align-middle">
        <span className="text-xs" style={{ color: "var(--st-muted)" }}>
          {rank}
        </span>
      </td>
      <td className="min-w-0 px-3 py-3 align-middle">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar src={artist.image} name={artist.name} size={24} />
          <div className="min-w-0 flex-1 flex items-center gap-2 overflow-hidden">
            <span className="truncate shrink-0 max-w-[55%]">
              <span className="m-0 p-0 text-sm font-normal leading-normal text-white">
                {artist.name}
              </span>
            </span>
            <span
              className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium leading-none whitespace-nowrap"
              style={{ background: "rgba(255,255,255,0.06)", color: "#71717a" }}
            >
              Musician
            </span>
          </div>
        </div>
      </td>
      <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap align-middle">
        <span className={`${cellText} text-white`}>{fmtPrice(artist.price)}</span>
      </td>
      <td className="px-3 py-3 text-right whitespace-nowrap align-middle">
        <span className={cellText} style={{ color: changeCss(artist.change_1d) }}>
          {fmtChange(artist.change_1d)}
        </span>
      </td>
      <td className="px-3 py-3 text-right whitespace-nowrap align-middle">
        <span className={cellText} style={{ color: changeCss(artist.change_1w) }}>
          {fmtChange(artist.change_1w)}
        </span>
      </td>
      <td className="px-3 py-3 text-right whitespace-nowrap align-middle">
        <span className={cellText} style={{ color: changeCss(artist.change_1m) }}>
          {fmtChange(artist.change_1m)}
        </span>
      </td>
      <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap align-middle">
        <span className={cellText} style={{ color: "var(--st-secondary)" }}>
          {fmtVolumeUSD(artist.volume)}
        </span>
      </td>
      <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap align-middle">
        <span className={cellText} style={{ color: "var(--st-secondary)" }}>
          {holderCount(artist.name).toLocaleString("en-US")}
        </span>
      </td>
      <td className="pl-3 pr-0 py-3 text-right align-middle">
        <div
          style={{
            width: 96,
            height: 32,
            marginLeft: "auto",
            marginTop: 4,
            marginBottom: 4,
          }}
        >
          <Sparkline
            data={artist.history}
            positive={artist.change_1w != null ? artist.change_1w >= 0 : undefined}
            revealAt={sparklineAt}
          />
        </div>
      </td>
    </tr>
  );
};

const TH: React.FC<{ children: React.ReactNode; align?: "left" | "right" }> = ({
  children,
  align = "right",
}) => (
  <th
    className={`h-8 px-3 align-middle whitespace-nowrap tabular-nums text-${align} font-normal`}
  >
    <span
      className="m-0 p-0 text-xs font-normal leading-normal"
      style={{ color: "var(--st-muted)" }}
    >
      {children}
    </span>
  </th>
);

// ── The page ───────────────────────────────────────────────────────────────
export type HomeTap = { index: number; at: number };

export const HomePage: React.FC<{
  artists: ArtistLite[];
  albums?: AlbumSlide[];
  rowsAppearAt?: number;
  sparklinesAt?: number;
  tap?: HomeTap;
}> = ({ artists, albums = [], rowsAppearAt, sparklinesAt, tap }) => {
  const byGain = [...artists].sort(
    (a, b) => (b.change_1d ?? 0) - (a.change_1d ?? 0),
  );
  const gainers = byGain.slice(0, 6);
  const byVolume = artists.slice(0, 6); // artists arrive volume-sorted
  const discover = artists.slice(0, 4);
  const spotlight = artists.slice(0, 8);
  const tableRows = artists.slice(0, 10);

  return (
    <main className="flex w-full flex-col bg-[rgb(10,10,10)] text-white pt-2">
      <div className="w-full max-w-[1480px] mx-auto">
        {/* Two-column hero section */}
        <div className="flex" style={{ minHeight: 420 }}>
          <div
            className="min-w-0 flex flex-col mr-12"
            style={{ flex: "0 0 73%" }}
          >
            {/* Slides cycle through the top-volume (household-name) artists */}
            <HeroCarousel artists={artists.slice(0, 7)} />
            {/* Featured cards (SXFeaturedCards headerTitle="Discover") */}
            <div>
              <div className="flex mt-12 items-center justify-between mb-4">
                <SectionHeading
                  title="Discover"
                  subtitle="Curated picks across the market"
                />
                <NavArrows label="1 of 4" />
              </div>
              <div className="grid gap-7 grid-cols-4">
                {discover.map((a, i) => (
                  <FeaturedCard
                    key={a.id}
                    artist={a}
                    bullets={FEATURED_BULLETS[i % FEATURED_BULLETS.length]}
                    pressAt={tap && tap.index === i ? tap.at : undefined}
                  />
                ))}
              </div>
            </div>
          </div>
          {/* Right rail: Biggest gainers + Highest volume (SXMarketMovers) */}
          <div className="flex-1 min-w-0 rounded-xl flex flex-col gap-0">
            <div className="flex items-center justify-between mb-3">
              <SectionHeading title="Biggest gainers" subtitle="Last 24 hours" />
              <NavArrows label="1 of 2" />
            </div>
            <div className="flex flex-col">
              {gainers.map((a) => (
                <GainerRow key={a.id} artist={a} />
              ))}
            </div>
            <div className="flex items-center justify-between mb-3 mt-6">
              <SectionHeading title="Highest volume" subtitle="Last 24 hours" />
              <NavArrows label="1 of 2" />
            </div>
            <div className="flex flex-col">
              {byVolume.map((a) => (
                <GainerRow key={a.id} artist={a} />
              ))}
            </div>
          </div>
        </div>

        {/* Spotlight: album slideshow + discover grid */}
        <div className="mt-12">
          <div className="flex items-center justify-between mb-4">
            <SectionHeading
              title="Spotlight"
              subtitle="Latest releases and trending markets"
            />
          </div>
          <div className="flex gap-3 items-stretch">
            <div className="flex-[0_0_38%] min-w-0 my-2 mr-3">
              <AlbumSlideshow albums={albums} />
            </div>
            <div className="flex-1 min-w-0">
              <ul className="m-0 -mx-2 list-none p-0 grid grid-cols-4 gap-2">
                {spotlight.map((a) => (
                  <DiscoverCard key={a.id} artist={a} />
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Forecast section */}
        <div className="flex items-start mt-12 justify-between gap-8 mb-4">
          <SectionHeading title="Forecast" subtitle="All markets on Sonotrade" />
          <div className="flex items-center gap-2 flex-shrink-0 pt-1">
            {/* View toggle (table active) */}
            <div
              className="flex items-center rounded-full p-0.5"
              style={{ background: "#131313" }}
            >
              <span className="flex items-center justify-center rounded-full px-2.5 py-1.5">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#808080"
                  strokeWidth="2"
                >
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
              </span>
              <span
                className="flex items-center justify-center rounded-full px-2.5 py-1.5"
                style={{ background: "#27272a" }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </span>
            </div>
            {/* Search pill */}
            <div
              className="flex items-center gap-2 rounded-full px-4 py-[9px]"
              style={{ width: 360, background: "#131313", color: "var(--st-secondary)" }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="flex-shrink-0"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <span className="m-0 p-0 text-[13px] font-normal leading-normal tracking-[-0.025em]">
                Search markets…
              </span>
            </div>
            {/* Sort button */}
            <div
              className="flex items-center gap-2 rounded-full px-4 py-[9px]"
              style={{ background: "#131313", color: "var(--st-secondary)" }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M11 5h10" />
                <path d="M11 9h7" />
                <path d="M11 13h4" />
                <path d="m3 17 3 3 3-3" />
                <path d="M6 18V4" />
              </svg>
              <span className="m-0 p-0 text-[13px] font-normal leading-normal tracking-[-0.025em]">
                Sort
              </span>
            </div>
          </div>
        </div>

        {/* Category strip */}
        <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
          {["Trending", "Biggest gainers", "New listings", "Most volume"].map(
            (t, i) => (
              <span
                key={t}
                className="inline-flex items-center rounded-full px-3 py-[5px] text-xs tracking-[-0.025em] whitespace-nowrap"
                style={
                  i === 0
                    ? { background: "#ffffff", color: "#000000", fontWeight: 500 }
                    : {
                        background: "#131313",
                        color: "var(--st-secondary)",
                        fontWeight: 400,
                      }
                }
              >
                {t}
              </span>
            ),
          )}
        </div>

        {/* Bloomberg table */}
        <div className="bg-[rgb(10,10,10)]">
          <table className="w-full table-fixed text-xs caption-bottom border-collapse">
            <colgroup>
              <col style={{ width: "4%" }} />
              <col style={{ width: "22%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "22%" }} />
            </colgroup>
            <thead>
              <tr className="border-b-0">
                <th className="h-8 pl-0 pr-3 align-middle text-left font-normal tabular-nums whitespace-nowrap">
                  <span
                    className="m-0 p-0 text-xs font-normal leading-normal"
                    style={{ color: "var(--st-muted)" }}
                  >
                    #
                  </span>
                </th>
                <TH align="left">PUBLIC FIGURE</TH>
                <TH>Index</TH>
                <TH>1D %</TH>
                <TH>1W %</TH>
                <TH>1M %</TH>
                <TH>VOLUME</TH>
                <TH>HOLDERS</TH>
                <th className="h-8 pl-3 pr-0 align-middle text-right font-normal whitespace-nowrap">
                  <span
                    className="m-0 p-0 text-xs font-normal leading-normal"
                    style={{ color: "var(--st-muted)" }}
                  >
                    CHART
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((a, i) => (
                <TableRow
                  key={a.id}
                  artist={a}
                  rank={i + 1}
                  appearAt={
                    rowsAppearAt === undefined ? undefined : rowsAppearAt + i * 2.5
                  }
                  sparklineAt={
                    sparklinesAt === undefined ? undefined : sparklinesAt + i * 2
                  }
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* Load more */}
        <div className="mt-4 w-full">
          <button
            type="button"
            className="inline-flex w-full items-center justify-center whitespace-nowrap rounded-full border border-st-border bg-transparent px-3"
            style={{ paddingTop: 12, paddingBottom: 12 }}
          >
            <span
              className="m-0 p-0 inline-flex items-center text-xs font-normal leading-none tracking-[-0.025em]"
              style={{ color: "var(--st-secondary)" }}
            >
              Load more
            </span>
          </button>
        </div>
      </div>

      {/* ── Global footer (SXFooter) — full-width #131313 band ── */}
      <footer
        className="w-full relative mt-40"
        style={{ backgroundColor: "#131313", zIndex: 2 }}
      >
        <div className="w-full max-w-[1480px] mx-auto py-20">
          {/* Main footer content */}
          <div className="flex flex-row mb-8" style={{ gap: 384 }}>
            {/* Brand section */}
            <div className="flex flex-col gap-6" style={{ maxWidth: 320 }}>
              <div className="flex items-center gap-0">
                <Img
                  src={staticFile("st-glyph.png")}
                  style={{ height: 32, width: "auto", display: "block" }}
                />
                <span
                  className="text-[1.5rem] font-normal leading-normal tracking-[-0.05em]"
                  style={{ color: colors.fg, fontFamily: fonts.sans }}
                >
                  Sonotrade
                </span>
              </div>
              <span
                className="text-sm font-normal leading-normal tracking-[-0.025em]"
                style={{ color: "var(--st-secondary)", fontFamily: fonts.sans }}
              >
                The future of entertainment
              </span>
              {/* Social links */}
              <div className="flex items-center gap-3 mt-2" style={{ color: "var(--st-secondary)" }}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" width="20" height="20">
                  <path d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2Zm0 1.5A4.25 4.25 0 0 0 3.5 7.75v8.5A4.25 4.25 0 0 0 7.75 20.5h8.5A4.25 4.25 0 0 0 20.5 16.25v-8.5A4.25 4.25 0 0 0 16.25 3.5h-8.5ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 1.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm5.25-.88a.88.88 0 1 1 0 1.76.88.88 0 0 1 0-1.76Z" />
                </svg>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1227" fill="currentColor" width="20" height="20">
                  <path d="M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866L515.491 750.218L842.672 1226.37H1200L714.137 519.284H714.163ZM569.165 687.828L521.697 619.934L144.011 87.6944H306.615L611.412 515.685L658.88 583.579L1055.08 1143.69H892.476L569.165 687.854V687.828Z" />
                </svg>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -28.5 256 256" fill="currentColor" width="20" height="20">
                  <path fillRule="nonzero" d="M216.856339,16.5966031 C200.285002,8.84328665 182.566144,3.2084988 164.041564,0 C161.766523,4.11318106 159.108624,9.64549908 157.276099,14.0464379 C137.583995,11.0849896 118.072967,11.0849896 98.7430163,14.0464379 C96.9108417,9.64549908 94.1925838,4.11318106 91.8971895,0 C73.3526068,3.2084988 55.6133949,8.86399117 39.0420583,16.6376612 C5.61752293,67.146514 -3.4433191,116.400813 1.08711069,164.955721 C23.2560196,181.510915 44.7403634,191.567697 65.8621325,198.148576 C71.0772151,190.971126 75.7283628,183.341335 79.7352139,175.300261 C72.104019,172.400575 64.7949724,168.822202 57.8887866,164.667963 C59.7209612,163.310589 61.5131304,161.891452 63.2445898,160.431257 C105.36741,180.133187 151.134928,180.133187 192.754523,160.431257 C194.506336,161.891452 196.298154,163.310589 198.110326,164.667963 C191.183787,168.842556 183.854737,172.420929 176.223542,175.320965 C180.230393,183.341335 184.861538,190.991831 190.096624,198.16893 C211.238746,191.588051 232.743023,181.531619 254.911949,164.955721 C260.227747,108.668201 245.831087,59.8662432 216.856339,16.5966031 Z M85.4738752,135.09489 C72.8290281,135.09489 62.4592217,123.290155 62.4592217,108.914901 C62.4592217,94.5396472 72.607595,82.7145587 85.4738752,82.7145587 C98.3405064,82.7145587 108.709962,94.5189427 108.488529,108.914901 C108.508531,123.290155 98.3405064,135.09489 85.4738752,135.09489 Z M170.525237,135.09489 C157.88039,135.09489 147.510584,123.290155 147.510584,108.914901 C147.510584,94.5396472 157.658606,82.7145587 170.525237,82.7145587 C183.391518,82.7145587 193.761324,94.5189427 193.539891,108.914901 C193.539891,123.290155 183.391518,135.09489 170.525237,135.09489 Z" />
                </svg>
                <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" width="20" height="20">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-9h3v9zm-1.5-10.271c-.966 0-1.75-.784-1.75-1.75s.784-1.75 1.75-1.75 1.75.784 1.75 1.75-.784 1.75-1.75 1.75zm13.5 10.271h-3v-4.5c0-1.121-.879-2-2-2s-2 .879-2 2v4.5h-3v-9h3v1.189c.819-1.064 2.319-1.189 3.5-1.189 2.209 0 4 1.791 4 4v5z" />
                </svg>
              </div>
            </div>

            {/* Links sections */}
            <div className="flex flex-1" style={{ gap: 384 }}>
              <div className="flex flex-col gap-4">
                <span
                  style={{
                    fontFamily: fonts.sans,
                    fontSize: 16,
                    letterSpacing: "-0.025em",
                    color: colors.fg,
                  }}
                >
                  Menu
                </span>
                <ul className="flex flex-col gap-3 list-none m-0 p-0">
                  {["Home", "About", "Contact", "Data & Research"].map((label) => (
                    <li key={label}>
                      <span
                        className="m-0 p-0 text-[13px] font-normal leading-normal tracking-[-0.025em]"
                        style={{ color: "var(--st-secondary)", fontFamily: fonts.sans }}
                      >
                        {label}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-col gap-4">
                <span
                  style={{
                    fontFamily: fonts.sans,
                    fontSize: 16,
                    letterSpacing: "-0.025em",
                    color: colors.fg,
                  }}
                >
                  Other
                </span>
                <ul className="flex flex-col gap-3 list-none m-0 p-0">
                  {["FAQ", "Privacy", "Terms"].map((label) => (
                    <li key={label}>
                      <span
                        className="m-0 p-0 text-[13px] font-normal leading-normal tracking-[-0.025em]"
                        style={{ color: "var(--st-secondary)", fontFamily: fonts.sans }}
                      >
                        {label}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Legal disclaimer */}
          <div className="pt-8 pb-6 border-t" style={{ borderColor: "var(--st-border)" }}>
            <p
              className="m-0 leading-relaxed"
              style={{ fontSize: "0.72rem", color: "var(--st-muted)", fontFamily: fonts.sans }}
            >
              <strong style={{ color: "var(--st-secondary)", fontWeight: 500 }}>
                Simulated trading only.
              </strong>{" "}
              All trading activity on this platform uses simulated funds. No real money is at
              risk. When Sonotrade launches live trading, it will operate as a CFTC-registered
              derivatives platform subject to applicable regulatory requirements under the
              Commodity Exchange Act.
            </p>
            <p
              className="m-0 mt-3 leading-relaxed"
              style={{ fontSize: "0.72rem", color: "var(--st-muted)", fontFamily: fonts.sans }}
            >
              Derivative products involve a significant risk of loss and are not suitable for
              all participants. You may lose more than your initial deposit. Past performance is
              not indicative of future results. Information provided on this website is for
              informational purposes only and does not constitute an offer to sell, a
              solicitation to buy, or a recommendation for any derivative contract or investment
              product. Sonotrade does not provide investment, legal, or tax advice.
            </p>
          </div>

          {/* Bottom bar */}
          <div className="pt-6 border-t" style={{ borderColor: "var(--st-border)" }}>
            <span
              className="text-xs font-normal leading-normal tracking-[-0.025em]"
              style={{ color: "var(--st-secondary)", fontFamily: fonts.sans }}
            >
              © 2026 Sonotrade
            </span>
          </div>
        </div>
      </footer>
    </main>
  );
};
