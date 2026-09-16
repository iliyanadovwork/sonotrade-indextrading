import React from "react";
import { useCurrentFrame } from "remotion";
import { ArtistFull, ArtistLite, Release } from "../data";
import { Stage } from "./stage";
import { AppFrame, HEADER_H } from "../app/chrome";
import { ArtistPage, ARTIST_H, ARTIST_LANDMARKS } from "../app/ArtistPage";
import { TradingPanel, TRADING_PANEL_W } from "../app/TradingPanel";
import { Sfx } from "../sfx";

// The signature shot: the release markers — album covers as circles under the
// chart's x-axis. Camera dives to the marker row and hops cover to cover,
// popping each with its title, then a crosshair sweep over the full chart.
// ~230 frames.
export const CHART_DURATION = 230;

const L = ARTIST_LANDMARKS;
const oy = (y: number) => y + HEADER_H;

// Chart geometry inside ArtistPage: 1076-wide chart at x=60 (chartCenter 598),
// inner plot width = width - FUTURE_PAD(56).
const CHART_LEFT = 60;
const CHART_W = 1076 - 56;

// Mirrors PriceChart's releaseMarkers exactly (dedupe by date preferring
// ALBUM, insertion order, date mapped over the data span) so hover indices and world x positions line up 1:1.
const computeMarkers = (artist: ArtistFull) => {
  const sorted = [...artist.history].sort((a, b) => a.timestamp - b.timestamp);
  if (sorted.length < 2) return [];
  const startTime = sorted[0].timestamp;
  const endTime = sorted[sorted.length - 1].timestamp;
  const timeRange = endTime - startTime || 1;

  const byDate = new Map<string, Release>();
  for (const r of artist.releases) {
    const key = r.date ?? "";
    if (!key) continue;
    const existing = byDate.get(key);
    if (!existing || (r.type === "ALBUM" && existing.type !== "ALBUM")) {
      byDate.set(key, r);
    }
  }
  return Array.from(byDate.values())
    .map((r, idx) => {
      const ms = r.date ? new Date(r.date).getTime() : null;
      if (!ms || ms < startTime || ms > endTime) return null;
      const x = ((ms - startTime) / timeRange) * CHART_W;
      return { idx, x, name: r.name, hasImage: Boolean(r.image) };
    })
    .filter((m): m is NonNullable<typeof m> => m !== null);
};

// Camera hop schedule over three markers.
const HOP = [
  { arrive: 24, hoverFrom: 58, hoverTo: 94 },
  { arrive: 104, hoverFrom: 108, hoverTo: 134 },
  { arrive: 144, hoverFrom: 148, hoverTo: 174 },
];

export const ChartScene: React.FC<{
  artist: ArtistFull;
  related?: ArtistLite[];
}> = ({ artist, related = [] }) => {
  const frame = useCurrentFrame();

  const markers = computeMarkers(artist);
  // Prefer markers with artwork, spread left → right across the chart.
  const pool = (markers.some((m) => m.hasImage)
    ? markers.filter((m) => m.hasImage)
    : markers
  ).sort((a, b) => a.x - b.x);
  const targets =
    pool.length <= 3
      ? pool
      : [pool[0], pool[Math.floor(pool.length / 2)], pool[pool.length - 1]];

  const markerWorldY = oy(L.markersCenter.y);
  const wx = (m: { x: number }) => CHART_LEFT + m.x;

  const active = targets
    .map((t, i) => ({ t, hop: HOP[i] }))
    .filter((p) => p.hop)
    .find(
      (p) => frame >= p.hop.hoverFrom - 4 && frame <= p.hop.hoverTo + 6,
    );
  const hoverMarker = active
    ? { idx: active.t.idx, from: active.hop.hoverFrom, to: active.hop.hoverTo }
    : null;

  // Camera: dive to marker row, hop across the chosen covers, pull back for
  // the crosshair sweep. Falls back to a plain chart push if no markers.
  const hops =
    targets.length > 0
      ? [
          // Open matching ArtistScene's ending: the whole chart in frame,
          // viewport top pinned to the page top.
          { frame: 0, x: L.chartCenter.x, y: 980, scale: 0.97 },
          { frame: HOP[0].arrive, x: wx(targets[0]), y: markerWorldY - 12, scale: 2.45 },
          { frame: 94, x: wx(targets[0]), y: markerWorldY - 12, scale: 2.6 },
          ...(targets[1]
            ? [
                { frame: HOP[1].arrive, x: wx(targets[1]), y: markerWorldY - 12, scale: 2.5 },
                { frame: 134, x: wx(targets[1]), y: markerWorldY - 12, scale: 2.62 },
              ]
            : []),
          ...(targets[2]
            ? [
                { frame: HOP[2].arrive, x: wx(targets[2]), y: markerWorldY - 12, scale: 2.5 },
                { frame: 174, x: wx(targets[2]), y: markerWorldY - 12, scale: 2.62 },
              ]
            : []),
          // Pull all the way out: the entire chart fits edge to edge for
          // the crosshair sweep, page top pinned to the viewport top.
          { frame: 196, x: L.chartCenter.x, y: 990, scale: 0.95 },
          { frame: 228, x: L.chartCenter.x, y: 980, scale: 0.99 },
        ]
      : [
          { frame: 0, x: L.chartCenter.x, y: 990, scale: 0.95 },
          { frame: 228, x: L.chartCenter.x, y: 980, scale: 1.0 },
        ];

  return (
    <>
      <Sfx name="pop" at={26} volume={0.4} />
      <Sfx name="pop" at={60} volume={0.35} />
      <Sfx name="pop" at={110} volume={0.35} />
      <Sfx name="pop" at={150} volume={0.35} />
      <Stage keyframes={hops}>
        <AppFrame
          height={ARTIST_H}
          user={{ cash: "$10,000.00", portfolio: "$10,000.00", name: "Angel" }}
        >
          <ArtistPage
            artist={artist}
            priceAt={-40}
            liveDotOn
            statsAt={-40}
            chartProps={{
              drawAt: -40,
              markersAt: 22,
              hoverMarker,
              hoverSweep: { from: 196, to: 226 },
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 1160,
              top: HEADER_H + 8,
              width: TRADING_PANEL_W,
            }}
          >
            <TradingPanel
              artistName={artist.name}
              price={artist.price}
              side="up"
              amountText=""
              typeAt={null}
              related={related}
            />
          </div>
        </AppFrame>
      </Stage>
    </>
  );
};
