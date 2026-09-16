import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { colors, fonts } from "../../brand";
import { POP, SNAP, SnappyLine } from "../text";
import { Sfx } from "../sfx";

// Closing card: headline, glyph + wordmark, CTA pill. ~165 frames.
export const CTA_DURATION = 165;

export const CtaScene: React.FC = () => {
  const frame = useCurrentFrame();

  const push = interpolate(frame, [0, CTA_DURATION], [1, 1.04]);

  const brandIn = interpolate(frame, [46, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: SNAP,
  });
  const brandY = interpolate(frame, [46, 60], [36, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: SNAP,
  });

  const pillScale = interpolate(frame, [76, 92], [0.6, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: POP,
  });
  const pillIn = interpolate(frame, [76, 84], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Tail fade to black.
  const fade = interpolate(frame, [CTA_DURATION - 18, CTA_DURATION - 2], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg, fontFamily: fonts.sans }}>
      <Sfx name="chime" at={78} volume={0.4} />
      <AbsoluteFill
        style={{
          scale: `${push}`,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 34,
          paddingLeft: 60,
          paddingRight: 60,
        }}
      >
        <SnappyLine text="Join the waitlist." from={4} size={92} />

        {/* Brand lockup — same proportions as the app header (glyph h:wordmark
            size = 32:24, tight gap, weight 400, -0.05em tracking) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            marginTop: 46,
            opacity: brandIn,
            translate: `0px ${brandY}px`,
          }}
        >
          <Img
            src={staticFile("st-glyph.png")}
            style={{ height: 88, width: "auto" }}
          />
          <span
            style={{
              fontFamily: fonts.wordmark,
              fontSize: 66,
              fontWeight: 350,
              letterSpacing: "-0.05em",
              color: colors.fg,
            }}
          >
            Sonotrade
          </span>
        </div>

        <div
          style={{
            marginTop: 10,
            opacity: pillIn,
            scale: `${pillScale}`,
            backgroundColor: colors.fg,
            color: "#000",
            borderRadius: 999,
            padding: "22px 54px",
            fontSize: 40,
            fontWeight: 600,
            letterSpacing: "-0.02em",
          }}
        >
          sonotrade.io
        </div>

      </AbsoluteFill>
      <AbsoluteFill style={{ backgroundColor: "#000", opacity: fade }} />
    </AbsoluteFill>
  );
};
