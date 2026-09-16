import { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, Image, Pressable, StyleSheet,
  Animated, useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { API_URL } from '@/constants/API';
import { TrendArrow, trendColor } from '@/components/TrendArrow';

const GAP = 14;
const PADDING = 16;

const CARD_CONFIGS = [
  { category: 'Biggest Gainer', badge: 'Top Gainer',  sortBy: 'change_1m',          sortDir: 'desc', bullets: ['Highest 1M return',       'Strong momentum signal']   },
  { category: 'Highest Volume', badge: 'Most Traded', sortBy: 'volume',              sortDir: 'desc', bullets: ['Highest trading activity', 'Deep liquidity pool']      },
  { category: 'Highest Index',  badge: 'Top Ranked',  sortBy: 'current_index_value', sortDir: 'desc', bullets: ['Highest index value',      'Blue-chip artist index']   },
  { category: 'Buy the Dip',    badge: 'Dip Alert',   sortBy: 'change_1m',           sortDir: 'asc',  bullets: ['Largest 1M pullback',      'Potential mean reversion'] },
  { category: 'Rising Star',    badge: 'Trending',    sortBy: 'change_1w',           sortDir: 'desc', bullets: ['Top 1W performance',       'Short-term breakout']      },
  { category: 'Long Term Pick', badge: 'Top 1Y',      sortBy: 'change_1y',           sortDir: 'desc', bullets: ['Highest 1Y return',        'Sustained growth trend']   },
  { category: 'Hidden Gem',     badge: 'Undervalued', sortBy: 'current_index_value', sortDir: 'asc',  bullets: ['Low index, high upside',   'Under-the-radar artist']   },
  { category: 'Weekly Winner',  badge: 'Top 1W',      sortBy: 'change_1w',           sortDir: 'desc', bullets: ['Best 7-day performer',     'Breakout momentum']        },
];

const AVATAR_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#04df9d', '#3b82f6', '#FF4B4B', '#14b8a6'];
function avatarColor(seed: string, offset: number) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h * 31 + seed.charCodeAt(i)) >>> 0);
  return AVATAR_COLORS[(h + offset) % AVATAR_COLORS.length];
}

interface FeaturedArtist {
  id: string;
  spotify_id: string;
  name: string;
  current_index_value: number;
  change_1m: number;
  image_url: string | null;
  badge: string;
  category: string;
  bullets: string[];
}

function CardItem({ item, cardWidth }: { item: FeaturedArtist; cardWidth: number }) {
  const router = useRouter();
  const scale = useRef(new Animated.Value(1)).current;
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUp = (item.change_1m ?? 0) >= 0;
  const holderCount = Math.floor(42 + (item.current_index_value ?? 0) % 900);
  const bannerHeight = Math.round(cardWidth * 0.72);

  const onPressIn = () => {
    pressTimer.current = setTimeout(() => {
      Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, speed: 50 }).start();
    }, 80);
  };
  const onPressOut = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50 }).start();
  };

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push(`/artist/${encodeURIComponent(item.spotify_id)}?image=${encodeURIComponent(item.image_url ?? '')}&price=${item.current_index_value}&change=${item.change_1m}&name=${encodeURIComponent(item.name)}` as any);
      }}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    >
      <Animated.View style={[styles.card, { width: cardWidth, transform: [{ scale }] }]}>
        {/* Banner */}
        <View style={[styles.banner, { height: bannerHeight }]}>
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          ) : (
            <View style={[StyleSheet.absoluteFillObject, styles.bannerPlaceholder]} />
          )}
          <View style={styles.bannerGradient} />
          <View style={styles.badgePill}>
            <Text style={styles.badgeText}>{item.badge}</Text>
          </View>
        </View>

        {/* Body */}
        <View style={styles.body}>
          <View style={styles.bodyContent}>
            <Text style={styles.category}>{item.category.toUpperCase()}</Text>
            <Text style={styles.name} numberOfLines={1}>{item.name}</Text>

            <View style={styles.priceRow}>
              <Text style={styles.price}>
                ${item.current_index_value?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
              <View style={styles.changeRow}>
                <TrendArrow positive={isUp} size={11} />
                <Text style={[styles.change, { color: trendColor(isUp) }]}>
                  {Math.abs(item.change_1m ?? 0).toFixed(2)}%
                </Text>
              </View>
            </View>

            <View style={styles.holdersRow}>
              <View style={styles.avatarsRow}>
                {[0, 1, 2].map(j => (
                  <View key={j} style={[styles.avatar, { backgroundColor: avatarColor(item.name, j), marginLeft: j === 0 ? 0 : -7, zIndex: 3 - j }]} />
                ))}
              </View>
              <Text style={styles.holdersText}>{holderCount.toLocaleString()} holders</Text>
            </View>

            <View style={styles.divider} />

            {item.bullets.map((b, i) => (
              <View key={i} style={styles.bulletRow}>
                <View style={styles.bulletDot} />
                <Text style={styles.bulletText} numberOfLines={1}>{b}</Text>
              </View>
            ))}
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

export function FeaturedCards() {
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = (screenWidth - PADDING * 2 - GAP) / 2;

  const [cards, setCards] = useState<FeaturedArtist[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [timerKey, setTimerKey] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const pages: FeaturedArtist[][] = [];
  for (let i = 0; i < cards.length; i += 2) pages.push(cards.slice(i, i + 2));
  const totalPages = pages.length;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      function mapArtist(a: any) {
        return {
          id: a.id ?? a.name,
          spotify_id: a.id ?? a.name,
          name: a.name,
          current_index_value: a.index_price ?? a.mark_price ?? a.current_index_value ?? 0,
          change_1m: a.change_1m ?? 0,
          image_url: a.image_url ?? null,
        };
      }

      const configResults = await Promise.all(
        CARD_CONFIGS.map(async cfg => {
          try {
            const res = await fetch(`${API_URL}/api/artists-with-history?limit=10&sort_by=${cfg.sortBy}&sort_dir=${cfg.sortDir}&slim=true`);
            if (!res.ok) return null;
            const data = await res.json();
            const artist = (data.artists ?? []).find((a: any) => a.image_url);
            if (!artist) return null;
            return { ...mapArtist(artist), badge: cfg.badge, category: cfg.category, bullets: cfg.bullets } as FeaturedArtist;
          } catch { return null; }
        })
      );

      let extraCards: FeaturedArtist[] = [];
      try {
        const res = await fetch(`${API_URL}/api/artists-with-history?limit=20&sort_by=current_index_value&sort_dir=desc&slim=true`);
        if (res.ok) {
          const data = await res.json();
          const configIds = new Set(configResults.filter(Boolean).map(r => r!.id));
          extraCards = (data.artists ?? [])
            .filter((a: any) => a.image_url && !configIds.has(a.id ?? a.name))
            .slice(0, 8)
            .map((a: any, i: number) => ({
              ...mapArtist(a),
              badge: `#${i + 1} Featured`,
              category: 'Top Artist',
              bullets: ['High index value', 'Established market presence'],
            } as FeaturedArtist));
        }
      } catch {}

      if (!cancelled) {
        const seen = new Set<string>();
        const all = [...configResults, ...extraCards].filter((r): r is FeaturedArtist => {
          if (!r || seen.has(r.id)) return false;
          seen.add(r.id);
          return true;
        });
        setCards(all);
        setLoaded(true);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Auto-advance every 10 seconds; resets when user manually navigates
  useEffect(() => {
    if (!loaded || totalPages < 2) return;
    const id = setInterval(() => {
      setActiveIndex(prev => {
        const next = (prev + 1) % totalPages;
        scrollRef.current?.scrollTo({ x: next * screenWidth, animated: true });
        return next;
      });
    }, 10000);
    return () => clearInterval(id);
  }, [loaded, totalPages, timerKey, screenWidth]);

  function goTo(idx: number) {
    const clamped = Math.max(0, Math.min(totalPages - 1, idx));
    scrollRef.current?.scrollTo({ x: clamped * screenWidth, animated: true });
    setActiveIndex(clamped);
    setTimerKey(k => k + 1);
  }

  if (!loaded || pages.length === 0) return null;

  const canPrev = activeIndex > 0;
  const canNext = activeIndex < totalPages - 1;

  return (
    <View style={styles.wrapper}>
      {/* Header with arrows */}
      <View style={styles.headerRow}>
        <View style={{ gap: 3 }}>
          <Text style={styles.headerTitle}>Featured</Text>
          <Text style={styles.headerSubtitle}>Curated picks across the market</Text>
        </View>
        <View style={styles.navControls}>
          <Pressable
            onPress={() => canPrev && goTo(activeIndex - 1)}
            style={[styles.navBtn, !canPrev && styles.navBtnDisabled]}
            hitSlop={8}
          >
            <Svg width={18} height={18} viewBox="0 0 24 24">
              <Path d="M15 18l-6-6 6-6" fill="none" stroke={canPrev ? '#a1a1aa' : '#3f3f46'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
          <Text style={styles.pageCounter}>{activeIndex + 1} of {totalPages}</Text>
          <Pressable
            onPress={() => canNext && goTo(activeIndex + 1)}
            style={[styles.navBtn, !canNext && styles.navBtnDisabled]}
            hitSlop={8}
          >
            <Svg width={18} height={18} viewBox="0 0 24 24">
              <Path d="M9 18l6-6-6-6" fill="none" stroke={canNext ? '#a1a1aa' : '#3f3f46'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onMomentumScrollEnd={e => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
          setActiveIndex(Math.max(0, Math.min(totalPages - 1, idx)));
          setTimerKey(k => k + 1);
        }}
      >
        {pages.map((page, pi) => (
          <View key={pi} style={[styles.page, { width: screenWidth }]}>
            {page.map(item => (
              <CardItem key={item.id} item={item} cardWidth={cardWidth} />
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper:         { marginTop: 8, marginBottom: 8 },
  headerRow:       { paddingHorizontal: PADDING, marginBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  headerTitle:     { color: '#fff', fontSize: 16, fontWeight: '400', letterSpacing: -0.4 },
  headerSubtitle:  { color: '#a1a1aa', fontSize: 12, letterSpacing: -0.3 },
  navControls:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  navBtn:          { borderWidth: 1, borderColor: '#3f3f46', borderRadius: 99, padding: 4, alignItems: 'center', justifyContent: 'center' },
  navBtnDisabled:  { opacity: 0.4 },
  pageCounter:     { color: '#a1a1aa', fontSize: 12, minWidth: 32, textAlign: 'center' },

  page:            { flexDirection: 'row', paddingHorizontal: PADDING, gap: GAP },

  card: {
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#222222',
  },

  banner:          { backgroundColor: '#1a1a1a' },
  bannerPlaceholder: { backgroundColor: '#1a1a1a' },
  bannerGradient:  { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)' },
  badgePill: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#fff',
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText:       { color: '#000', fontSize: 10, fontWeight: '500' },

  body:            { padding: 12 },
  bodyContent:     { gap: 7 },

  category:        { color: '#a1a1aa', fontSize: 9, fontWeight: '600', letterSpacing: 0.8 },
  name:            { color: '#fff', fontSize: 13, fontWeight: '500' },
  priceRow:        { flexDirection: 'row', alignItems: 'center', gap: 6 },
  price:           { color: '#fff', fontSize: 15, fontWeight: '500' },
  changeRow:       { flexDirection: 'row', alignItems: 'center', gap: 3 },
  change:          { fontSize: 11, fontWeight: '500' },

  holdersRow:      { flexDirection: 'row', alignItems: 'center', gap: 5 },
  avatarsRow:      { flexDirection: 'row', alignItems: 'center' },
  avatar:          { width: 15, height: 15, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  holdersText:     { color: '#a1a1aa', fontSize: 10 },

  divider:         { height: 1, backgroundColor: '#27272a' },
  bulletRow:       { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bulletDot:       { width: 3, height: 3, borderRadius: 2, backgroundColor: '#a1a1aa', flexShrink: 0 },
  bulletText:      { color: '#a1a1aa', fontSize: 10, flex: 1 },
});
