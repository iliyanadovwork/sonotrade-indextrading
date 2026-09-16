import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/theme';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* Background image */}
      <Image
        source={require('../public/images/images3.png')}
        style={styles.bgImage}
        resizeMode="contain"
        blendMode="multiply"
      />

      {/* Bottom fade */}
      <LinearGradient
        colors={['transparent', Colors.dark.background]}
        locations={[0, 0.75]}
        style={styles.gradientBottom}
        pointerEvents="none"
      />

      {/* Monogram */}
      <View style={styles.monogramWrap} pointerEvents="none">
        <Image
          source={require('@/assets/images/monogram.png')}
          style={styles.monogramImg}
          resizeMode="cover"
        />
        <LinearGradient
          colors={['transparent', 'transparent', Colors.dark.background]}
          locations={[0, 0.6, 1]}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
      </View>

      {/* Brand */}
      <View style={styles.topSection}>
        <View style={styles.brandRow}>
          <Image source={require('@/assets/images/st-glyph.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.brand}>Sonotrade</Text>
        </View>
        <Text style={styles.motto}>Trade Music</Text>
      </View>

      <View style={{ flex: 1 }} />

      {/* Buttons */}
      <View style={styles.buttons}>
        <TouchableOpacity style={styles.appleBtn} onPress={() => {}}>
          <Svg width="18" height="18" viewBox="0 0 24 24" fill="white">
            <Path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
          </Svg>
          <Text style={styles.appleBtnText}>Continue with Apple</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.emailBtn} onPress={() => router.push('/login')}>
          <Text style={styles.emailBtnText}>Continue with Email</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: '100vh' as any,
    backgroundColor: Colors.dark.background,
    overflow: 'hidden' as any,
  },
  bgImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%' as any,
    height: '100%' as any,
    transform: [{ scale: 1.8 }],
  },
  monogramWrap: {
    position: 'absolute',
    top: '-42%' as any,
    left: 0,
    right: 0,
    height: '65%' as any,
    opacity: 0.8,
  },
  monogramImg: {
    width: '100%',
    height: '100%',
  },
  gradientBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '65%' as any,
  },
  topSection: {
    paddingHorizontal: 24,
    paddingTop: '10vh' as any,
    paddingBottom: 8,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  logo: {
    width: 48,
    height: 48,
  },
  brand: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '400',
    letterSpacing: -1.8,
    lineHeight: 54,
  },
  motto: {
    color: '#71717a',
    fontSize: 13,
    letterSpacing: 4,
    marginLeft: 12,
    marginTop: 20,
  },
  buttons: {
    paddingHorizontal: 24,
    paddingBottom: 48,
    gap: 12,
  },
  appleBtn: {
    backgroundColor: Colors.dark.background,
    borderWidth: 1,
    borderColor: '#1c1c1e',
    paddingVertical: 14,
    borderRadius: 99,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  appleBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  emailBtn: {
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 99,
    alignItems: 'center',
  },
  emailBtnText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '600',
  },
});
