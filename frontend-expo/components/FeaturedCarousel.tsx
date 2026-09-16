import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { TrendArrow, trendColor } from '@/components/TrendArrow';
import {
  Animated,
  Easing,
  View,
  Text,
  ScrollView,
  ImageBackground,
  Pressable,
  StyleSheet,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { GlyphDrawLoader } from '@/components/GlyphDrawLoader';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { API_URL } from '@/constants/API';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Page-indicator geometry. The active indicator rests as a DOT and stretches
// into a pill (spanning two adjacent dots) at the midpoint of each transition.
const DOT_SIZE = 5;
const DOT_GAP = 5;
const DOT_STRIDE = DOT_SIZE + DOT_GAP;   // distance between dot left-edges (10)
const PILL_WIDTH = DOT_STRIDE + DOT_SIZE; // widest, mid-transition (15)

// Last->first "rewind" flourish: how long the blur + dot-crossfade plays
// (roughly the native animated scrollTo back to the start) and the blur strength.
const WRAP_MS = 450;
const BLUR_INTENSITY = 55;

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
  '#04df8b', '#3b82f6', '#FF4B4B', '#14b8a6',
];

function avatarColor(seed: string, offset: number): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h * 31 + seed.charCodeAt(i)) >>> 0);
  return AVATAR_COLORS[(h + offset) % AVATAR_COLORS.length];
}

const CARD_CONFIGS = [
  { badge: 'Top Gainer',  sortBy: 'change_1m',           sortDir: 'desc' },
  { badge: 'Most Traded', sortBy: 'volume',               sortDir: 'desc' },
  { badge: 'Top Ranked',  sortBy: 'current_index_value',  sortDir: 'desc' },
  { badge: 'Dip Alert',   sortBy: 'change_1m',            sortDir: 'asc'  },
  { badge: 'Trending',    sortBy: 'change_1w',            sortDir: 'desc' },
  { badge: 'Top 1Y',      sortBy: 'change_1y',            sortDir: 'desc' },
  { badge: 'Undervalued', sortBy: 'current_index_value',  sortDir: 'asc'  },
  { badge: 'Top 1W',      sortBy: 'change_1w',            sortDir: 'desc' },
];

interface Slide {
  id: string;
  spotify_id: string;
  name: string;
  current_index_value: number;
  change_1m: number;
  image_url: string;
  display_image: string;
  badge: string;
}

function mapArtist(a: any): Omit<Slide, 'badge'> | null {
  if (!a?.image_url) return null;
  return {
    id: a.id ?? a.name,
    spotify_id: a.spotify_id ?? a.id ?? a.name,
    name: a.name,
    current_index_value: a.index_price ?? a.mark_price ?? a.current_index_value ?? 0,
    change_1m: a.change_1m ?? 0,
    image_url: a.image_url,
    display_image: (Array.isArray(a.gallery) && a.gallery.length > 0) ? a.gallery[0] : a.image_url,
  };
}

async function fetchConfig(cfg: typeof CARD_CONFIGS[number]): Promise<Slide | null> {
  try {
    const res = await fetch(
      `${API_URL}/api/artists-with-history?limit=10&sort_by=${cfg.sortBy}&sort_dir=${cfg.sortDir}&gallery=true`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const artist = (data.artists ?? []).find((a: any) => a.image_url);
    const mapped = mapArtist(artist);
    return mapped ? { ...mapped, badge: cfg.badge } : null;
  } catch {
    return null;
  }
}

async function fetchImageSlides(excludeIds: Set<string>): Promise<Slide[]> {
  try {
    const res = await fetch(
      `${API_URL}/api/artists-with-history?limit=20&sort_by=current_index_value&sort_dir=desc&gallery=true`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.artists ?? [])
      .filter((a: any) => a.image_url && !excludeIds.has(a.id ?? a.name))
      .slice(0, 6)
      .map((a: any) => ({ ...mapArtist(a)!, badge: 'Featured' }));
  } catch {
    return [];
  }
}

export function FeaturedCarousel() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  // Only the setter is used now (the worm reads scrollX; the auto-advance reads
  // `prev` via the updater) — the value itself is no longer rendered.
  const [, setActiveIndex] = useState(0);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [loading, setLoading] = useState(true);
  const [isWrapping, setIsWrapping] = useState(false); // true during the last->first rewind
  const wrapProgress = useRef(new Animated.Value(0)).current; // 0->1 across the rewind
  const indexRef = useRef(0); // current page, read synchronously by the auto-advance

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const configSlides = (await Promise.all(CARD_CONFIGS.map(fetchConfig))).filter(
        Boolean
      ) as Slide[];

      // Deduplicate by id
      const seen = new Set<string>();
      const deduped: Slide[] = [];
      for (const s of configSlides) {
        if (!seen.has(s.id)) { seen.add(s.id); deduped.push(s); }
      }

      const imageSlides = await fetchImageSlides(seen);
      if (!cancelled) {
        setSlides([...deduped, ...imageSlides]);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pauseAutoAdvance = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    // If the user grabs the carousel mid-rewind, cancel the flourish and hand
    // the active indicator back to the scroll-driven worm.
    wrapProgress.stopAnimation();
    setIsWrapping(false);
  }, [wrapProgress]);

  // (Re)start the 3.5s auto-advance from now. Calling this on any interaction
  // resets the countdown so it never advances while/just-after you touch it.
  const startAutoAdvance = useCallback(() => {
    pauseAutoAdvance();
    if (slides.length <= 1) return;
    intervalRef.current = setInterval(() => {
      const prev = indexRef.current;
      const next = (prev + 1) % slides.length;
      // Wrapping last -> first is a long backward "rewind" (no infinite loop):
      // play a motion-blur pulse over the images and crossfade the dot instead
      // of letting the worm race all the way back across every dot.
      if (next === 0) {
        setIsWrapping(true);
        wrapProgress.setValue(0);
        Animated.timing(wrapProgress, {
          toValue: 1,
          duration: WRAP_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }).start(({ finished }) => { if (finished) setIsWrapping(false); });
      }
      indexRef.current = next;
      setActiveIndex(next);
      scrollRef.current?.scrollTo({ x: next * SCREEN_WIDTH, animated: true });
    }, 3500);
  }, [slides.length, pauseAutoAdvance, wrapProgress]);

  useEffect(() => {
    startAutoAdvance();
    return pauseAutoAdvance;
  }, [startAutoAdvance, pauseAutoAdvance]);

  // Worm indicator: interpolate the active pill's left edge + width from the
  // scroll position. Sampling at every slide AND every midpoint gives the
  // stretch — DOT_SIZE at each slide (a dot), PILL_WIDTH at each midpoint (a
  // pill spanning the two adjacent dots). The left edge stays anchored on the
  // lower dot through the midpoint, so the leading edge extends first and the
  // trailing edge catches up — a proper elastic worm in both directions.
  const wormAnim = useMemo(() => {
    const n = slides.length;
    if (n < 1) return null;
    const input: number[] = [];
    const leftOut: number[] = [];
    const widthOut: number[] = [];
    for (let k = 0; k <= 2 * (n - 1); k++) {
      input.push((k / 2) * SCREEN_WIDTH);
      leftOut.push(Math.floor(k / 2) * DOT_STRIDE);
      widthOut.push(k % 2 === 0 ? DOT_SIZE : PILL_WIDTH);
    }
    if (input.length < 2) {
      input.push(SCREEN_WIDTH);
      leftOut.push(leftOut[0]);
      widthOut.push(widthOut[0]);
    }
    return {
      left: scrollX.interpolate({ inputRange: input, outputRange: leftOut, extrapolate: 'clamp' }),
      width: scrollX.interpolate({ inputRange: input, outputRange: widthOut, extrapolate: 'clamp' }),
    };
  }, [slides.length, scrollX]);

  // Visuals for the last->first rewind: a blur pulse (0->peak->0) and the active
  // dot crossfading from the last position to the first.
  const wrapVisuals = useMemo(() => ({
    blurOpacity: wrapProgress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 0] }),
    lastDotFade: wrapProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
    firstDotFade: wrapProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
    lastDotLeft: Math.max(0, slides.length - 1) * DOT_STRIDE,
  }), [wrapProgress, slides.length]);

  if (loading) {
    return (
      <View style={[styles.wrapper, styles.loader]}>
        <GlyphDrawLoader width={24} />
      </View>
    );
  }

  if (slides.length === 0) return null;

  // Drives `scrollX` (for the worm) on the JS thread — useNativeDriver must be
  // false because we animate width, which the native driver can't. The listener
  // keeps activeIndex in sync (used by the auto-advance).
  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    {
      useNativeDriver: false,
      listener: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
        indexRef.current = idx;
        setActiveIndex(idx);
      },
    }
  );

  return (
    <View style={styles.wrapper}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        // Reset the auto-advance on ANY interaction: pause the moment you touch
        // or start dragging (even a partial swipe), restart a fresh 3.5s on release.
        onTouchStart={pauseAutoAdvance}
        onScrollBeginDrag={pauseAutoAdvance}
        onScrollEndDrag={startAutoAdvance}
        onTouchEnd={startAutoAdvance}
        onTouchCancel={startAutoAdvance}
      >
        {slides.map((slide, i) => {
          const change = slide.change_1m ?? 0;
          const positive = change >= 0;
          return (
            <Pressable
              key={`${slide.id}-${i}`}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(
                  `/artist/${encodeURIComponent(slide.spotify_id)}?image=${encodeURIComponent(slide.image_url)}&price=${slide.current_index_value}&change=${change}&rank=${i + 1}&name=${encodeURIComponent(slide.name)}` as any
                );
              }}
            >
              <ImageBackground
                source={{ uri: slide.display_image }}
                style={styles.card}
                imageStyle={styles.cardImage}
              >
                <View style={styles.overlay} />
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{slide.badge}</Text>
                </View>
                <View style={styles.holdersRow}>
                  <View style={styles.holdersCircles}>
                    {[0, 1, 2].map((j) => (
                      <View
                        key={j}
                        style={[
                          styles.holderCircle,
                          {
                            marginLeft: j === 0 ? 0 : -10,
                            zIndex: 3 - j,
                            backgroundColor: avatarColor(slide.name, j),
                          },
                        ]}
                      />
                    ))}
                  </View>
                  <Text style={styles.holdersText}>
                    {Math.floor(42 + (slide.current_index_value ?? 0) % 900).toLocaleString()} holders
                  </Text>
                </View>
                <View style={styles.cardContent}>
                  <Text style={styles.artistName}>{slide.name}</Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.price}>
                      ${slide.current_index_value?.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <TrendArrow positive={positive} size={12} />
                      <Text style={[styles.change, { color: trendColor(positive) }]}>
                        {Math.abs(change).toFixed(2)}%
                      </Text>
                    </View>
                  </View>
                </View>
              </ImageBackground>
            </Pressable>
          );
        })}
      </ScrollView>
      {isWrapping && (
        <Animated.View pointerEvents="none" style={[styles.blurOverlay, { opacity: wrapVisuals.blurOpacity }]}>
          <BlurView intensity={BLUR_INTENSITY} tint="dark" style={StyleSheet.absoluteFill} />
        </Animated.View>
      )}
      <View style={styles.dots}>
        <View style={styles.dotsRow}>
          {slides.map((_, i) => (
            <View key={i} style={styles.dot} />
          ))}
          {/* Normal moves: worm follows the scroll. During the last->first
              rewind it's hidden and the two dots below crossfade instead. */}
          {wormAnim && (
            <Animated.View
              style={[styles.worm, { left: wormAnim.left, width: wormAnim.width, opacity: isWrapping ? 0 : 1 }]}
            />
          )}
          {isWrapping && (
            <>
              <Animated.View style={[styles.worm, { left: wrapVisuals.lastDotLeft, width: DOT_SIZE, opacity: wrapVisuals.lastDotFade }]} />
              <Animated.View style={[styles.worm, { left: 0, width: DOT_SIZE, opacity: wrapVisuals.firstDotFade }]} />
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const CARD_HEIGHT = SCREEN_WIDTH;

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 12,
  },
  blurOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: CARD_HEIGHT,
  },
  loader: {
    height: CARD_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: SCREEN_WIDTH,
    height: CARD_HEIGHT,
    justifyContent: 'flex-end',
  },
  cardImage: {
    resizeMode: 'cover',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  badge: {
    position: 'absolute',
    top: 12,
    left: 20,
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  holdersRow: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 4,
  },
  holdersCircles: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  holdersText: {
    color: '#a1a1aa',
    fontSize: 12,
    fontWeight: '400',
  },
  holderCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'transparent',
    borderWidth: 0.5,
    borderColor: '#fff',
  },
  cardContent: {
    padding: 20,
  },
  artistName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  price: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  change: {
    fontSize: 12,
    fontWeight: '500',
  },
  dots: {
    alignItems: 'center', // centers the self-sized row
    paddingTop: 18,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: DOT_GAP,
    position: 'relative', // anchor for the absolutely-positioned worm
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: '#444',
  },
  worm: {
    position: 'absolute',
    top: 0,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: '#fff',
  },
});
