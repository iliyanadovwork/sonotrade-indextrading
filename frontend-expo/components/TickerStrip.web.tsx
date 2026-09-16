import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { TrendArrow, trendColor } from '@/components/TrendArrow';

interface Artist {
  id: string;
  spotify_id?: string | null;
  name: string;
  current_index_value: number | null;
  change_1m: number | null;
  image_url?: string | null;
}

const CARD_WIDTH = 160;
const SCROLL_SPEED = 38; // ms per pixel

function ensureTickerKeyframes(totalWidth: number): string {
  const kfName = `sonotrade-ticker-${totalWidth}`;
  if (typeof document !== 'undefined' && !document.getElementById(kfName)) {
    const s = document.createElement('style');
    s.id = kfName;
    s.textContent = `@keyframes ${kfName}{from{transform:translateX(0px)}to{transform:translateX(-${totalWidth}px)}}`;
    document.head.appendChild(s);
  }
  return kfName;
}

export const TickerStrip = ({ artists }: { artists: Artist[] }) => {
  const router = useRouter();

  if (!artists || artists.length === 0) return null;

  const totalWidth = artists.length * CARD_WIDTH;
  const duration = ((totalWidth * SCROLL_SPEED) / 1000).toFixed(1);
  const kfName = ensureTickerKeyframes(totalWidth);
  const items = [...artists, ...artists];

  return (
    <View style={styles.wrapper}>
      {/* CSS animation instead of Animated.timing — runs on compositor, never freezes */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          animation: `${kfName} ${duration}s linear infinite`,
          willChange: 'transform',
        }}
      >
        {items.map((artist, index) => {
          const isUp = (artist.change_1m ?? 0) >= 0;
          return (
            <Pressable
              key={`${artist.id}-${index}`}
              style={styles.card}
              onPress={() => {
                router.push(
                  `/artist/${encodeURIComponent(artist.spotify_id ?? artist.name)}?image=${encodeURIComponent(artist.image_url ?? '')}&price=${artist.current_index_value ?? 0}&change=${artist.change_1m ?? 0}&name=${encodeURIComponent(artist.name)}` as any
                );
              }}
            >
              {({ pressed }) => (
                <View style={[styles.cardInner, { opacity: pressed ? 0.6 : 1 }]}>
                  <View style={styles.topInfo}>
                    {artist.image_url ? (
                      <Image source={{ uri: artist.image_url }} style={styles.avatar} />
                    ) : (
                      <View style={styles.avatarPlaceholder} />
                    )}
                    <View style={{ gap: 3 }}>
                      <Text style={styles.name} numberOfLines={1}>{artist.name}</Text>
                      <Text style={styles.label}>Index</Text>
                    </View>
                  </View>
                  <View style={styles.priceRow}>
                    <Text style={styles.price}>
                      {artist.current_index_value != null
                        ? artist.current_index_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : '—'}
                    </Text>
                    <Text style={styles.currency}>USD</Text>
                  </View>
                  <View style={styles.changeRow}>
                    <TrendArrow positive={isUp} size={13} />
                    <Text style={[styles.change, { color: trendColor(isUp) }]}>
                      {Math.abs(artist.change_1m ?? 0).toFixed(2)}%
                    </Text>
                  </View>
                </View>
              )}
            </Pressable>
          );
        })}
      </div>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#1c1c1e',
    marginTop: -8,
    marginBottom: 24,
    backgroundColor: Colors.dark.background,
    maxHeight: 140,
    overflow: 'hidden',
  },
  card: {
    minWidth: CARD_WIDTH,
    borderRightWidth: 1,
    borderRightColor: '#1c1c1e',
    justifyContent: 'center',
  },
  cardInner: {
    paddingLeft: 16,
    paddingRight: 16,
    paddingVertical: 16,
    justifyContent: 'center',
  },
  topInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#27272a',
  },
  name: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    maxWidth: 100,
  },
  label: {
    color: '#71717a',
    fontSize: 11,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  price: {
    color: '#71717a',
    fontSize: 12,
  },
  currency: {
    color: '#71717a',
    fontSize: 10,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 6,
  },
  change: {
    fontSize: 12,
    fontWeight: '500',
  },
});
