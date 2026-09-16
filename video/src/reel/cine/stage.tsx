import React from "react";
import { AbsoluteFill } from "remotion";
import { Camera, CameraKeyframe } from "../camera";
import { colors } from "../../brand";

// Black stage + software camera over world-space content. Every UI scene
// wraps its page mockup in this.
export const Stage: React.FC<{
  keyframes: CameraKeyframe[];
  children: React.ReactNode;
}> = ({ keyframes, children }) => (
  <AbsoluteFill style={{ backgroundColor: colors.bg }}>
    <Camera keyframes={keyframes}>{children}</Camera>
  </AbsoluteFill>
);
