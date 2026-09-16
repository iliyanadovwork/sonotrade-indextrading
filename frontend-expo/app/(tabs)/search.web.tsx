import { View, Text, StyleSheet, TextInput, Pressable, Image, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import { TagStrip, type TagId } from '@/components/TagStrip';
import { ENDPOINTS } from '@/constants/API';
import Svg, { Path } from 'react-native-svg';
import { Spinner } from '@/components/Spinner';
import { TrendArrow, trendColor } from '@/components/TrendArrow';
import { SonotradeHeader } from '@/components/SonotradeHeader';
import { TickerStrip } from '@/components/TickerStrip';
import { Colors } from '@/constants/theme';

interface Artist {
  id: string;
  spotify_id?: string | null;
  name: string;
  current_index_value: number | null;
  change_1m: number | null;
  volume: number | null;
  image_url?: string | null;
  fromSpotify?: boolean;
}

const GAP = 14;
const PADDING = 16;

function formatVolume(value: number | null | undefined): string {
  if (value == null) return 'Vol. 0';
  if (value >= 1_000_000_000) return `Vol. ${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `Vol. ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `Vol. ${(value / 1_000).toFixed(1)}K`;
  return `Vol. ${value.toFixed(0)}`;
}

function ArtistCard({ item, cardWidth }: { item: Artist; cardWidth: number }) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);
  const isNewArtist = item.fromSpotify === true;
  const isUp = (item.change_1m ?? 0) >= 0;

  return (
    <Pressable
      onPress={() => router.push(`/artist/${encodeURIComponent(item.spotify_id ?? item.name)}?image=${encodeURIComponent(item.image_url ?? '')}&price=${item.current_index_value ?? 0}&change=${item.change_1m ?? 0}&name=${encodeURIComponent(item.name)}` as any)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [
        { width: cardWidth, transform: [{ scale: pressed ? 0.95 : 1 }] },
        hovered && { opacity: 0.8 },
        { transitionProperty: 'transform', transitionDuration: '150ms', transitionTimingFunction: 'ease-out' } as any,
      ]}
    >
      <View style={styles.card}>
        <View style={[styles.imageBox, { height: cardWidth }]}>
          {item.image_url ? (
            <Image
              source={{ uri: item.image_url }}
              style={StyleSheet.absoluteFillObject}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.placeholderLetter}>
                {item.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
          <View style={styles.statsRow}>
            <Text style={styles.price}>
              {isNewArtist || item.current_index_value == null
                ? '—'
                : item.current_index_value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
            <View style={styles.changeRow}>
              <TrendArrow positive={isNewArtist ? true : isUp} size={11} />
              <Text style={[styles.change, { color: trendColor(isNewArtist ? true : isUp) }]}>
                {isNewArtist ? '0.00' : Math.abs(item.change_1m ?? 0).toFixed(2)}%
              </Text>
            </View>
          </View>
          <Text style={styles.volume}>{isNewArtist ? 'Vol. 0' : formatVolume(item.volume)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function SearchScreen() {
  const [search, setSearch] = useState('');
  const [artists, setArtists] = useState<Artist[]>([]);
  const [tickerArtists, setTickerArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTag, setActiveTag] = useState<TagId>('all');
  const { width } = useWindowDimensions();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeTagRef = useRef<TagId>('all');

  const cardWidth = (width - PADDING * 2 - GAP) / 2;

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

  useEffect(() => {
    fetch(`${ENDPOINTS.ARTISTS}?limit=100&sort_by=current_index_value&sort_dir=desc`)
      .then(r => r.json())
      .then(json => setTickerArtists(json.artists || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { fetchArtists(search, activeTagRef.current); }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  useEffect(() => {
    activeTagRef.current = activeTag;
    fetchArtists(search, activeTag);
  }, [activeTag]);

  async function fetchArtists(query: string, tag: TagId) {
    setLoading(true);
    setArtists([]);
    try {
      if (query.trim()) {
        const res = await fetch(`${ENDPOINTS.SEARCH}?q=${encodeURIComponent(query.trim())}`);
        const json = await res.json();
        const result: Artist[] = (json.results || []).map((r: any) => ({
          id: r.id,
          spotify_id: r.id,
          name: r.name,
          current_index_value: r.index_price ?? null,
          change_1m: r.change_1m ?? null,
          volume: r.volume ?? null,
          image_url: r.image_url ?? null,
          fromSpotify: r.fromSpotify === true,
        }));
        setArtists(result);
      } else {
        const { sort_by, sort_dir } = tagToSortParams(tag);
        const url = `${ENDPOINTS.ARTISTS}?limit=100&sort_by=${sort_by}&sort_dir=${sort_dir}`;
        const res = await fetch(url);
        const json = await res.json();
        const { clientFilter } = tagToSortParams(tag);
        const result: Artist[] = clientFilter
          ? (json.artists || []).filter(clientFilter)
          : (json.artists || []);
        setArtists(result);
      }
    } catch {
      setArtists([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <SonotradeHeader />
      <View style={{ marginTop: 12 }}>
        <TickerStrip artists={tickerArtists.slice(0, 10)} />
      </View>
      <div style={{ position: 'sticky', top: 56, zIndex: 49, backgroundColor: Colors.dark.background }}>
        <View style={styles.header}>
          <View style={styles.searchBarContainer}>
            <Svg width="18" height="18" viewBox="0 0 24 24" style={styles.searchIcon}>
              <Path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" fill="none" stroke="#71717a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <TextInput
              style={styles.searchInput}
              placeholder="Search artists..."
              placeholderTextColor="#71717a"
              value={search}
              onChangeText={setSearch}
            />
          </View>
        </View>
        <TagStrip active={activeTag} onSelect={setActiveTag} verticalPadding={8} paddingTop={12} />
      </div>

      {loading ? (
        <View style={styles.listSpinner}>
          <Spinner size={28} />
        </View>
      ) : artists.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No artists found</Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {artists.map(item => (
            <ArtistCard key={item.id} item={item} cardWidth={cardWidth} />
          ))}
        </View>
      )}

      <View style={{ height: 80 }} />
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
    paddingHorizontal: PADDING,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 99,
    borderWidth: 1,
    borderColor: '#27272a',
    paddingLeft: 14,
    paddingRight: 10,
    paddingVertical: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    height: 32,
    paddingVertical: 0,
    textAlignVertical: 'center',
    outlineStyle: 'none',
  } as any,
  listSpinner: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: PADDING,
    gap: GAP,
    paddingTop: GAP,
  },
  card: {
    borderRadius: 6,
    overflow: 'hidden',
    cursor: 'pointer' as any,
  },
  imageBox: {
    backgroundColor: '#18181b',
    borderRadius: 4,
    overflow: 'hidden',
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#27272a',
  },
  placeholderLetter: {
    color: '#71717a',
    fontSize: 24,
    fontWeight: '600',
  },
  info: {
    paddingTop: 6,
    paddingBottom: 8,
    gap: 4,
  },
  name: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  price: {
    color: '#71717a',
    fontSize: 12,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  change: {
    fontSize: 11,
    fontWeight: '500',
  },
  volume: {
    color: '#52525b',
    fontSize: 11,
  },
  emptyContainer: {
    paddingTop: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#71717a',
    fontSize: 16,
  },
});
