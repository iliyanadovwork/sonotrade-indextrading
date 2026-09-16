import React, { useState } from 'react';
import {
  View, Text, Image, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, StatusBar, Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { ENDPOINTS } from '@/constants/API';
import { Colors } from '@/constants/theme';
import { NEGATIVE } from '@/constants/colors';

const { height: SH } = Dimensions.get('window');

export default function LoginScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  // back=1 → part of a guest sign-in flow (welcome screen prompt): after auth (or on ✕),
  // unwind to wherever the user was instead of teleporting to the tabs root.
  const { back } = useLocalSearchParams<{ back?: string }>();
  const { login } = useAuth();

  const exit = (authed: boolean) => {
    if (back === '1' && router.canGoBack()) router.back();
    else if (authed) router.replace('/(tabs)');
    else if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  const handleAuth = async () => {
    setLoading(true);
    setError(null);

    const url = isLogin ? ENDPOINTS.AUTH.LOGIN : ENDPOINTS.AUTH.SIGNUP;
    const body = isLogin
      ? JSON.stringify({ email, password })
      : JSON.stringify({ email, username, password, firstName, lastName });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      const data = await response.json();
      if (response.ok) {
        await login(data.token, data.user);
        exit(true);
      } else {
        // The API reports failures as `error` ('Invalid email or password',
        // or a code like 'signup_failed' for a 5xx); `message` is only ever set
        // on success. Reading `message` here meant every real reason collapsed
        // into a generic "Authentication failed".
        setError(data.error || data.message || 'Authentication failed');
      }
    } catch {
      setError('Connection error. Please check your backend.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Brand — fixed at top */}
      <View style={styles.topSection}>
        <View style={styles.brandRow}>
          <Image source={require('@/assets/images/st-glyph.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.brand}>Sonotrade</Text>
        </View>
        <TouchableOpacity style={styles.closeBtn} onPress={() => exit(false)} hitSlop={12}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Title */}
          <Text style={styles.title}>
            {isLogin ? 'Welcome back' : 'Create account'}
          </Text>

          {/* Inputs */}
          <View style={styles.fields}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#52525b"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            {!isLogin && (
              <TextInput
                style={styles.input}
                placeholder="Username"
                placeholderTextColor="#52525b"
                value={username}
                onChangeText={t => setUsername(t.toLowerCase())}
                autoCapitalize="none"
                autoCorrect={false}
              />
            )}

            {!isLogin && (
              <View style={styles.row}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="First name"
                  placeholderTextColor="#52525b"
                  value={firstName}
                  onChangeText={setFirstName}
                />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Last name"
                  placeholderTextColor="#52525b"
                  value={lastName}
                  onChangeText={setLastName}
                />
              </View>
            )}

            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#52525b"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          {/* Error */}
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Primary button */}
          <TouchableOpacity
            style={[styles.primaryBtn, loading && { opacity: 0.5 }]}
            onPress={handleAuth}
            disabled={loading}
          >
            <Text style={styles.primaryBtnText}>
              {loading ? 'Please wait…' : isLogin ? 'Log in' : 'Sign up'}
            </Text>
          </TouchableOpacity>

          {/* Toggle */}
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>
              {isLogin ? 'No account yet?' : 'Already have an account?'}
            </Text>
            <TouchableOpacity
              style={styles.outlineBtn}
              onPress={() => { setIsLogin(!isLogin); setError(null); }}
            >
              <Text style={styles.outlineBtnText}>
                {isLogin ? 'Sign up' : 'Log in'}
              </Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  topSection: {
    paddingHorizontal: 24,
    paddingTop: SH * 0.1,
    paddingBottom: 8,
  },
  closeBtn: {
    position: 'absolute',
    top: 64,
    right: 24,
  },
  closeText: {
    color: '#a1a1aa',
    fontSize: 20,
    fontWeight: '400',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: SH * 0.08,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '300',
    marginBottom: 28,
  },
  fields: {
    gap: 12,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  input: {
    backgroundColor: '#18181b',
    borderRadius: 99,
    paddingVertical: 13,
    paddingHorizontal: 20,
    color: '#fff',
    fontSize: 14,
  },
  errorBox: {
    borderWidth: 1,
    borderColor: '#3f3f46',
    backgroundColor: '#18181b',
    borderRadius: 99,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  errorText: {
    color: NEGATIVE,
    fontSize: 13,
  },
  primaryBtn: {
    backgroundColor: '#fff',
    borderRadius: 99,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtnText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
  },
  toggleRow: {
    marginTop: 20,
    alignItems: 'center',
    gap: 10,
  },
  toggleLabel: {
    color: '#71717a',
    fontSize: 13,
  },
  outlineBtn: {
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 99,
    paddingVertical: 13,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '100%',
  },
  outlineBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});
