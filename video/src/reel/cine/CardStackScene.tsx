import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { colors, fonts } from "../../brand";
import { ArtistLite, filterAdArtists } from "../data";
import { SNAP } from "../text";
import { Vo, voFrames } from "../vo";

// Teaser: the sign-up page's 3D artist card stack (perspective 1200, cards
// scaleX(6) rotateY(-100deg) skewY(-10deg), deep drop shadows), slowly
// scrolling through the deck while the narrator introduces Sonotrade.
export const CARDSTACK_DURATION = voFrames("vo-meet") + 40;

// Geometry constants lifted from frontend/app/sign-up ArtistCardStack.
const STEP = 55;
const VISIBLE = 8;
const SCROLL_PER_FRAME = 1.6; // slow, steady scroll through the deck

export const CardStackScene: React.FC<{ artists: ArtistLite[] }> = ({
  artists,
}) => {
  const frame = useCurrentFrame();
  const deck = filterAdArtists(artists).slice(0, 20);
  const n = Math.max(1, deck.length);

  const offset = 1200 + frame * SCROLL_PER_FRAME;
  const centerSlot = offset / STEP;

  const fadeIn = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Brand lockup rises once the narrator says the name.
  const brandAt = 26;
  const brandIn = interpolate(frame, [brandAt, brandAt + 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: SNAP,
  });
  const brandY = interpolate(frame, [brandAt, brandAt + 12], [30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: SNAP,
  });

  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg, fontFamily: fonts.sans }}>
      <Vo id="vo-meet" at={6} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          perspective: 1200,
          perspectiveOrigin: "0% 20%",
          paddingBottom: "55%",
          overflow: "hidden",
          opacity: fadeIn,
        }}
      >
        <div style={{ transform: "scale(1.05)", transformOrigin: "center center" }}>
          <div style={{ position: "relative", width: 280, height: 380 }}>
            {deck.map((artist, i) => {
              const repeat = Math.round((centerSlot - i) / n);
              const slot = i + repeat * n - centerSlot;
              if (slot < -10 || slot >= 25 || !artist.image) return null;
              const exitScale = Math.min(1.6, Math.max(0.5, 1 - slot * 0.02));
              const tx = (VISIBLE - 1 - slot) * 32;
              const ty = (VISIBLE - 1 - slot) * 95;
              const tz = -slot * 28;
              const shadowStrength = Math.max(0, 1 - slot * 0.1);
              return (
                <div
                  key={artist.id}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: 280,
                    height: 380,
                    borderRadius: 12,
                    transformOrigin: "center center",
                    zIndex: 200 - Math.round(slot * 10),
                    boxShadow: `10px 16px ${Math.round(
                      35 + shadowStrength * 30,
                    )}px 8px rgba(0,0,0,${(0.4 + shadowStrength * 0.45).toFixed(
                      2,
                    )}), inset 0 2px 0 rgba(240,235,215,0.5), inset 2px 0 0 rgba(240,235,215,0.45)`,
                    transform: `scaleX(6) rotateX(8deg) rotateY(-100deg) translate3d(${tx.toFixed(
                      1,
                    )}px, ${ty.toFixed(1)}px, ${tz.toFixed(
                      1,
                    )}px) scale(${exitScale.toFixed(3)}) skewY(-10deg)`,
                  }}
                >
                  <Img
                    src={artist.image}
                    alt={artist.name}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "fill",
                      display: "block",
                      borderRadius: 12,
                      overflow: "hidden",
                      transform: "scaleX(-1)",
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Brand lockup */}
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "flex-end",
          paddingBottom: 260,
          pointerEvents: "none",
        }}
      >
        {/* Brand lockup — header proportions (glyph h:wordmark = 32:24) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            opacity: brandIn,
            translate: `0px ${brandY}px`,
            filter: "drop-shadow(0 12px 40px rgba(0,0,0,0.8))",
          }}
        >
          <Img src={staticFile("st-glyph.png")} style={{ height: 68, width: "auto" }} />
          <span
            style={{
              fontSize: 51,
              fontWeight: 350,
              letterSpacing: "-0.05em",
              color: colors.fg,
            }}
          >
            Sonotrade
          </span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
