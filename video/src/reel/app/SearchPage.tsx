import React from "react";
import { Img, interpolate, useCurrentFrame } from "remotion";
import { fonts } from "../../brand";
import { SNAP } from "../text";
import type { ArtistLite } from "../data";

// Pixel recreation of app/search/page.tsx: search pill + Search button,
// industry chips, and the 2-column MobileGrid profile cards.

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

const fmtVol = (v: number | null): string => {
  if (v == null) return "Vol. —";
  if (v >= 1_000_000_000) return `Vol. $${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `Vol. $${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `Vol. $${(v / 1_000).toFixed(1)}K`;
  return `Vol. $${v.toFixed(0)}`;
};

const TrendArrow: React.FC<{ positive: boolean }> = ({ positive }) => (
  <svg
    viewBox="0 0 24 18"
    width="11"
    height="11"
    style={{
      color: positive ? "var(--st-positive)" : "var(--st-chart-negative)",
      transform: `rotate(${positive ? "0deg" : "180deg"})`,
      flexShrink: 0,
      alignSelf: "center",
      marginTop: 1,
    }}
  >
    <path fill="currentColor" d="m12 0 10.392 14.25H1.608z" />
  </svg>
);

const CATEGORIES = ["All", "Hip-Hop", "Pop", "Rock", "R&B", "Latin", "Electronic"];

export type SearchPageProps = {
  artists: ArtistLite[];
  query?: string;
  typeAt?: [number, number] | null;
  resultsAt?: number;
};

export const SEARCH_W = 1600;
export const SEARCH_H = 900;
const INNER_W = 640;

// World-space anchors for camera keyframes.
export const SEARCH_LANDMARKS = {
  searchBar: { x: 800, y: 44 },
  grid: { x: 800, y: 420 },
};

const GridCard: React.FC<{ artist: ArtistLite; at: number }> = ({ artist, at }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [at, at + 10], [0, 1], { ...clamp, easing: SNAP });
  const ty = interpolate(frame, [at, at + 12], [20, 0], { ...clamp, easing: SNAP });
  const isPositive = artist.change_1m >= 0;
  return (
    <div style={{ opacity: o, transform: `translateY(${ty}px)` }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          padding: 8,
          borderRadius: 4,
        }}
      >
        {/* Square image */}
        <div className="relative aspect-square w-full overflow-hidden rounded-sm bg-zinc-800">
          {artist.image ? (
            <Img
              src={artist.image}
              className="h-full w-full object-cover"
              pauseWhenLoading
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center bg-zinc-800">
              <span className="text-2xl font-semibold text-zinc-500 select-none">
                {artist.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>
        {/* Text */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <div className="truncate" style={{ minWidth: 0 }}>
              <span className="text-sm font-medium tracking-[-0.025em] text-white">
                {artist.name}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
              <TrendArrow positive={isPositive} />
              <span
                className="whitespace-nowrap tabular-nums text-xs"
                style={{
                  color: isPositive ? "var(--st-positive)" : "var(--st-chart-negative)",
                }}
              >
                {Math.abs(artist.change_1m).toFixed(2)}%
              </span>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <span
              className="text-xs tracking-[-0.025em]"
              style={{ color: "var(--st-secondary)" }}
            >
              {artist.price.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            <span className="text-xs" style={{ color: "var(--st-muted)" }}>
              {fmtVol(artist.volume)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const SearchPage: React.FC<SearchPageProps> = ({
  artists,
  query = "",
  typeAt = null,
  resultsAt = 20,
}) => {
  const frame = useCurrentFrame();

  const typedChars = typeAt
    ? Math.round(interpolate(frame, [typeAt[0], typeAt[1]], [0, query.length], clamp))
    : query.length;
  const typed = query.slice(0, typedChars);
  const typingActive = typeAt !== null && frame >= typeAt[0] && frame <= typeAt[1] + 15;
  const caretOn = frame % 18 < 9;

  // Real page unmounts the chips once a query is typed; we fade them instead so
  // the grid position stays stable for the camera.
  const chipsO = typed.length > 0 ? interpolate(frame, [typeAt?.[0] ?? 0, (typeAt?.[0] ?? 0) + 8], [1, 0], clamp) : 1;

  return (
    <div
      style={{
        width: SEARCH_W,
        minHeight: SEARCH_H,
        background: "rgb(10,10,10)",
        fontFamily: fonts.sans,
        color: "#fff",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ width: INNER_W }}>
        {/* Search bar + button */}
        <div style={{ padding: "16px 12px 12px", display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "#111",
              border: "1px solid #2a2a2a",
              borderRadius: 10,
              padding: "0 12px",
              height: 44,
            }}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: "#52525b", flexShrink: 0 }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span style={{ flex: 1, color: "#fff", fontSize: 15, whiteSpace: "nowrap" }}>
              {typed === "" && !typingActive ? (
                <span style={{ color: "#52525b" }}>Search markets...</span>
              ) : (
                typed
              )}
              {typingActive ? (
                <span
                  style={{
                    display: "inline-block",
                    width: 2,
                    height: 15,
                    marginLeft: 2,
                    background: "#fff",
                    opacity: caretOn ? 1 : 0,
                    translate: "0px 2px",
                  }}
                />
              ) : null}
            </span>
            {typed.length > 0 ? (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#52525b"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : null}
          </div>
          <div
            style={{
              height: 44,
              padding: "0 14px",
              borderRadius: 10,
              border: "1px solid #2a2a2a",
              background: "transparent",
              color: "#a1a1aa",
              fontSize: 14,
              fontWeight: 500,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
            }}
          >
            Search
          </div>
        </div>

        {/* Industry chips */}
        <div style={{ position: "relative", marginBottom: 8, opacity: chipsO }}>
          <div style={{ display: "flex", gap: 6, overflow: "hidden", padding: "0 12px 12px" }}>
            {CATEGORIES.map((cat) => {
              const active = cat === "All";
              return (
                <span
                  key={cat}
                  style={{
                    flexShrink: 0,
                    padding: "6px 12px",
                    borderRadius: 999,
                    border: `1px solid ${active ? "#fff" : "#2a2a2a"}`,
                    background: active ? "#fff" : "transparent",
                    color: active ? "#000" : "#a1a1aa",
                    fontSize: 13,
                    fontWeight: active ? 600 : 400,
                    whiteSpace: "nowrap",
                  }}
                >
                  {cat}
                </span>
              );
            })}
          </div>
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              width: 40,
              background: "linear-gradient(to left, rgb(10,10,10), transparent)",
            }}
          />
        </div>

        {/* Results grid */}
        <div className="px-3">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              columnGap: 0,
              rowGap: 6,
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            {artists.map((artist, i) => (
              <GridCard key={artist.id} artist={artist} at={resultsAt + i * 3} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
