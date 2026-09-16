import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { colors } from "../../brand";
import { ArtistFull, ArtistLite } from "../data";
import { CAM_EASE } from "../camera";
import { AppFrame, HEADER_H } from "../app/chrome";
import {
  ArtistPage,
  ARTIST_H,
  ARTIST_LANDMARKS,
  CHART_GEOM,
} from "../app/ArtistPage";
import { TradingPanel, TRADING_PANEL_W } from "../app/TradingPanel";

// The line chart draws itself like a snake — slower than the app's 1s draw —
// with the camera locked on the glowing head. The camera path is a low-pass
// smoothing of the tip trajectory (windowed average), so the head stays
// pinned near center without the surroundings shaking. ~210 frames.
export const CHARTDRAW_DURATION = 210;

const DRAW_AT = 10;
const DRAW_FRAMES = 150; // app draws in 30f; 5× slower here
const DRAW_END = DRAW_AT + DRAW_FRAMES;
const FOLLOW_SCALE = 3.1;

const L = ARTIST_LANDMARKS;
const oy = (y: number) => y + HEADER_H;

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

// Mirrors PriceChart's point mapping: sorted data + the 4% "now" tail,
// x over inner plot width, y over V_PAD_TOP..height - V_PAD_BOTTOM.
const chartPoints = (artist: ArtistFull): Array<[number, number]> => {
  const sorted = [...artist.history].sort((a, b) => a.timestamp - b.timestamp);
  if (sorted.length < 2) return [];
  const data = sorted;
  const start = data[0].timestamp;
  const range = data[data.length - 1].timestamp - start || 1;
  const min = Math.min(...data.map((d) => d.price));
  const max = Math.max(...data.map((d) => d.price));
  const plotW = CHART_GEOM.width - 56;
  const plotTop = 40;
  const plotH = CHART_GEOM.height - 40 - 56;
  return data.map((d) => [
    CHART_GEOM.left + ((d.timestamp - start) / range) * plotW,
    CHART_GEOM.top + plotTop + (1 - (d.price - min) / (max - min || 1)) * plotH,
  ]);
};

export const ChartDrawScene: React.FC<{
  artist: ArtistFull;
  related?: ArtistLite[];
}> = ({ artist, related = [] }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const pts = chartPoints(artist);

  // Cumulative polyline lengths → tip position at a given draw progress.
  const segLens: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    segLens.push(
      segLens[i - 1] +
        Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]),
    );
  }
  const total = segLens[segLens.length - 1] || 1;
  const tipAt = (t: number): [number, number] => {
    const drawn = total * t;
    for (let i = 1; i < pts.length; i++) {
      if (segLens[i] >= drawn) {
        const f = (drawn - segLens[i - 1]) / (segLens[i] - segLens[i - 1] || 1);
        return [
          pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f,
          pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f,
        ];
      }
    }
    return pts[pts.length - 1] ?? [L.chartCenter.x, L.chartCenter.y];
  };
  const tipAtFrame = (f: number): [number, number] =>
    tipAt(easeOutCubic(Math.min(1, Math.max(0, (f - DRAW_AT) / DRAW_FRAMES))));

  // Low-pass camera: average the tip over a window around the frame. The
  // vertical axis gets a wider window — the line's wiggles are vertical, and
  // this is what keeps the surroundings steady.
  const smoothTip = (f: number): [number, number] => {
    let sx = 0;
    let nx = 0;
    for (let s = f - 12; s <= f + 12; s += 3) {
      sx += tipAtFrame(s)[0];
      nx++;
    }
    let sy = 0;
    let ny = 0;
    for (let s = f - 26; s <= f + 26; s += 4) {
      sy += tipAtFrame(s)[1];
      ny++;
    }
    return [sx / nx, sy / ny];
  };

  // Camera state per frame: locked follow during the draw, then a pull-back
  // to the full chart to hand off to the marker dive.
  let camX: number;
  let camY: number;
  let camScale: number;
  const [smX, smY] = smoothTip(Math.min(frame, DRAW_END));
  if (frame <= DRAW_END) {
    // Gentle push-in at the start, then constant zoom (constant scale =
    // no perceived shake from zoom changes).
    camScale = interpolate(frame, [0, DRAW_AT + 20], [2.4, FOLLOW_SCALE], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: CAM_EASE,
    });
    camX = smX;
    camY = oy(smY);
  } else {
    const t = interpolate(frame, [DRAW_END, DRAW_END + 34], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: CAM_EASE,
    });
    camX = smX + (L.chartCenter.x - smX) * t;
    camY = oy(smY) + (980 - oy(smY)) * t;
    camScale = FOLLOW_SCALE + (0.97 - FOLLOW_SCALE) * t;
  }

  const tipNow = tipAtFrame(frame);

  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg }}>
      <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            transformOrigin: "0 0",
            translate: `${width / 2 - camX * camScale}px ${height / 2 - camY * camScale}px`,
            scale: `${camScale}`,
          }}
        >
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
                drawAt: DRAW_AT,
                drawFrames: DRAW_FRAMES,
                markersAt: DRAW_END + 10,
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
            {/* The glowing head of the line while it draws */}
            {pts.length > 1 && frame >= DRAW_AT && frame <= DRAW_END + 4 ? (
              <div
                style={{
                  position: "absolute",
                  left: tipNow[0] - 5,
                  top: oy(tipNow[1]) - 5,
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: "#04df9d",
                  boxShadow:
                    "0 0 14px rgba(4,223,157,0.9), 0 0 34px rgba(4,223,157,0.5)",
                }}
              />
            ) : null}
          </AppFrame>
        </div>
      </div>
    </AbsoluteFill>
  );
};
