import React, { useRef, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Image, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/theme';
import { TrendArrow, trendColor } from '@/components/TrendArrow';
import { API_URL } from '@/constants/API';
import { LinearGradient } from 'expo-linear-gradient';

interface Artist {
  id: string;
  name: string;
  index_price: number;
  change_1m: number;
  volume: number;
  image_url?: string | null;
}

function mapArtist(a: any): Artist {
  return {
    id: a.id ?? a.name,
    name: a.name,
    index_price: a.index_price ?? a.mark_price ?? a.current_index_value ?? 0,
    change_1m: a.change_1m ?? 0,
    volume: a.volume ?? 0,
    image_url: a.image_url ?? null,
  };
}

const SECTION_WIDTH = 280;
const SECTION_GAP = 32;
const SNAP_INTERVAL = SECTION_WIDTH + SECTION_GAP;

// Single source of truth for the card colour so the bg + both edge fades stay in
// sync. The fade uses the rgba(...,0) form, NOT the `transparent` keyword — that
// keyword is transparent BLACK, so it drags the gradient's midtones toward black
// and makes the fade look darker than the card. Here only the alpha changes.
const CARD_RGB = '17, 17, 17'; // #111111
const CARD_BG = `rgb(${CARD_RGB})`;
const CARD_BG_FADE = `rgba(${CARD_RGB}, 0)`;

export const MarketMovers = () => {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const NUM_SECTIONS = 3;

  const [gainers,  setGainers]  = useState<Artist[]>([]);
  const [volume,   setVolume]   = useState<Artist[]>([]);
  const [volatile, setVolatile] = useState<Artist[]>([]);
  const [loaded,   setLoaded]   = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetch3() {
      try {
        const [gRes, vRes, xRes] = await Promise.all([
          fetch(`${API_URL}/api/artists-with-history?limit=5&sort_by=change_1m&sort_dir=desc&slim=true`),
          fetch(`${API_URL}/api/artists-with-history?limit=5&sort_by=volume&sort_dir=desc&slim=true`),
          // Most volatile: fetch top gainers + top losers, combine, sort by abs change
          Promise.all([
            fetch(`${API_URL}/api/artists-with-history?limit=10&sort_by=change_1m&sort_dir=desc&slim=true`),
            fetch(`${API_URL}/api/artists-with-history?limit=10&sort_by=change_1m&sort_dir=asc&slim=true`),
          ]),
        ]);
        if (cancelled) return;

        const [gData, vData] = await Promise.all([gRes.json(), vRes.json()]);
        const [xDescData, xAscData] = await Promise.all([xRes[0].json(), xRes[1].json()]);

        const seen = new Set<string>();
        const allMovers: Artist[] = [];
        for (const a of [...(xDescData.artists ?? []), ...(xAscData.artists ?? [])]) {
          const id = a.id ?? a.name;
          if (!seen.has(id)) { seen.add(id); allMovers.push(mapArtist(a)); }
        }
        allMovers.sort((a, b) => Math.abs(b.change_1m) - Math.abs(a.change_1m));

        if (!cancelled) {
          setGainers((gData.artists ?? []).slice(0, 5).map(mapArtist));
          setVolume((vData.artists ?? []).slice(0, 5).map(mapArtist));
          setVolatile(allMovers.slice(0, 5));
          setLoaded(true);
        }
      } catch {}
    }
    fetch3();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    scrollRef.current?.scrollTo({ x: NUM_SECTIONS * SNAP_INTERVAL, animated: false });
  }, [loaded]);

  function onMomentumScrollEnd(e: any) {
    const x = e.nativeEvent.contentOffset.x;
    const index = Math.round(x / SNAP_INTERVAL);
    if (index < NUM_SECTIONS) {
      scrollRef.current?.scrollTo({ x: (index + NUM_SECTIONS) * SNAP_INTERVAL, animated: false });
    } else if (index >= NUM_SECTIONS * 2) {
      scrollRef.current?.scrollTo({ x: (index - NUM_SECTIONS) * SNAP_INTERVAL, animated: false });
    }
  }

  if (!loaded) return null;

  function MoverRow({ item, onPress }: { item: Artist; onPress: () => void }) {
    const scale = useRef(new Animated.Value(1)).current;
    const bgOpacity = useRef(new Animated.Value(0)).current;
    const isUp = (item.change_1m ?? 0) >= 0;

    const handlePressIn = () => {
      Animated.parallel([
        Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 60, bounciness: 0 }),
        Animated.timing(bgOpacity, { toValue: 1, duration: 80, useNativeDriver: true }),
      ]).start();
    };

    const handlePressOut = () => {
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 3 }),
        Animated.timing(bgOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    };

    return (
      <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut} style={styles.row}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <Animated.View style={[styles.rowBg, { opacity: bgOpacity }]} />
          <View style={styles.rowInner}>
            <View style={styles.nameCol}>
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} style={styles.avatar} />
              ) : (
                <View style={styles.dot} />
              )}
              <View style={styles.nameInfo}>
                <Text style={styles.nameText} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.indexLabel}>Index</Text>
              </View>
            </View>
            <View style={styles.valueCol}>
              <Text style={styles.priceText}>
                {(item.index_price ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                <Text style={styles.usdLabel}> USD</Text>
              </Text>
              <View style={styles.changeRow}>
                <TrendArrow positive={isUp} size={11} />
                <Text style={[styles.changeText, { color: trendColor(isUp) }]}>
                  {Math.abs(item.change_1m ?? 0).toFixed(2)}%
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>
      </Pressable>
    );
  }

  const Section = ({ title, subtitle, data }: {
    title: string; subtitle: string; data: Artist[];
  }) => (
    <View style={styles.section}>
      <View style={[styles.sectionHeaderRow, { gap: 3 }]}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
      {data.map(item => (
        <MoverRow
          key={item.id}
          item={item}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push(`/artist/${encodeURIComponent(item.id)}?image=${encodeURIComponent(item.image_url ?? '')}&price=${item.index_price ?? 0}&change=${item.change_1m ?? 0}&name=${encodeURIComponent(item.name)}` as any);
          }}
        />
      ))}
    </View>
  );

  const sections = [
    { title: 'Biggest Gainers', subtitle: 'Last 30 days', data: gainers  },
    { title: 'Highest Volume',  subtitle: 'Last 30 days', data: volume   },
    { title: 'Most Volatile',   subtitle: 'Last 30 days', data: volatile },
  ];

  return (
    <View style={styles.cardWrap}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        snapToInterval={SNAP_INTERVAL}
        decelerationRate="fast"
        onMomentumScrollEnd={onMomentumScrollEnd}
      >
        {/* 3 sets for infinite loop */}
        {[0, 1, 2].map(set =>
          sections.map(s => (
            <Section key={`${set}-${s.title}`} title={s.title} subtitle={s.subtitle} data={s.data} />
          ))
        )}
      </ScrollView>
      {/* Soft feather on both edges — content dissolves into the card bg. */}
      <LinearGradient
        colors={[CARD_BG, CARD_BG_FADE]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        pointerEvents="none"
        style={styles.leftFade}
      />
      <LinearGradient
        colors={[CARD_BG_FADE, CARD_BG]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        pointerEvents="none"
        style={styles.rightFade}
      />
    </View>
  );
};

function fmtVolume(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000)     return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000)         return `${(value / 1_000).toFixed(2)}K`;
  return value.toLocaleString();
}

const styles = StyleSheet.create({
  // Card frame moved here so we can clip the right-edge fade to the rounded
  // corners (overflow: hidden) and anchor it (position: relative).
  cardWrap: {
    marginTop: 8,
    marginBottom: 20,
    marginHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#222222',
    backgroundColor: CARD_BG,
    overflow: 'hidden',
    position: 'relative',
  },
  container: {},
  leftFade: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 16,
  },
  rightFade: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: 16,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 32,
  },
  section:          { width: SECTION_WIDTH, backgroundColor: CARD_BG },
  sectionHeaderRow: { marginBottom: 16 },
  sectionTitle:     { color: '#fff', fontSize: 16, fontWeight: '400', letterSpacing: -0.4 },
  sectionSubtitle:  { color: '#a1a1aa', fontSize: 12, letterSpacing: -0.3 },
  row:              { position: 'relative' },
  rowBg:            { ...StyleSheet.absoluteFillObject, backgroundColor: '#27272a', borderRadius: 8, marginHorizontal: -6, marginVertical: 2 },
  rowInner:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  nameCol:          { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  avatar:           { width: 32, height: 32, borderRadius: 16 },
  dot:              { width: 32, height: 32, borderRadius: 16, backgroundColor: '#27272a' },
  nameInfo:         { flex: 1, minWidth: 0, gap: 2 },
  nameText:         { color: '#fff', fontSize: 14, fontWeight: '400', letterSpacing: -0.2 },
  indexLabel:       { color: '#a1a1aa', fontSize: 11 },
  valueCol:         { alignItems: 'flex-end', gap: 4 },
  changeRow:        { flexDirection: 'row', alignItems: 'center', gap: 3 },
  priceText:        { color: '#a1a1aa', fontSize: 11, fontWeight: '400' },
  usdLabel:         { color: '#a1a1aa', fontSize: 9, fontWeight: '400' },
  changeText:       { fontSize: 11 },
});
