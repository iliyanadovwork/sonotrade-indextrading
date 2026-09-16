import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import type { PricePoint } from "../data";

// 1:1 with components/sx/SXSparkline.tsx — stepwise (H then V) path, equal
// x-spacing, #04df9d up / #FF4B4B down, 1.5px square caps. Adds an optional
// frame-driven left-to-right draw-on (strokeDasharray) for the reel.
export const Sparkline: React.FC<{
  data: PricePoint[];
  width?: number;
  height?: number;
  positive?: boolean;
  revealAt?: number;
}> = ({ data, width = 96, height = 32, positive, revealAt }) => {
  const frame = useCurrentFrame();
  const W = 96;
  const H = 32;
  const pad = 2;

  const paddedData = data.length === 1 ? [data[0], { ...data[0] }] : data;
  if (paddedData.length < 2) {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${W} ${H}`} />
    );
  }

  const values = paddedData.map((d) => d.price);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;

  const pts = paddedData.map((d, i) => ({
    x: (i / (paddedData.length - 1)) * W,
    y: range === 0 ? H / 2 : pad + (1 - (d.price - min) / range) * (H - pad * 2),
  }));

  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  // Manhattan length of the stepwise path — deterministic getTotalLength.
  let len = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i];
    const p2 = pts[i + 1];
    d += ` H${p2.x.toFixed(1)} V${p2.y.toFixed(1)}`;
    len += Math.abs(p2.x - p1.x) + Math.abs(p2.y - p1.y);
  }

  const isPositive =
    positive !== undefined ? positive : values[values.length - 1] >= values[0];
  const color = isPositive ? "#04df9d" : "#FF4B4B";

  const progress =
    revealAt === undefined
      ? 1
      : interpolate(frame, [revealAt, revealAt + 20], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        });

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      width={width}
      height={height}
      style={{ display: "block", overflow: "visible" }}
    >
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="square"
        strokeLinejoin="miter"
        vectorEffect="non-scaling-stroke"
        strokeDasharray={revealAt === undefined ? undefined : len}
        strokeDashoffset={
          revealAt === undefined ? undefined : len * (1 - progress)
        }
      />
    </svg>
  );
};
