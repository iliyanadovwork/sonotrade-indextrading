import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { TrendArrow, trendColor } from '@/components/TrendArrow';
import { API_URL } from '@/constants/API';

interface Artist {
  id: string;
  name: string;
  spotify_id?: string | null;
  index_price: number;
  change_1m: number;
  volume: number;
  image_url?: string | null;
}

function mapArtist(a: any): Artist {
  return {
    id: a.id ?? a.name,
    name: a.name,
    spotify_id: a.spotify_id ?? null,
    index_price: a.index_price ?? a.mark_price ?? a.current_index_value ?? 0,
    change_1m: a.change_1m ?? 0,
    volume: a.volume ?? 0,
    image_url: a.image_url ?? null,
  };
}

const SECTION_WIDTH = 280;
const SECTION_GAP = 32;
const SNAP_INTERVAL = SECTION_WIDTH + SECTION_GAP; // 312
const N = 3; // number of unique sections

function MoverRow({ item, onPress }: { item: Artist; onPress: () => void }) {
  const isUp = (item.change_1m ?? 0) >= 0;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && styles.rowPressed,
        { transform: [{ scale: pressed ? 0.97 : 1 }], transitionProperty: 'transform', transitionDuration: '150ms', transitionTimingFunction: 'ease-out' } as any,
      ]}
    >
      <View style={styles.rowInner}>
        <View style={styles.nameCol}>
          {item.image_url
            ? <Image source={{ uri: item.image_url }} style={styles.avatar} />
            : <View style={styles.dot} />}
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
    </Pressable>
  );
}

export const MarketMovers = () => {
  const router = useRouter();

  // Start at N (first of the middle copy) so we can loop in both directions
  const [snapIndex, setSnapIndex] = useState(N);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [animate, setAnimate] = useState(false);
  const startX = useRef(0);
  const velocityX = useRef(0);
  const lastX = useRef(0);
  const lastT = useRef(0);

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

  // After snap animation completes, silently jump back to middle copy if at an edge
  useEffect(() => {
    if (isDragging) return;
    const timer = setTimeout(() => {
      if (snapIndex < N || snapIndex >= N * 2) {
        // Disable transition, jump to equivalent middle-copy position instantly
        setAnimate(false);
        setSnapIndex(((snapIndex % N) + N) % N + N);
        // Re-enable transition on next frame
        requestAnimationFrame(() => setAnimate(true));
      }
    }, 340); // after the 320ms snap transition finishes
    return () => clearTimeout(timer);
  }, [snapIndex, isDragging]);

  if (!loaded) return null;

  const sections = [
    { title: 'Biggest Gainers', subtitle: 'Last 30 days', data: gainers  },
    { title: 'Highest Volume',  subtitle: 'Last 30 days', data: volume   },
    { title: 'Most Volatile',   subtitle: 'Last 30 days', data: volatile },
  ];

  // 3 copies: [0,1,2] [3,4,5] [6,7,8]
  const allSections = [0, 1, 2].flatMap(copy =>
    sections.map((s, i) => ({ ...s, key: `${copy}-${i}` }))
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    startX.current = e.clientX;
    lastX.current = e.clientX;
    lastT.current = e.timeStamp;
    velocityX.current = 0;
    setIsDragging(true);
    setAnimate(false);
    setDragOffset(0);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const dt = e.timeStamp - lastT.current;
    if (dt > 0) velocityX.current = (e.clientX - lastX.current) / dt;
    lastX.current = e.clientX;
    lastT.current = e.timeStamp;
    setDragOffset(e.clientX - startX.current);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    setAnimate(true);
    const dx = e.clientX - startX.current;
    const vx = velocityX.current;
    let next = snapIndex;
    if (vx < -0.3 || dx < -(SNAP_INTERVAL * 0.35)) next = snapIndex + 1;
    else if (vx > 0.3 || dx > SNAP_INTERVAL * 0.35) next = snapIndex - 1;
    // Clamp to valid range (0 to N*3-1)
    next = Math.max(0, Math.min(N * 3 - 1, next));
    setSnapIndex(next);
    setDragOffset(0);
  };

  const translateX = -(snapIndex * SNAP_INTERVAL) + dragOffset;
  const transition = (isDragging || !animate)
    ? 'none'
    : 'transform 320ms cubic-bezier(0.25, 0.46, 0.45, 0.94)';

  const navigateTo = (artist: Artist) =>
    router.push(`/artist/${encodeURIComponent(artist.spotify_id ?? artist.id)}?image=${encodeURIComponent(artist.image_url ?? '')}&price=${artist.index_price ?? 0}&change=${artist.change_1m ?? 0}&name=${encodeURIComponent(artist.name)}` as any);

  return (
    <View style={styles.container}>
      <div
        style={{ overflow: 'hidden', touchAction: 'pan-y', cursor: 'grab' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            gap: SECTION_GAP,
            paddingLeft: 16,
            paddingRight: 16,
            paddingTop: 16,
            paddingBottom: 16,
            transform: `translateX(${translateX}px)`,
            transition,
            willChange: 'transform',
            userSelect: 'none',
          }}
        >
          {allSections.map((s, idx) => (
            <div key={s.key} style={{ width: SECTION_WIDTH, flexShrink: 0 }}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{s.title}</Text>
                <Text style={styles.sectionSubtitle}>{s.subtitle}</Text>
              </View>
              {s.data.map(item => (
                <MoverRow key={`${s.key}-${item.id}`} item={item} onPress={() => navigateTo(item)} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    marginBottom: 20,
    backgroundColor: '#111111',
    borderRadius: 12,
    marginHorizontal: 10,
    borderWidth: 1,
    borderColor: '#222222',
    overflow: 'hidden',
  },
  sectionHeader: { gap: 3, marginBottom: 16 },
  sectionTitle:    { color: '#fff', fontSize: 16, fontWeight: '400', letterSpacing: -0.4 },
  sectionSubtitle: { color: '#a1a1aa', fontSize: 12, letterSpacing: -0.3 },
  row:        { marginHorizontal: -6, paddingHorizontal: 6, borderRadius: 8, marginVertical: 2 },
  rowPressed: { backgroundColor: '#27272a' },
  rowInner:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  nameCol:   { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  avatar:    { width: 32, height: 32, borderRadius: 16 },
  dot:       { width: 32, height: 32, borderRadius: 16, backgroundColor: '#27272a' },
  nameInfo:  { flex: 1, minWidth: 0, gap: 2 },
  nameText:  { color: '#fff', fontSize: 14, fontWeight: '400', letterSpacing: -0.2 },
  indexLabel: { color: '#a1a1aa', fontSize: 11 },
  valueCol:  { alignItems: 'flex-end', gap: 4 },
  changeRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  priceText: { color: '#a1a1aa', fontSize: 11 },
  usdLabel:  { color: '#a1a1aa', fontSize: 9 },
  changeText: { fontSize: 11 },
});
