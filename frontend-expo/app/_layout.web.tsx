import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

import { AuthProvider, useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/theme';

export const unstable_settings = {
  anchor: '(tabs)',
};

function SplashScreen() {
  return (
    <View style={splash.container}>
      <Image source={require('@/assets/images/st-glyph.png')} style={splash.logo} resizeMode="contain" />
      <Text style={splash.name}>Sonotrade</Text>
    </View>
  );
}

const splash = StyleSheet.create({
  container: { height: '100vh' as any, backgroundColor: Colors.dark.background, alignItems: 'center', justifyContent: 'center', gap: 12 },
  logo: { width: 48, height: 48 },
  name: { color: '#fff', fontSize: 28, fontWeight: '400', letterSpacing: -1.4, lineHeight: 42 },
});

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Desktop redirect
    const desktopUrl = process.env.EXPO_PUBLIC_DESKTOP_URL?.replace(/\/+$/, '');
    if (desktopUrl && window.innerWidth >= 1024) {
      window.location.replace(desktopUrl + window.location.pathname + window.location.search);
    }

    // Override React Native Web's body { overflow: hidden } so the document scrolls
    const style = document.createElement('style');
    style.id = 'sonotrade-scroll-fix';
    style.textContent = `
      html { height: auto !important; background-color: rgb(10, 10, 10) !important; overflow-x: hidden !important; }
      body { height: auto !important; overflow-x: hidden !important; overflow-y: auto !important; background-color: rgb(10, 10, 10) !important; overscroll-behavior-x: none !important; }
      #root { height: auto !important; background-color: rgb(10, 10, 10) !important; overflow-x: hidden !important; overflow-y: visible !important; }
      *::-webkit-scrollbar { display: none !important; }
      * { scrollbar-width: none !important; -ms-overflow-style: none !important; }
      input, textarea { outline: none !important; box-shadow: none !important; -webkit-tap-highlight-color: transparent !important; }
      input:focus, textarea:focus, input:focus-visible, textarea:focus-visible { outline: none !important; box-shadow: none !important; }
      textarea { resize: none !important; max-width: 100% !important; box-sizing: border-box !important; }
    `;
    document.head.appendChild(style);

    const lockHScroll = () => { if (window.scrollX !== 0) window.scrollTo({ left: 0, top: window.scrollY, behavior: 'instant' as any }); };
    window.addEventListener('scroll', lockHScroll, { passive: true });

    return () => { style.remove(); window.removeEventListener('scroll', lockHScroll); };
  }, []);

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === 'login' || segments[0] === 'welcome' || segments[0] === 'landing';
    if (!user && !inAuthGroup) router.replace('/landing' as any);
    else if (user && inAuthGroup) router.replace('/(tabs)');
  }, [user, loading, segments]);

  if (loading) return <SplashScreen />;

  // Slot instead of Stack — no position:absolute/overflow:hidden screen wrappers
  return <Slot />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ThemeProvider value={DarkTheme}>
        <RootLayoutNav />
        <StatusBar style="light" />
      </ThemeProvider>
    </AuthProvider>
  );
}
