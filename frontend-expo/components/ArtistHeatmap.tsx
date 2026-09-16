import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/theme';
import { POSITIVE, NEGATIVE } from '@/constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Artist {
  id: string;
  spotify_id?: string | null;
  name: string;
  current_index_value: number;
  change_1m: number;
}

interface TreemapNode {
  id: string;
  name: string;
  value: number;
  change: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

function layout(
  items: { id: string; name: string; value: number; change: number }[],
  x: number, y: number, w: number, h: number
): TreemapNode[] {
  if (items.length === 0) return [];
  if (items.length === 1) return [{ ...items[0], x, y, width: w, height: h }];

  const total = items.reduce((s, i) => s + i.value, 0);
  let cum = 0;
  let splitIdx = items.length - 1;
  for (let i = 0; i < items.length - 1; i++) {
    cum += items[i].value;
    if (cum / total >= 0.5) { splitIdx = i + 1; break; }
  }

  const g1 = items.slice(0, splitIdx);
  const g2 = items.slice(splitIdx);
  const r = g1.reduce((s, i) => s + i.value, 0) / (total || 1);

  if (w >= h) {
    return [
      ...layout(g1, x, y, w * r, h),
      ...layout(g2, x + w * r, y, w * (1 - r), h),
    ];
  } else {
    return [
      ...layout(g1, x, y, w, h * r),
      ...layout(g2, x, y + h * r, w, h * (1 - r)),
    ];
  }
}

function changeToColor(change: number): string {
  if (change >= 5)  return 'rgba(4,223,162,0.30)';
  if (change >= 2)  return 'rgba(4,223,162,0.18)';
  if (change >= 0)  return 'rgba(4,223,162,0.08)';
  if (change >= -2) return 'rgba(255,75,75,0.08)';
  if (change >= -5) return 'rgba(255,75,75,0.18)';
  return 'rgba(255,75,75,0.30)';
}

function changeToTextColor(change: number): string {
  return change >= 0 ? POSITIVE : NEGATIVE;
}

interface ArtistHeatmapProps {
  artists: Artist[];
}

export function ArtistHeatmap({ artists }: ArtistHeatmapProps) {
  const router = useRouter();

  if (!artists || artists.length === 0) return null;

  const items = [...artists]
    .filter(a => a.current_index_value > 0)
    .sort((a, b) => b.current_index_value - a.current_index_value)
    .slice(0, 15) // Limit for mobile to keep it readable
    .map(a => ({
      id: a.spotify_id ?? a.id,
      name: a.name,
      value: a.current_index_value,
      change: a.change_1m
    }));

  const nodes = layout(items, 0, 0, 100, 100);
  const GAP = 2;
  const ASPECT_RATIO = 1.2;
  const CONTAINER_WIDTH = SCREEN_WIDTH - 32;
  const CONTAINER_HEIGHT = CONTAINER_WIDTH / ASPECT_RATIO;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Artist Heatmap (1m)</Text>
      <View style={[styles.grid, { height: CONTAINER_HEIGHT }]}>
        {nodes.map((node) => (
          <TouchableOpacity
            key={node.id}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/artist/${encodeURIComponent(node.id)}?price=${node.value ?? 0}&change=${node.change ?? 0}&name=${encodeURIComponent(node.name)}` as any); }}
            style={[
              styles.node,
              {
                left: `${node.x}%`,
                top: `${node.y}%`,
                width: `${node.width}%`,
                height: `${node.height}%`,
                padding: GAP,
              }
            ]}
          >
            <View style={[styles.nodeInner, { backgroundColor: changeToColor(node.change) }]}>
              <Text 
                numberOfLines={1} 
                style={[
                  styles.nodeName,
                  { fontSize: node.width > 20 ? 12 : 10 }
                ]}
              >
                {node.name}
              </Text>
              <Text 
                style={[
                  styles.nodeChange,
                  { 
                    color: changeToTextColor(node.change),
                    fontSize: node.width > 20 ? 10 : 8
                  }
                ]}
              >
                {node.change >= 0 ? '+' : ''}{node.change.toFixed(1)}%
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginBottom: 24,
    marginTop: 16,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  grid: {
    width: '100%',
    position: 'relative',
    backgroundColor: Colors.dark.background,
    overflow: 'hidden',
  },
  node: {
    position: 'absolute',
  },
  nodeInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeName: {
    color: '#fff',
    fontWeight: '600',
  },
  nodeChange: {
    marginTop: 2,
  }
});
