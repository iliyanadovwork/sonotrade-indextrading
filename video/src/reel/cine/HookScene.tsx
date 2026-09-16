import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { colors, fonts } from "../../brand";
import { SNAP, SnappyLine } from "../text";

// Opening hook: glyph pops in, then the pitch lands line by line, camera-free
// on pure black. ~150 frames.
export const HOOK_DURATION = 150;

export const HookScene: React.FC = () => {
  const frame = useCurrentFrame();

  const glyphIn = interpolate(frame, [0, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: SNAP,
  });
  const glyphOut = interpolate(frame, [34, 44], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Whole-frame slow push for life.
  const push = interpolate(frame, [0, HOOK_DURATION], [1, 1.05]);

  return (
    <AbsoluteFill
      style={{ backgroundColor: colors.bg, fontFamily: fonts.sans }}
    >
      <AbsoluteFill style={{ scale: `${push}` }}>
        {/* Glyph intro */}
        <AbsoluteFill
          style={{
            alignItems: "center",
            justifyContent: "center",
            opacity: glyphIn * glyphOut,
          }}
        >
          <Img
            src={staticFile("st-glyph.png")}
            style={{
              width: 220,
              height: 220,
              scale: `${interpolate(frame, [0, 16], [0.7, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: SNAP,
              })}`,
              filter: `blur(${interpolate(frame, [0, 12], [12, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              })}px)`,
            }}
          />
        </AbsoluteFill>

        {/* The pitch */}
        <AbsoluteFill
          style={{
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: 28,
            paddingLeft: 60,
            paddingRight: 60,
          }}
        >
          <SnappyLine text="Your favorite artists." from={46} size={104} out={140} />
          <SnappyLine text="Now tradable." from={62} size={104} out={140} />
          <div style={{ height: 10 }} />
          <SnappyLine
            text="Trade real-time artist indexes."
            from={86}
            stagger={2.5}
            size={44}
            weight={400}
            out={140}
          />
        </AbsoluteFill>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
