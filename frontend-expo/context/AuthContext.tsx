import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ENDPOINTS } from '@/constants/API';

interface User {
  id: string;
  email: string;
  username: string;
  avatar_url?: string | null;
  balance?: number | string | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (token: string, userData: User) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('auth_token');
      if (storedToken) {
        setToken(storedToken);
        // Fetch user info
        const response = await fetch(ENDPOINTS.AUTH.ME, {
          headers: {
            'Authorization': `Bearer ${storedToken}`,
          },
        });
        if (response.ok) {
          const json = await response.json();
          setUser(json.user ?? json);
          console.log('[auth] session restored:', (json.user ?? json)?.username);
        } else if (response.status === 401 || response.status === 403) {
          // Token definitively invalid (expired 7d JWT or rotated secret) → sign out
          console.warn(`[auth] stored session rejected by /auth/me (${response.status}) — signing out`);
          await logout();
        } else {
          // Other failures (5xx, backend cold start): keep the stored session —
          // don't destroy a valid login over a transient server error.
          console.warn(`[auth] /auth/me failed (${response.status}) — keeping stored session`);
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (newToken: string, userData: User) => {
    await AsyncStorage.setItem('auth_token', newToken);
    setToken(newToken);
    setUser(userData);
  };

  const logout = async () => {
    await AsyncStorage.removeItem('auth_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
