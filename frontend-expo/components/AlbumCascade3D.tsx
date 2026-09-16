import React, { useEffect, useState } from 'react';
import { Dimensions, Platform, StyleSheet, Text, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import Reanimated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';

import { API_URL } from '@/constants/API';
import { POSITIVE, NEGATIVE } from '@/constants/colors';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ─── the web transform, decomposed into RN standard ops ───────────────────────
// The desktop cascade (frontend/app/sign-up/page.tsx) renders every card with
//   T(o)·P(1200)·T(−o) · S(0.8) · scaleX(6)·rotateX(8°)·rotateY(−100°)·translate3d(tx,ty,tz)·scale(exit)·skewY(−10°)
// RN standard transforms have no translateZ and no perspective-origin, and the raw
// `{matrix}` prop is fragile, so the chain is decomposed EXACTLY (verified to 3e-12 px
// against a CSS-spec simulator — scratchpad/cascade_decompose.mjs):
//   1. move translate3d out through the rotations/scales:  u = Rx·Ry·(tx,ty,tz), scaled
//   2. eliminate its z under the perspective with the projective identity
//        P(d)·T(0,0,z) ≡ S(1/w0)·P(d·w0),  w0 = 1 − z/d
// leaving only translateX/Y, scaleX/Y, perspective, rotateX/Y, skewY — all first-class ops.
const DEG = Math.PI / 180;
const CARD_W = 280;
const CARD_H = 380; // web-native card size; WRAP fits the composition to the phone
const STEP = 55; // offset units per slot (web)
const VISIBLE = 8;
const TZ = 28; // web depth recession per slot
const PERSP = 1200; // web perspective
const RX_DEG = 8;
const RY_DEG = -100;
const SKY_DEG = -10;
const SX6 = 6;
const WRAP = 0.8 * 0.36; // web wrapper scale(0.8) × phone fit
const ANCHOR_X = SCREEN_W * 0.44; // where the shared card anchor sits on screen
const ANCHOR_Y = SCREEN_H * 0.5;
const PO_X = 0 - ANCHOR_X; // perspective-origin (0%, 20% of screen) relative to the anchor
const PO_Y = SCREEN_H * 0.2 - ANCHOR_Y;
const CULL_BELOW = -10; // web hides slots below −10 (flown off past the bottom-left)
const ENTRANCE = 1500; // web initial offset → fly-in on mount
const ENTRANCE_MS = 3200;
const DRIFT_CYCLE_S = 90; // one full loop of the deck once settled
const DIM = 0.42; // dark wash so the brand/buttons stay readable

// trig constants for rotating the translate3d vector out of the chain
const CY = Math.cos(RY_DEG * DEG);
const SY = Math.sin(RY_DEG * DEG);
const CX = Math.cos(RX_DEG * DEG);
const SX = Math.sin(RX_DEG * DEG);
const ROT_X = `${RX_DEG}deg`;
const ROT_Y = `${RY_DEG}deg`;
const SKEW_Y = `${SKY_DEG}deg`;

// ─── data: preloaded at APP LAUNCH so the deck shows instantly on the welcome screen ──
type CascadeArtist = { id: string; image_url: string; change_1m: number | null };

let artistsCache: CascadeArtist[] | null = null;
let artistsPromise: Promise<CascadeArtist[]> | null = null;

function loadCascadeArtists(): Promise<CascadeArtist[]> {
  if (!artistsPromise) {
    artistsPromise = (async () => {
      try {
        const res = await fetch(`${API_URL}/api/artists-with-history?limit=20&sort_by=volume&sort_dir=desc`);
        if (!res.ok) return [];
        const data = await res.json();
        const list: CascadeArtist[] = (data.artists ?? [])
          .filter((a: any) => a.image_url)
          .slice(0, 20)
          .map((a: any) => ({ id: String(a.id ?? a.spotify_id ?? a.name), image_url: a.image_url, change_1m: a.change_1m ?? null }));
        if (list.length < 8) return []; // too sparse for the deck — keep the PNG
        artistsCache = list;
        // warm the image cache in the background (no await — cards stream in regardless)
        list.forEach((a) => { ExpoImage.prefetch(a.image_url).catch(() => false); });
        return list;
      } catch {
        return [];
      }
    })();
  }
  return artistsPromise;
}
loadCascadeArtists(); // kick off at module import ≈ app launch

// ─── per-card view ────────────────────────────────────────────────────────────
function CascadeCard({ artist, index, count, offset }: {
  artist: CascadeArtist;
  index: number;
  count: number;
  offset: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    // wrap-around slot along the strip (identical to the web rAF loop)
    const centerSlot = offset.value / STEP;
    const repeat = Math.round((centerSlot - index) / count);
    const slot = index + repeat * count - centerSlot;

    const exit = Math.min(1.6, Math.max(0.5, 1 - slot * 0.02));
    const tx = (VISIBLE - 1 - slot) * 32;
    const ty = (VISIBLE - 1 - slot) * 95;
    const tz = -slot * TZ;

    // u = Rx·Ry·(tx,ty,tz) — the translate3d vector expressed outside the rotations
    const ax = CY * tx + SY * tz;
    const az = -SY * tx + CY * tz;
    const by = CX * ty - SX * az;
    const bz = SX * ty + CX * az;
    const u3x = WRAP * SX6 * ax;
    const u3y = WRAP * by;
    // z under the perspective → scale(1/w0) + perspective(d·w0), exactly
    const w0 = Math.max(0.05, 1 - bz / PERSP);
    const k = 1 / w0;

    return {
      opacity: slot < CULL_BELOW ? 0 : 1,
      zIndex: 200 - Math.round(slot * 10),
      transform: [
        { translateX: PO_X },
        { translateY: PO_Y },
        { scaleX: k },
        { scaleY: k },
        { perspective: PERSP * w0 },
        { translateX: u3x - PO_X },
        { translateY: u3y - PO_Y },
        { scaleX: WRAP * SX6 },
        { scaleY: WRAP },
        { rotateX: ROT_X },
        { rotateY: ROT_Y },
        { scaleX: exit },
        { scaleY: exit },
        { skewY: SKEW_Y },
      ],
    };
  });

  const positive = (artist.change_1m ?? 0) >= 0;
  return (
    <Reanimated.View style={[styles.card, style]}>
      {/* rotateY(−100°) shows the card's BACK face — mirror the content to compensate */}
      <ExpoImage source={{ uri: artist.image_url }} style={styles.cardImage} contentFit="fill" cachePolicy="memory-disk" />
      {artist.change_1m !== null && (
        <View style={styles.badge}>
          <Svg viewBox="0 0 10 8" width={8} height={7} style={positive ? undefined : { transform: [{ rotate: '180deg' }] }}>
            <Path fill={positive ? POSITIVE : NEGATIVE} d="M5 0 L10 8 L0 8 Z" />
          </Svg>
          <Text style={[styles.badgeText, { color: positive ? POSITIVE : NEGATIVE }]}>
            {Math.abs(artist.change_1m).toFixed(1)}%
          </Text>
        </View>
      )}
    </Reanimated.View>
  );
}

// ─── the cascade ──────────────────────────────────────────────────────────────
// Purely decorative background — never intercepts touches. Shows instantly when the
// preloaded data is ready (normal case); falls back to the static PNG otherwise and
// crossfades the moment the live deck arrives.
export function AlbumCascade3D() {
  const [artists, setArtists] = useState<CascadeArtist[]>(artistsCache ?? []);
  const offset = useSharedValue(ENTRANCE);
  const live = useSharedValue(artistsCache ? 1 : 0);

  useEffect(() => {
    if (artists.length > 0) return;
    let cancelled = false;
    loadCascadeArtists().then((list) => {
      if (cancelled) return;
      if (list.length > 0) setArtists(list);
      else artistsPromise = null; // failed fetch → allow a retry on the next mount
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (artists.length === 0) return;
    const total = artists.length * STEP;
    live.value = withTiming(1, { duration: 220 });
    // entrance fly-in (web: offset 1500 → 0 on a slow lerp), then an endless slow drift;
    // the slot math is periodic in `total`, so the repeat wrap is seamless
    offset.value = ENTRANCE;
    offset.value = withTiming(0, { duration: ENTRANCE_MS, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished) {
        offset.value = withRepeat(withTiming(-total, { duration: DRIFT_CYCLE_S * 1000, easing: Easing.linear }), -1, false);
      }
    });
  }, [artists.length]);

  const pngStyle = useAnimatedStyle(() => ({ opacity: 1 - live.value }));
  const dimStyle = useAnimatedStyle(() => ({ opacity: DIM * live.value }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {artists.map((a, i) => (
        <CascadeCard key={a.id} artist={a} index={i} count={artists.length} offset={offset} />
      ))}
      {/* readability wash over the live deck */}
      <Reanimated.View style={[StyleSheet.absoluteFill, styles.dim, dimStyle]} />
      {/* static fallback (the old welcome background) — only visible until the deck is ready */}
      <Reanimated.View style={[StyleSheet.absoluteFill, pngStyle]} pointerEvents="none">
        <ExpoImage
          source={require('../public/images/images3.png')}
          style={[styles.png, { blendMode: 'multiply' } as any]}
          contentFit="contain"
        />
      </Reanimated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: ANCHOR_X - CARD_W / 2,
    top: ANCHOR_Y - CARD_H / 2,
    width: CARD_W,
    height: CARD_H,
    borderRadius: 12,
    backfaceVisibility: 'visible',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    transform: [{ scaleX: -1 }],
  },
  badge: {
    position: 'absolute',
    top: -30,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    transform: [{ scaleX: -1 }], // un-mirror (the badge rides the back face too)
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
  },
  dim: {
    backgroundColor: '#000',
  },
  png: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_W,
    height: SCREEN_H,
    transform: [{ scale: 1.8 }],
  },
});
