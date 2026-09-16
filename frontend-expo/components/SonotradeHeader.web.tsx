import { View, Text, Image, StyleSheet } from 'react-native';
import React from 'react';
import { Colors } from '@/constants/theme';

export function SonotradeHeader({ right }: { right?: React.ReactNode }) {
  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 50, backgroundColor: Colors.dark.background }}>
      <View style={styles.header}>
        <Image source={require('@/assets/images/st-glyph.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.brandName}>Sonotrade</Text>
        {right ? <View style={styles.rightSlot}>{right}</View> : null}
      </View>
    </div>
  );
}

const styles = StyleSheet.create({
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
    flex: 1,
  },
  rightSlot: {
    marginLeft: 8,
  },
});
