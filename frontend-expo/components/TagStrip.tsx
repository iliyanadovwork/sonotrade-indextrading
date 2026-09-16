import { Text, ScrollView, StyleSheet, Pressable, Animated } from 'react-native';
import { useRef } from 'react';
import Svg, { Path } from 'react-native-svg';

export type TagId = 'all' | 'trending' | 'gainers' | 'dips' | 'high_volume' | 'high_index' | 'rising' | 'volatile' | 'stable';

export const TAGS: { id: TagId; label: string; d: string }[] = [
  { id: 'all',         label: 'All',            d: 'M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z' },
  { id: 'trending',    label: 'Trending',        d: 'M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4' },
  { id: 'gainers',     label: 'Biggest Gainers', d: 'M22 7 13.5 15.5 8.5 10.5 2 17M16 7h6v6' },
  { id: 'dips',        label: 'Biggest Dips',    d: 'M22 17 13.5 8.5 8.5 13.5 2 7M16 17h6v-6' },
  { id: 'high_volume', label: 'High Volume',     d: 'M3 3v16a2 2 0 0 0 2 2h16M19 9l-5 5-4-4-3 3' },
  { id: 'high_index',  label: 'Top Index',       d: 'M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41L13.7 2.71a2.41 2.41 0 0 0-3.41 0ZM9.2 9.2h.01m5.3.3-5 5m5.2 5h.01' },
  { id: 'rising',      label: 'Rising',          d: 'M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z' },
  { id: 'volatile',    label: 'Most Volatile',   d: 'M22 12h-4l-3 9L9 3l-3 9H2' },
  { id: 'stable',      label: 'Most Stable',     d: 'M18 20V10M12 20V4M6 20v-6' },
];

function TagPill({ tag, isActive, onSelect }: { tag: typeof TAGS[0]; isActive: boolean; onSelect: (id: TagId) => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () => Animated.spring(scale, { toValue: 0.9, useNativeDriver: true, speed: 50 }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50 }).start();

  return (
    <Pressable onPress={() => onSelect(tag.id)} onPressIn={onPressIn} onPressOut={onPressOut}>
      <Animated.View style={[styles.pill, isActive ? styles.pillActive : styles.pillInactive, { transform: [{ scale }] }]}>
        <Svg width={13} height={13} viewBox="0 0 24 24">
          <Path d={tag.d} fill="none" stroke={isActive ? '#fff' : '#a1a1aa'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
        <Text style={[styles.pillLabel, { color: isActive ? '#fff' : '#a1a1aa' }]}>{tag.label}</Text>
      </Animated.View>
    </Pressable>
  );
}

export function TagStrip({ active, onSelect, verticalPadding = 16, paddingTop }: { active: TagId; onSelect: (id: TagId) => void; verticalPadding?: number; paddingTop?: number }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.strip, { paddingVertical: verticalPadding, ...(paddingTop != null && { paddingTop }) }]}>
      {TAGS.map(tag => (
        <TagPill key={tag.id} tag={tag} isActive={active === tag.id} onSelect={onSelect} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  strip:       { paddingHorizontal: 16, gap: 8 },
  pill:        { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 99, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 7 },
  pillActive:  { borderColor: 'rgba(255,255,255,0.5)', backgroundColor: 'rgba(255,255,255,0.08)' },
  pillInactive:{ borderColor: '#27272a', backgroundColor: 'transparent' },
  pillLabel:   { fontSize: 13, fontWeight: '500' },
});
