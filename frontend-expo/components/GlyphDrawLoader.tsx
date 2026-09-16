import React, { useEffect, useId, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { ClipPath, Defs, G, Mask, Path, Rect } from 'react-native-svg';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);

/** Outline of the Sonotrade glyph — clips the strokes so the round caps read as the filled mark. */
const GLYPH_PATH =
  'M 606.13,26.50 L 321.39,287.81 A 33.0 33.0 0 0 0 336.00,344.21 L 632.69,415.44 L 655.28,556.21 A 5.61 5.61 0 0 0 666.42,555.40 L 668.36,424.00 L 833.62,463.68 L 158.02,1322.00 A 5.61 5.61 0 0 0 166.61,1329.20 L 934.04,471.18 A 33.7 33.7 0 0 0 916.68,415.92 L 671.29,358.25 L 661.43,49.76 A 33.0 33.0 0 0 0 606.13,26.50 Z M599,113 L626,348 L406,295 Z';

// Spike strokes on first (offset 956 -> 0), then the bar draws across (offset 1725 -> 0);
// the whole group then fades and the dash resets while invisible, so the loop wraps clean.
const SPIKE_DASH = 956;
const BAR_DASH = 1725;

export type GlyphDrawLoaderProps = {
  /** Width in px; height follows the 1045:1572 glyph aspect ratio. Default 48. */
  width?: number;
  /** Full loop duration in ms (draw → hold → fade → reset). Default 800. */
  cycleDurationMs?: number;
  /** Stroke color. Default white. */
  color?: string;
};

/**
 * Self-drawing Sonotrade glyph loader — React Native port of the web `SXGlyphDrawLoader`.
 * Spike draws (0–20.5%), bar draws across with an over/under punch-out (20.5–60%), holds,
 * then the group fades (69.5–95.8%) and the dash resets while hidden before looping.
 */
export function GlyphDrawLoader({ width = 48, cycleDurationMs = 800, color = '#ffffff' }: GlyphDrawLoaderProps) {
  const height = (width * 1572) / 1045;
  const progress = useRef(new Animated.Value(0)).current;

  // Namespace clip/mask ids per instance so multiple loaders don't collide.
  const uid = useId().replace(/:/g, '');
  const clipId = `glyphdraw-clip-${uid}`;
  const maskId = `glyphdraw-mask-${uid}`;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: cycleDurationMs,
        easing: Easing.linear,
        // strokeDashoffset / svg opacity can't run on the native driver.
        useNativeDriver: false,
      })
    );
    anim.start();
    return () => {
      anim.stop();
      progress.setValue(0);
    };
  }, [cycleDurationMs, progress]);

  // Keyframe breakpoints mirror the web CSS (sxGlyphDrawSpike / Bar / Fade).
  const spikeOffset = progress.interpolate({
    inputRange: [0, 0.205, 0.958, 0.959, 1],
    outputRange: [SPIKE_DASH, 0, 0, SPIKE_DASH, SPIKE_DASH],
  });
  const barOffset = progress.interpolate({
    inputRange: [0, 0.205, 0.6, 0.958, 0.959, 1],
    outputRange: [BAR_DASH, BAR_DASH, 0, 0, BAR_DASH, BAR_DASH],
  });
  const groupOpacity = progress.interpolate({
    inputRange: [0, 0.695, 0.958, 1],
    outputRange: [1, 1, 0, 0],
  });

  return (
    <View style={{ width, height }} accessibilityRole="progressbar" accessibilityLabel="Loading">
      <Svg width={width} height={height} viewBox="27 -112 1045 1572">
        <Defs>
          <ClipPath id={clipId}>
            <Path d={GLYPH_PATH} clipRule="evenodd" />
          </ClipPath>
          {/* Punches a gap in the spike where the bar crosses the joint (over/under). */}
          <Mask id={maskId} maskUnits="userSpaceOnUse" x="27" y="-112" width="1045" height="1572">
            <Rect x="27" y="-112" width="1045" height="1572" fill="white" />
            <Path
              d="M 580.0,368.9 L 653,386 L 725.8,404.1"
              fill="none"
              stroke="black"
              strokeWidth={70}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Mask>
        </Defs>
        <AnimatedG clipPath={`url(#${clipId})`} opacity={groupOpacity}>
          {/* Spike behind (gap punched at the joint). */}
          <AnimatedPath
            d="M 661.8,606 L 653,386 L 627,44 L 341,313"
            mask={`url(#${maskId})`}
            fill="none"
            stroke={color}
            strokeWidth={74}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={[SPIKE_DASH, 100000]}
            strokeDashoffset={spikeOffset}
          />
          {/* Bar in front. */}
          <AnimatedPath
            d="M 341,313 L 653,386 L 888,452 L 165,1328"
            fill="none"
            stroke={color}
            strokeWidth={74}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={[BAR_DASH, 100000]}
            strokeDashoffset={barOffset}
          />
        </AnimatedG>
      </Svg>
    </View>
  );
}
