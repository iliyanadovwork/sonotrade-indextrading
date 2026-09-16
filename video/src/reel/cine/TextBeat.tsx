import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { colors, fonts } from "../../brand";
import { Camera } from "../camera";
import { SNAP } from "../text";
import { Vo, voFrames } from "../vo";

// Apple-style horizontal text beat: one sentence laid out on a single line in
// world space; each word pops in as it's narrated and the camera glides along
// to follow it.

const SIZE = 88;
const GAP = SIZE * 0.28;

// Per-character advance widths for Inter @600 (em fractions) so estimated
// word widths track the real render and inter-word gaps stay even.
const CHAR_EM: Record<string, number> = {
  i: 0.28, j: 0.28, l: 0.26, t: 0.36, f: 0.35, r: 0.4, s: 0.48,
  a: 0.54, c: 0.52, e: 0.54, o: 0.58, u: 0.57, n: 0.57, h: 0.57,
  b: 0.58, d: 0.58, g: 0.58, p: 0.58, q: 0.58, k: 0.54, v: 0.52,
  x: 0.52, y: 0.52, z: 0.5, w: 0.78, m: 0.88,
  I: 0.3, J: 0.42, W: 0.95, M: 0.9, O: 0.78, G: 0.78, Q: 0.78,
  ".": 0.26, ",": 0.26, "?": 0.5, "!": 0.28, "'": 0.2,
};
const charW = (ch: string): number => {
  if (CHAR_EM[ch] != null) return CHAR_EM[ch];
  if (ch >= "A" && ch <= "Z") return 0.68;
  if (ch >= "0" && ch <= "9") return 0.58;
  return 0.55;
};
const wordWidth = (w: string) =>
  w.split("").reduce((s, ch) => s + charW(ch), 0) * SIZE;

const VO_START = 6; // frame the clip starts
const SPEECH_FRACTION = 0.8; // words finish before the clip's tail silence

export const textBeatDuration = (voId: string) => voFrames(voId) + 30;

export const TextBeat: React.FC<{ text: string; voId: string }> = ({
  text,
  voId,
}) => {
  const frame = useCurrentFrame();
  const words = text.split(" ");
  const n = words.length;

  // Word layout: cumulative x positions on one line, y centered.
  const layouts: Array<{ x: number; w: number }> = [];
  let cursor = 200;
  for (const w of words) {
    const ww = wordWidth(w);
    layouts.push({ x: cursor, w: ww });
    cursor += ww + GAP;
  }

  // Word i pops at t_i, spread across the spoken part of the clip.
  const span = voFrames(voId) * SPEECH_FRACTION;
  const tAt = (i: number) => VO_START + 2 + (n <= 1 ? 0 : (i * span) / (n - 1));

  // Camera follows the active word's center.
  const camKfs = words.map((_, i) => ({
    frame: tAt(i),
    x: layouts[i].x + layouts[i].w / 2,
    y: 960,
    scale: 1,
  }));
  camKfs.push({
    frame: tAt(n - 1) + 18,
    x: layouts[n - 1].x + layouts[n - 1].w / 2,
    y: 960,
    scale: 1.05,
  });

  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg }}>
      <Vo id={voId} at={VO_START} />
      <Camera keyframes={camKfs}>
        <div
          style={{
            position: "absolute",
            top: 960 - SIZE * 0.7,
            left: 0,
            whiteSpace: "nowrap",
            fontFamily: fonts.sans,
            fontSize: SIZE,
            fontWeight: 600,
            letterSpacing: "-0.03em",
            color: colors.fg,
            lineHeight: 1.25,
          }}
        >
          {words.map((w, i) => {
            const at = tAt(i);
            const o = interpolate(frame, [at, at + 8], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: SNAP,
            });
            const ty = interpolate(frame, [at, at + 10], [26, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: SNAP,
            });
            const blur = interpolate(frame, [at, at + 9], [8, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: SNAP,
            });
            return (
              <span
                key={i}
                style={{
                  position: "absolute",
                  left: layouts[i].x,
                  opacity: o,
                  translate: `0px ${ty}px`,
                  filter: `blur(${blur}px)`,
                }}
              >
                {w}
              </span>
            );
          })}
        </div>
      </Camera>
    </AbsoluteFill>
  );
};
