import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { colors, fonts } from "../brand";

// iOS-style snap: fast in, tight settle.
export const SNAP = Easing.bezier(0.2, 0.9, 0.1, 1);
export const SNAP_OUT = Easing.bezier(0.7, 0, 0.84, 0);
// Overshoot pop for CTAs / pills.
export const POP = Easing.bezier(0.34, 1.56, 0.64, 1);

// One word of a headline: slides up with blur, snappily.
export const Word: React.FC<{
  children: string;
  at: number;
  out?: number;
}> = ({ children, at, out }) => {
  const frame = useCurrentFrame();
  const inOpacity = interpolate(frame, [at, at + 9], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: SNAP,
  });
  const outOpacity =
    out === undefined
      ? 1
      : interpolate(frame, [out, out + 8], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: SNAP_OUT,
        });
  return (
    <span
      style={{
        display: "inline-block",
        whiteSpace: "pre",
        opacity: inOpacity * outOpacity,
        translate: `0px ${interpolate(frame, [at, at + 11], [44, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: SNAP,
        })}px`,
        filter: `blur(${interpolate(frame, [at, at + 10], [10, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: SNAP,
        })}px)`,
        scale: `${
          out === undefined
            ? 1
            : interpolate(frame, [out, out + 8], [1, 0.96], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: SNAP_OUT,
              })
        }`,
      }}
    >
      {children}
    </span>
  );
};

// Headline whose words snap in with a stagger. `from` = first word's frame,
// `stagger` = frames between words, `out` = frame the whole line starts leaving.
export const SnappyLine: React.FC<{
  text: string;
  from?: number;
  stagger?: number;
  out?: number;
  size?: number;
  weight?: number;
  color?: string;
  letterSpacing?: string;
}> = ({
  text,
  from = 0,
  stagger = 3,
  out,
  size = 100,
  weight = 600,
  color = colors.fg,
  letterSpacing = "-0.03em",
}) => {
  const words = text.split(" ");
  return (
    <div
      style={{
        fontFamily: fonts.sans,
        fontSize: size,
        fontWeight: weight,
        letterSpacing,
        lineHeight: 1.08,
        color,
        textAlign: "center",
      }}
    >
      {words.map((w, i) => (
        <Word key={`${w}-${i}`} at={from + i * stagger} out={out}>
          {i < words.length - 1 ? `${w} ` : w}
        </Word>
      ))}
    </div>
  );
};

// Typewriter: returns the visible slice of `text` between two frames.
export const useTyped = (text: string, from: number, to: number) => {
  const frame = useCurrentFrame();
  const n = Math.round(
    interpolate(frame, [from, to], [0, text.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  return text.slice(0, n);
};

// Count-up number with SNAP easing, for KPI tiles.
export const useCountUp = (target: number, from: number, duration = 42) => {
  const frame = useCurrentFrame();
  return interpolate(frame, [from, from + duration], [0, target], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: SNAP,
  });
};
