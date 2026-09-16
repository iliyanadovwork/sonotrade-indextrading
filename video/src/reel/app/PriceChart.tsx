import React from "react";
import { Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { colors, fonts, RELEASE_COLORS } from "../../brand";
import type { PricePoint, Release } from "../data";

// ── 1:1 recreation of components/sx/SXPriceChart.tsx, driven by frames ──────
// Geometry constants copied verbatim from the app.
const V_PAD_TOP = 40;
const V_PAD_BOTTOM = 56;
const FUTURE_PAD = 56;

const POP = Easing.bezier(0.34, 1.56, 0.64, 1);
const SNAP = Easing.bezier(0.2, 0.9, 0.1, 1);
const EASE_OUT_CUBIC = (t: number) => 1 - Math.pow(1 - t, 3);

// lib/format-time.ts
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

const formatChartLabel = (ms: number): string => {
  const d = new Date(ms);
  const mon = MONTHS[d.getMonth()];
  const day = d.getDate();
  let hours = d.getHours();
  const mins = d.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${mon} ${day}, ${hours}:${mins} ${ampm}`;
};

const formatChartXTick = (timestamp: number): string => {
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}/${date.getDate()}`;
};

// SXPriceChart.pickPriceDecimals, verbatim.
export function pickPriceDecimals(value: number, range?: number): number {
  const v = Math.abs(value);
  const r = range != null ? Math.abs(range) : v;
  if (r < 0.0001 && v > 0) return 6;
  if (r < 0.001) return 5;
  if (r < 0.01) return 4;
  if (r < 0.1) return 3;
  return 2;
}

const formatPriceAdaptive = (value: number, range?: number): string =>
  value.toFixed(pickPriceDecimals(value, range));

// ── Odometer price (AnimatedPrice / DigitRoller equivalent) ─────────────────
// Each digit is a 0-9 column that rolls to its target starting at `at`,
// staggered slightly per digit like the app's springy DigitRoller.
const DigitColumn: React.FC<{
  digit: number;
  fontSize: number;
  at: number;
  stagger: number;
  color: string;
}> = ({ digit, fontSize, at, stagger, color }) => {
  const frame = useCurrentFrame();
  const h = fontSize * 1.2;
  const w = fontSize * 0.62;
  const rolled = interpolate(frame, [at + stagger, at + stagger + 14], [0, digit], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: SNAP,
  });
  return (
    <div style={{ height: h, width: w, overflow: "hidden", display: "inline-block", flexShrink: 0 }}>
      <div style={{ transform: `translateY(${-rolled * h}px)` }}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <div
            key={d}
            style={{
              height: h,
              width: w,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: fonts.sans,
              fontSize,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color,
            }}
          >
            {d}
          </div>
        ))}
      </div>
    </div>
  );
};

export const OdometerPrice: React.FC<{
  value: number;
  at?: number;
  fontSize?: number;
  color?: string;
  prefix?: string;
  suffix?: string;
}> = ({ value, at = 0, fontSize = 28, color = colors.fg, prefix, suffix }) => {
  const frame = useCurrentFrame();
  const formatted = formatPriceAdaptive(value);
  const h = fontSize * 1.2;
  const opacity = interpolate(frame, [at, at + 6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const staticSpan = (char: string, key: string) => (
    <span
      key={key}
      style={{
        display: "inline-block",
        flexShrink: 0,
        fontFamily: fonts.sans,
        fontSize,
        fontWeight: 600,
        letterSpacing: "-0.02em",
        lineHeight: `${h}px`,
        color,
      }}
    >
      {char}
    </span>
  );
  return (
    <div style={{ display: "inline-flex", alignItems: "center", height: h, opacity }}>
      {prefix ? staticSpan(prefix, "prefix") : null}
      {formatted.split("").map((char, i) => {
        const d = parseInt(char, 10);
        if (!isNaN(d)) {
          return (
            <DigitColumn key={i} digit={d} fontSize={fontSize} at={at} stagger={i * 1.5} color={color} />
          );
        }
        return staticSpan(char, `c-${i}`);
      })}
      {suffix ? staticSpan(suffix, "suffix") : null}
    </div>
  );
};

// ── Main chart ──────────────────────────────────────────────────────────────
export type PriceChartProps = {
  data: PricePoint[];
  releases?: Release[];
  width: number;
  height: number;
  drawAt?: number;
  drawFrames?: number;
  markersAt?: number;
  hoverMarker?: { idx: number; from: number; to: number } | null;
  hoverSweep?: { from: number; to: number } | null;
  hideYAxis?: boolean;
  periodActive?: string;
};

const DEFAULT_DRAW_FRAMES = 30; // app: 1000ms cubic ease-out @ ~30fps
const SPARK_CYCLE = 474; // app: 15.8s loop
const SPARK_TRAVEL = 24; // app: first 5.1% of the cycle = ~0.8s sweep

export const PriceChart: React.FC<PriceChartProps> = ({
  data,
  releases = [],
  width,
  height,
  drawAt = 0,
  drawFrames = DEFAULT_DRAW_FRAMES,
  markersAt,
  hoverMarker = null,
  hoverSweep = null,
  hideYAxis = false,
  periodActive = "ALL",
}) => {
  const frame = useCurrentFrame();
  const W = width;
  const CHART_H = height;
  const CHART_W = W - FUTURE_PAD;
  const markersFrom = markersAt ?? drawAt + drawFrames;

  // chartData: sorted history — no flat "extend to now" tail; the line spans
  // the full plot width and ends at the latest real point.
  const chartData = React.useMemo(
    () => [...data].sort((a, b) => a.timestamp - b.timestamp),
    [data],
  );

  const firstPrice = chartData[0]?.price ?? 0;
  const lastPrice = chartData[chartData.length - 1]?.price ?? 0;
  const isPositive = lastPrice >= firstPrice;
  const color = isPositive ? colors.positive : colors.negative;

  const startTime = chartData[0]?.timestamp ?? 0;
  const endTime = chartData[chartData.length - 1]?.timestamp ?? startTime + 1;
  const timeRange = endTime - startTime || 1;
  const minPrice = chartData.length > 0 ? Math.min(...chartData.map((d) => d.price)) : 0;
  const maxPrice = chartData.length > 0 ? Math.max(...chartData.map((d) => d.price)) : 1;
  const priceRange = maxPrice === minPrice ? 1 : maxPrice - minPrice;

  const toY = (price: number) =>
    V_PAD_TOP + (1 - (price - minPrice) / priceRange) * (CHART_H - V_PAD_TOP - V_PAD_BOTTOM);

  const points = React.useMemo(
    () =>
      chartData.map((d) => ({
        x: ((d.timestamp - startTime) / timeRange) * CHART_W,
        y: toY(d.price),
        price: d.price,
        timestamp: d.timestamp,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chartData, CHART_W, CHART_H, startTime, timeRange, minPrice, priceRange],
  );

  const linePath = React.useMemo(() => {
    if (points.length === 0) return "";
    return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  }, [points]);

  // Polyline length — exact for the app's linear path, no getTotalLength needed.
  const pathLength = React.useMemo(() => {
    let len = 0;
    for (let i = 1; i < points.length; i++) {
      len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    }
    return len;
  }, [points]);

  // Draw-on progress (app: 1s, eased 1-(1-t)^3).
  const drawT = interpolate(frame, [drawAt, drawAt + drawFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const drawProgress = EASE_OUT_CUBIC(drawT);
  const drawDone = frame >= drawAt + drawFrames;
  const dashOffset = pathLength > 0 ? (pathLength + 4) * (1 - drawProgress) : 0;

  // Hover sweep state: cursor x sweeps across the chart between from..to.
  const sweepActive =
    hoverSweep != null && frame >= hoverSweep.from && frame <= hoverSweep.to;
  let hover: { x: number; y: number; price: number; timestamp: number } | null = null;
  if (sweepActive && points.length >= 2 && hoverSweep) {
    const sweepX = interpolate(
      frame,
      [hoverSweep.from, hoverSweep.to],
      [CHART_W * 0.06, CHART_W * 0.97],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.4, 0, 0.4, 1) },
    );
    // Stepwise lookup, same as the app's binary search over point x.
    let lo = 0;
    for (let i = 0; i < points.length - 1; i++) {
      if (points[i].x <= sweepX) lo = i;
      else break;
    }
    hover = { x: sweepX, y: points[lo].y, price: points[lo].price, timestamp: points[lo].timestamp };
  }

  // Spark pulse: travels the path in the first ~24 frames of each 474-frame
  // cycle after the draw completes (app: 15.8s SMIL loop, 60px bright dash).
  const sparkStart = drawAt + drawFrames + 30;
  const sparkT = frame >= sparkStart ? (frame - sparkStart) % SPARK_CYCLE : -1;
  const sparkVisible = sparkT >= 0 && sparkT <= SPARK_TRAVEL && pathLength > 0;
  const sparkOffset = sparkVisible
    ? interpolate(sparkT, [0, SPARK_TRAVEL], [60, -pathLength])
    : 60;

  // Pulsating last-point dot (app: sxDotPulse 0.9s ease-out infinite = 27f).
  const last = points[points.length - 1];
  const pulseT = (frame % 27) / 27;
  const pulseR = 3.5 * (1 + 2.2 * EASE_OUT_CUBIC(pulseT));
  const pulseOpacity = (1 - EASE_OUT_CUBIC(pulseT)) * 0.7;

  // Release markers (dedupe by date preferring ALBUM), verbatim mapping.
  const releaseMarkers = React.useMemo(() => {
    if (!releases.length || !chartData.length) return [];
    const byDate = new Map<string, Release>();
    for (const r of releases) {
      const key = r.date ?? "";
      if (!key) continue;
      const existing = byDate.get(key);
      if (!existing || (r.type === "ALBUM" && existing.type !== "ALBUM")) {
        byDate.set(key, r);
      }
    }
    return Array.from(byDate.values())
      .map((r) => {
        const ms = r.date ? new Date(r.date).getTime() : null;
        if (!ms || ms < startTime || ms > endTime) return null;
        const x = ((ms - startTime) / timeRange) * CHART_W;
        return { x, type: r.type ?? "SINGLE", name: r.name, release: r };
      })
      .filter(Boolean) as { x: number; type: string; name: string; release: Release }[];
  }, [releases, chartData.length, startTime, endTime, timeRange, CHART_W]);

  const markerY = CHART_H - V_PAD_BOTTOM + 10;
  const imgR = 10;

  // X ticks — 5 evenly spaced, hidden while the hover sweep is active.
  const xTicks = Array.from({ length: 5 }, (_, i) => startTime + (i * timeRange) / 4);

  const periods = ["1H", "1D", "1W", "1M", "ALL"];

  return (
    <div style={{ width: W }}>
      <div style={{ width: W, height: CHART_H, position: "relative" }}>
        <svg width={W} height={CHART_H} style={{ display: "block", overflow: "visible" }}>
          {/* Dashed horizontal grid lines + right-edge price labels */}
          {[0, 0.25, 0.5, 0.75].map((frac) => {
            const y = frac * CHART_H;
            const chartAreaH = CHART_H - V_PAD_TOP - V_PAD_BOTTOM;
            const price =
              chartAreaH > 0 ? minPrice + (1 - (y - V_PAD_TOP) / chartAreaH) * priceRange : null;
            return (
              <g key={frac}>
                <line
                  x1={0}
                  y1={y}
                  x2={hideYAxis ? W : CHART_W + 12}
                  y2={y}
                  stroke={hideYAxis ? "#2a2a2a" : "#3a3a3a"}
                  strokeWidth="1"
                  strokeDasharray="2 5"
                />
                {price != null && !hideYAxis && (
                  <text
                    x={W - 2}
                    y={y}
                    textAnchor="end"
                    dominantBaseline="middle"
                    style={{ fill: colors.secondary, fontSize: 10, fontFamily: fonts.sans }}
                  >
                    {formatPriceAdaptive(price, priceRange)}
                  </text>
                )}
              </g>
            );
          })}

          <defs>
            <filter id="sparkFilter" x="-5%" y="-300%" width="110%" height="700%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
            </filter>
            {hover && (
              <>
                <clipPath id="pc-hover-left">
                  <rect x={0} y={-20} width={hover.x} height={CHART_H + 40} />
                </clipPath>
                <clipPath id="pc-hover-right">
                  <rect x={hover.x} y={-20} width={CHART_W + 40} height={CHART_H + 40} />
                </clipPath>
              </>
            )}
          </defs>

          {/* Chart line, draw-on via dashoffset over the true polyline length */}
          {linePath && (
            <>
              <path
                d={linePath}
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeDasharray={pathLength}
                strokeDashoffset={dashOffset}
                clipPath={hover ? "url(#pc-hover-left)" : undefined}
              />
              {hover && (
                <path
                  d={linePath}
                  fill="none"
                  stroke={color}
                  strokeWidth="2"
                  strokeDasharray={pathLength}
                  strokeDashoffset={dashOffset}
                  clipPath="url(#pc-hover-right)"
                  opacity={0.15}
                />
              )}
            </>
          )}

          {/* Traveling spark pulse */}
          {linePath && sparkVisible && (
            <path
              d={linePath}
              fill="none"
              stroke={`color-mix(in oklch, ${color} 60%, white)`}
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={`60 ${pathLength + 60}`}
              strokeDashoffset={sparkOffset}
              filter="url(#sparkFilter)"
              clipPath={hover ? "url(#pc-hover-left)" : undefined}
            />
          )}

          {/* Pulsating dot at last point */}
          {last && drawDone && !hover && (
            <>
              <circle cx={last.x} cy={last.y} r={pulseR} fill={color} opacity={pulseOpacity} />
              <circle cx={last.x} cy={last.y} r="3.5" fill={color} />
            </>
          )}

          {/* Hover crosshair */}
          {hover && (
            <g>
              <line
                x1={hover.x}
                y1={-12}
                x2={hover.x}
                y2={CHART_H - V_PAD_BOTTOM + 18}
                stroke="rgba(255,255,255,0.4)"
                strokeWidth="1"
              />
              <circle
                cx={hover.x}
                cy={hover.y}
                r="4"
                fill={color}
                stroke="rgba(255,255,255,0.5)"
                strokeWidth="1.5"
              />
            </g>
          )}

          {/* Release marker connectors + hover labels (SVG layer) */}
          {releaseMarkers.map((rm, i) => {
            const hm = hoverMarker && hoverMarker.idx === i ? hoverMarker : null;
            const isHovered = hm != null && frame >= hm.from && frame <= hm.to;
            const labelOpacity = hm
              ? interpolate(frame, [hm.from, hm.from + 5, hm.to, hm.to + 5], [0, 1, 1, 0], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                })
              : 0;
            const appear = interpolate(frame, [markersFrom + i * 3, markersFrom + i * 3 + 8], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const labelText = rm.release.name;
            return (
              <g key={i} opacity={appear}>
                <line
                  x1={rm.x}
                  y1={-12}
                  x2={rm.x}
                  y2={markerY - imgR}
                  stroke={isHovered ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)"}
                  strokeWidth="1"
                />
                <text
                  x={rm.x}
                  y={markerY - imgR - 18}
                  textAnchor="middle"
                  style={{
                    fill: "#e4e4e7",
                    fontSize: 10,
                    fontFamily: fonts.sans,
                    fontWeight: 600,
                    opacity: labelOpacity,
                  }}
                >
                  {labelText.length > 18 ? labelText.slice(0, 17) + "…" : labelText}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Release marker album circles — HTML layer so Remotion's Img waits
            for the scdn artwork during render. Geometry identical to the SVG
            markers: 20px circle centered at (x, markerY). */}
        {releaseMarkers.map((rm, i) => {
          const hm = hoverMarker && hoverMarker.idx === i ? hoverMarker : null;
          const popIn = interpolate(frame, [markersFrom + i * 3, markersFrom + i * 3 + 12], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: POP,
          });
          const hoverScale = hm
            ? interpolate(frame, [hm.from, hm.from + 8, hm.to, hm.to + 12], [1, 1.55, 1.55, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: POP,
              })
            : 1;
          const scale = popIn * hoverScale;
          const dotColor = RELEASE_COLORS[i % RELEASE_COLORS.length];
          return (
            <div
              key={`marker-${i}`}
              style={{
                position: "absolute",
                left: rm.x - imgR,
                top: markerY - imgR,
                width: imgR * 2,
                height: imgR * 2,
                borderRadius: "50%",
                background: "#27272a",
                boxShadow: "0 0 0 1px rgba(255,255,255,0.18)",
                transform: `scale(${scale})`,
                transformOrigin: "center",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {rm.release.image ? (
                <Img
                  src={rm.release.image}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              ) : (
                <span
                  style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor }}
                />
              )}
            </div>
          );
        })}

        {/* Floating date label while sweeping (app: top-centered body3) */}
        {hover && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: hover.x,
              transform: "translateX(-50%)",
              width: 120,
              display: "flex",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontFamily: fonts.sans,
                fontSize: 12,
                color: colors.fg,
                whiteSpace: "nowrap",
              }}
            >
              {formatChartLabel(hover.timestamp)}
            </span>
          </div>
        )}

        {/* X-axis ticks (hidden while hovering, like the app) */}
        {!hover &&
          xTicks.map((ts, i) => {
            const leftPct = ((ts - startTime) / timeRange) * (CHART_W / W) * 100;
            const transform =
              i === 0 ? "translateX(0)" : i === xTicks.length - 1 ? "translateX(-100%)" : "translateX(-50%)";
            return (
              <div
                key={i}
                style={{ position: "absolute", bottom: 6, left: `${leftPct}%`, transform }}
              >
                <span style={{ fontSize: 10, color: colors.secondary, fontFamily: fonts.sans }}>
                  {formatChartXTick(ts)}
                </span>
              </div>
            );
          })}
      </div>

      {/* Chart controls: period buttons + Sonotrade watermark */}
      <div
        style={{
          display: "flex",
          width: "100%",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: 24,
          paddingBottom: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {periods.map((period) => (
            <span
              key={period}
              style={{
                fontFamily: fonts.sans,
                fontSize: 12,
                color: periodActive === period ? colors.fg : colors.secondary,
              }}
            >
              {period}
            </span>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 0, opacity: 0.3 }}>
          <Img src={staticFile("st-glyph.png")} style={{ height: 32, width: "auto", display: "block" }} />
          <span
            style={{
              fontFamily: fonts.sans,
              fontSize: 24,
              fontWeight: 400,
              letterSpacing: "-0.05em",
              color: colors.fg,
            }}
          >
            Sonotrade
          </span>
        </div>
      </div>
    </div>
  );
};
