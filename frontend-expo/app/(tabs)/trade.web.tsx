import { View, Text, Image, StyleSheet, Pressable } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

import { TagStrip, type TagId } from '@/components/TagStrip';
import { ENDPOINTS } from '@/constants/API';
import { Sparkline } from '@/components/Sparkline';
import { Spinner } from '@/components/Spinner';
import { MarketMovers } from '@/components/MarketMovers';
import { FeaturedCarousel } from '@/components/FeaturedCarousel';
import { FeaturedCards } from '@/components/FeaturedCards';
import { Colors } from '@/constants/theme';
import { TrendArrow, trendColor } from '@/components/TrendArrow';
import { NEGATIVE } from '@/constants/colors';

interface DataPoint {
  index: number;
  timestamp: string;
}

interface Artist {
  id: string;
  name: string;
  spotify_id?: string | null;
  current_index_value: number;
  change_1w: number;
  change_1d: number;
  change_1m: number;
  volume: number;
  volatility: number;
  data_points: DataPoint[];
  image_url?: string | null;
}

type ArtistWithSparkline = Artist & { sparklineValues: number[] };

const PAGE_SIZE = 50;

function fmtVolume(value: number | null | undefined): string {
  if (value == null) return '-';
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return value.toLocaleString();
}

function ArtistRow({ item, index, onPress }: { item: ArtistWithSparkline; index: number; onPress: () => void }) {
  const [hovered, setHovered] = useState(false);
  const isPositive = (item.change_1m ?? 0) >= 0;

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [
        styles.rowOuter,
        hovered && styles.rowHovered,
        pressed && { backgroundColor: '#27272a' },
      ]}
    >
      {({ pressed }) => (
        <>
          <View style={[
            styles.rowInner,
            { transform: [{ scale: pressed ? 0.97 : 1 }], transitionProperty: 'transform', transitionDuration: '150ms', transitionTimingFunction: 'ease-out' } as any,
          ]}>
            {item.image_url ? (
              <Image source={{ uri: item.image_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder} />
            )}

            <View style={styles.nameInfo}>
              <Text style={styles.artistName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.indexLabel}>Vol ${fmtVolume(item.volume)}</Text>
            </View>

            <View style={styles.chartWrap}>
              <Sparkline data={item.sparklineValues} width={60} height={30} />
            </View>

            <View style={styles.priceWrap}>
              <Text style={styles.price}>
                {item.current_index_value?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
              <View style={styles.changeRow}>
                <TrendArrow positive={isPositive} size={11} />
                <Text style={[styles.changeText, { color: trendColor(isPositive) }]}>
                  {Math.abs(item.change_1m ?? 0).toFixed(2)}%
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.divider} />
        </>
      )}
    </Pressable>
  );
}

export default function HomeScreen() {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<TagId>('all');
  const offsetRef = useRef(0);
  const isFirstLoad = useRef(true);
  const fetchIdRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const hasMoreRef = useRef(true);
  const activeTagRef = useRef<TagId>('all');
  const router = useRouter();

  function tagToSortParams(tag: TagId): { sort_by: string; sort_dir: string; clientFilter?: (a: Artist) => boolean } {
    switch (tag) {
      case 'trending':
      case 'high_volume':  return { sort_by: 'volume', sort_dir: 'desc' };
      case 'gainers':
      case 'rising':       return { sort_by: 'change_1m', sort_dir: 'desc', clientFilter: a => (a.change_1m ?? 0) > 0 };
      case 'dips':         return { sort_by: 'change_1m', sort_dir: 'asc',  clientFilter: a => (a.change_1m ?? 0) < 0 };
      case 'high_index':   return { sort_by: 'current_index_value', sort_dir: 'desc' };
      case 'volatile':     return { sort_by: 'change_1m', sort_dir: 'desc' };
      case 'stable':       return { sort_by: 'change_1m', sort_dir: 'asc' };
      default:             return { sort_by: 'current_index_value', sort_dir: 'desc' };
    }
  }

  async function fetchPage(offset: number, append: boolean, tag: TagId = activeTag) {
    const fetchId = ++fetchIdRef.current;
    if (offset === 0) {
      if (isFirstLoad.current) { setLoading(true); isFirstLoad.current = false; }
      else { setListLoading(true); }
    } else {
      setLoadingMore(true);
      loadingMoreRef.current = true;
    }
    try {
      const { sort_by, sort_dir, clientFilter } = tagToSortParams(tag);
      const res = await fetch(`${ENDPOINTS.ARTISTS}?limit=${PAGE_SIZE}&offset=${offset}&sort_by=${sort_by}&sort_dir=${sort_dir}`);
      const json = await res.json();
      if (fetchId !== fetchIdRef.current) return;
      let page: Artist[] = json.artists || [];
      if (clientFilter) page = page.filter(clientFilter);
      if (append) {
        setArtists(prev => [...prev, ...page]);
      } else {
        setArtists(page);
      }
      const more = (json.artists || []).length === PAGE_SIZE;
      setHasMore(more);
      hasMoreRef.current = more;
      offsetRef.current = offset + (json.artists || []).length;
    } catch (e: any) {
      if (fetchId !== fetchIdRef.current) return;
      setError(e?.message || 'Error');
    } finally {
      if (fetchId !== fetchIdRef.current) return;
      setLoading(false);
      setListLoading(false);
      setLoadingMore(false);
      loadingMoreRef.current = false;
    }
  }

  useEffect(() => {
    activeTagRef.current = activeTag;
    offsetRef.current = 0;
    fetchPage(0, false, activeTag);
  }, [activeTag]);

  // Window scroll for infinite load — uses refs to avoid stale closures
  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY + window.innerHeight;
      const total = document.documentElement.scrollHeight;
      if (total - scrolled < 600 && !loadingMoreRef.current && hasMoreRef.current) {
        fetchPage(offsetRef.current, true, activeTagRef.current);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const artistsWithSparkline = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return artists.map(a => {
      const pts = (a.data_points ?? []).map(dp => ({
        value: dp.index,
        ts: new Date(dp.timestamp).getTime(),
      }));
      const window30 = pts.filter(p => p.ts >= cutoff);
      const source = window30.length >= 2 ? window30 : pts;
      return { ...a, sparklineValues: source.map(p => p.value) };
    });
  }, [artists]);

  return (
    <View style={styles.container}>
      <div style={{ position: 'sticky', top: 0, zIndex: 50, backgroundColor: Colors.dark.background }}>
        <View style={styles.header}>
          <Image source={require('@/assets/images/st-glyph.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.brandName}>Sonotrade</Text>
          <View style={{ flex: 1 }} />
          <Pressable hitSlop={12}>
            <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <Path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
        </View>
      </div>

      {loading && (
        <View style={[styles.center, { minHeight: 'calc(100vh - 120px)' as any }]}>
          <Spinner size={32} />
        </View>
      )}

      {error && (
        <View style={[styles.center, { minHeight: 'calc(100vh - 120px)' as any }]}>
          <Text style={{ color: NEGATIVE }}>Error connecting to backend: {error}</Text>
          <Text style={{ color: 'gray', marginTop: 8, fontSize: 12 }}>URL: {ENDPOINTS.ARTISTS}</Text>
        </View>
      )}

      {!loading && !error && (
        <View>
          <FeaturedCarousel />
          <MarketMovers />
          <FeaturedCards />
          <View style={{ paddingLeft: 20, paddingRight: 16, paddingTop: 16, paddingBottom: 0, gap: 3 }}>
            <Text style={styles.tableHeader}>Trade</Text>
            <Text style={styles.tableSubheader}>Long or short on any artist</Text>
          </View>
          <TagStrip active={activeTag} onSelect={setActiveTag} />

          {listLoading ? (
            <View style={styles.center}>
              <Spinner size={28} />
            </View>
          ) : (
            artistsWithSparkline.map((item, index) => (
              <ArtistRow
                key={item.id}
                item={item}
                index={index}
                onPress={() => router.push(`/artist/${encodeURIComponent(item.spotify_id ?? item.name)}?image=${encodeURIComponent(item.image_url ?? '')}&price=${item.current_index_value ?? 0}&change=${item.change_1m ?? 0}&rank=${index + 1}&name=${encodeURIComponent(item.name)}` as any)}
              />
            ))
          )}

          {loadingMore && (
            <View style={styles.footerLoader}>
              <Spinner size={24} />
            </View>
          )}

          <View style={{ height: 80 }} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    overflow: 'visible' as any,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 32,
    height: 32,
  },
  brandName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '400',
    letterSpacing: -1.2,
    lineHeight: 36,
  },
  tableHeader: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '400',
    letterSpacing: -0.4,
  },
  tableSubheader: {
    color: '#a1a1aa',
    fontSize: 12,
    letterSpacing: -0.3,
  },
  center: {
    paddingVertical: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerLoader: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  rowOuter: {
    paddingHorizontal: 16,
    backgroundColor: Colors.dark.background,
    cursor: 'pointer' as any,
  },
  rowHovered: {
    backgroundColor: '#18181b',
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 10,
  },
  divider: {
    height: 1,
    backgroundColor: '#1c1c1e',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    flexShrink: 0,
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#27272a',
    flexShrink: 0,
  },
  nameInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  artistName: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '400',
    letterSpacing: -0.2,
  },
  indexLabel: {
    fontSize: 11,
    color: '#a1a1aa',
  },
  chartWrap: {
    width: 60,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  priceWrap: {
    alignItems: 'flex-end',
    flexShrink: 0,
    minWidth: 72,
    gap: 3,
  },
  price: {
    fontSize: 15,
    fontWeight: '400',
    color: '#fff',
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  changeText: {
    fontSize: 12,
  },
});
