import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';

export function VerifiedBadge() {
  const star = "M12 1.5 L15.25 4.15 L19.42 4.58 L19.85 8.75 L22.5 12 L19.85 15.25 L19.42 19.42 L15.25 19.85 L12 22.5 L8.75 19.85 L4.58 19.42 L4.15 15.25 L1.5 12 L4.15 8.75 L4.58 4.58 L8.75 4.15 Z";
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path d={star} fill="#1d9bf0" />
      <Path d="M8.5 12.5l2 2 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

export function OGBadge() {
  return (
    <View style={{
      borderRadius: 4,
      overflow: 'hidden',
      height: 16,
      width: 24,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 0.8,
      borderColor: '#b8b0c8',
    }}>
      <Svg width={24} height={16} style={{ position: 'absolute', top: 0, left: 0 }}>
        <Defs>
          <LinearGradient id="og-metal" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0"    stopColor="#f2f0f5" />
            <Stop offset="0.18" stopColor="#c8c3d4" />
            <Stop offset="0.38" stopColor="#f8f6fa" />
            <Stop offset="0.5"  stopColor="#e2dde9" />
            <Stop offset="0.65" stopColor="#a89dba" />
            <Stop offset="0.82" stopColor="#ddd9e6" />
            <Stop offset="1"    stopColor="#f0eef5" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="24" height="16" rx="4" fill="url(#og-metal)" />
      </Svg>
      <Text style={{
        color: '#3b2a55',
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 0.5,
        textShadowColor: 'rgba(255,255,255,0.6)',
        textShadowOffset: { width: 0, height: 0.5 },
        textShadowRadius: 1,
      }}>OG</Text>
    </View>
  );
}
