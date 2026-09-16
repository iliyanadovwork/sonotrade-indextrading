import { View, Text, Image, StyleSheet } from 'react-native';
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function SonotradeHeader({ right }: { right?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <Image source={require('@/assets/images/st-glyph.png')} style={styles.logo} resizeMode="contain" />
      <Text style={styles.brandName}>Sonotrade</Text>
      {right ? <View style={styles.rightSlot}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    marginBottom: 16,
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
