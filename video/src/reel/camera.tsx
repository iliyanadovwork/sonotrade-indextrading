import React from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

// Snappy camera easing — fast attack, soft settle (Apple-style).
export const CAM_EASE = Easing.bezier(0.7, 0, 0.15, 1);

export type CameraKeyframe = {
  frame: number;
  // World-space point the camera looks at.
  x: number;
  y: number;
  scale: number;
};

const track = (
  frame: number,
  kfs: CameraKeyframe[],
  pick: (k: CameraKeyframe) => number,
) => {
  if (kfs.length === 1) {
    return pick(kfs[0]);
  }
  return interpolate(
    frame,
    kfs.map((k) => k.frame),
    kfs.map(pick),
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: CAM_EASE,
    },
  );
};

// Wraps world-space content and drives it with camera keyframes. The camera
// "looks at" (x, y) at the given zoom; the world moves, the viewport doesn't.
export const Camera: React.FC<{
  keyframes: CameraKeyframe[];
  children: React.ReactNode;
}> = ({ keyframes, children }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const x = track(frame, keyframes, (k) => k.x);
  const y = track(frame, keyframes, (k) => k.y);
  const scale = track(frame, keyframes, (k) => k.scale);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          transformOrigin: "0 0",
          translate: `${width / 2 - x * scale}px ${height / 2 - y * scale}px`,
          scale: `${scale}`,
        }}
      >
        {children}
      </div>
    </div>
  );
};
