import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { View, Text, Image, StyleSheet, Platform } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/theme';

export const unstable_settings = {
  anchor: '(tabs)',
};

function SplashScreen() {
  return (
    <View style={splash.container}>
      <StatusBar style="light" />
      <Image source={require('@/assets/images/st-glyph.png')} style={splash.logo} resizeMode="contain" />
      <Text style={splash.name}>Sonotrade</Text>
    </View>
  );
}

const splash = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  logo: {
    width: 48,
    height: 48,
  },
  name: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '400',
    letterSpacing: -1.4,
    lineHeight: 42,
  },
});

function RootLayoutNav() {
  const { loading } = useAuth();

  // Signing in is optional: guests land straight in (tabs) and browse freely — auth is asked
  // for at the point of action (trade / like / comment / portfolio) via the welcome screen
  // (/welcome?back=1), which unwinds back to where the user was after login.
  if (loading) return <SplashScreen />;

  return (
    <Stack>
      {/* auth screens present modally (slide up, swipe-down to dismiss) — an interruption
          layer over the guest's context, not a navigation push */}
      <Stack.Screen name="welcome" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="login" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="artist/[spotify_id]" options={{ headerShown: false }} />
      <Stack.Screen name="profile" options={{ headerShown: false }} />
      <Stack.Screen name="profile/[username]" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const desktopUrl = process.env.EXPO_PUBLIC_DESKTOP_URL?.replace(/\/+$/, '');
    if (!desktopUrl) return;
    if (window.innerWidth >= 1024) {
      window.location.replace(desktopUrl + window.location.pathname + window.location.search);
    }
  }, []);

  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <RootLayoutNav />
        <StatusBar style="light" />
      </ThemeProvider>
    </AuthProvider>
  );
}
