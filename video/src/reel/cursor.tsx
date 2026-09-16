import React from "react";
import {
  Audio,
  Easing,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";

// Cursor easing: quick glide with a soft landing. Exported so scenes that drag
// something under the cursor can move it with the exact same curve.
export const CURSOR_EASE = Easing.bezier(0.3, 0.1, 0.15, 1);

export type CursorWaypoint = {
  frame: number;
  x: number;
  y: number;
  click?: boolean;
};

// macOS-style pointer, drawn at native ~20px and scalable.
export const Pointer: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    style={{ display: "block", filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))" }}
  >
    <path
      d="M4 1 L4 15.5 L7.6 12.4 L9.9 17.6 L12.4 16.5 L10.1 11.4 L15 11 Z"
      fill="#ffffff"
      stroke="#000000"
      strokeWidth={1.1}
      strokeLinejoin="round"
    />
  </svg>
);

// Moves the pointer along waypoints in the parent's coordinate space and fires
// click ripples + click SFX at waypoints marked click.
export const Cursor: React.FC<{
  waypoints: CursorWaypoint[];
  size?: number;
  visibleFrom?: number;
  visibleUntil?: number;
}> = ({ waypoints, size = 20, visibleFrom = 0, visibleUntil = Infinity }) => {
  const frame = useCurrentFrame();

  const x = interpolate(
    frame,
    waypoints.map((w) => w.frame),
    waypoints.map((w) => w.x),
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: CURSOR_EASE },
  );
  const y = interpolate(
    frame,
    waypoints.map((w) => w.frame),
    waypoints.map((w) => w.y),
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: CURSOR_EASE },
  );

  const clicks = waypoints.filter((w) => w.click);
  const visible = frame >= visibleFrom && frame <= visibleUntil;

  if (!visible) {
    return null;
  }

  return (
    <>
      {clicks.map((c) => (
        <Sequence key={`sfx-${c.frame}`} from={c.frame}>
          <Audio src={staticFile("sfx/click.mp3")} volume={0.5} />
        </Sequence>
      ))}
      {clicks.map((c) => {
        const r = interpolate(frame, [c.frame, c.frame + 14], [6, 26], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        });
        const o = interpolate(frame, [c.frame, c.frame + 14], [0.5, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        if (frame < c.frame || frame > c.frame + 14) {
          return null;
        }
        return (
          <span
            key={c.frame}
            style={{
              position: "absolute",
              left: c.x - r,
              top: c.y - r,
              width: r * 2,
              height: r * 2,
              borderRadius: 999,
              border: "1.5px solid rgba(255,255,255,0.9)",
              opacity: o,
              pointerEvents: "none",
            }}
          />
        );
      })}
      <span
        style={{
          position: "absolute",
          left: x - 4,
          top: y - 1,
          zIndex: 50,
          pointerEvents: "none",
          scale: `${
            clicks.some((c) => frame >= c.frame && frame <= c.frame + 5)
              ? 0.86
              : 1
          }`,
        }}
      >
        <Pointer size={size} />
      </span>
    </>
  );
};
