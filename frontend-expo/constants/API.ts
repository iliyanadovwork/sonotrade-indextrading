import Constants from 'expo-constants';

const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const debuggerHost = Constants.expoConfig?.hostUri;
const devHost = debuggerHost ? debuggerHost.split(':')[0] : 'localhost';

/**
 * Production/TestFlight builds must set EXPO_PUBLIC_API_URL at build time:
 * - Local .env (not committed) for `eas build`, or
 * - Expo dashboard → Environment variables for the production environment.
 * Dev-only: falls back to Metro host so a physical device can hit your LAN backend.
 */
export const API_URL = envUrl
  ? envUrl
  : __DEV__
    ? `http://${devHost}:3001`
    : (() => {
        throw new Error(
          'EXPO_PUBLIC_API_URL is required for release builds. Add it to .env and configure EAS env vars, then rebuild.'
        );
      })();

export const ENDPOINTS = {
  ARTISTS: `${API_URL}/api/artists`,
  SEARCH: `${API_URL}/api/search`,
  ARTIST: (name: string) => `${API_URL}/api/artist/${encodeURIComponent(name)}`,
  AUTH: {
    LOGIN: `${API_URL}/api/auth/login`,
    SIGNUP: `${API_URL}/api/auth/signup`,
    ME: `${API_URL}/api/auth/me`,
    AVATAR: `${API_URL}/api/auth/avatar`,
  },
  PORTFOLIO: `${API_URL}/api/portfolio`,
  TRADES: {
    MY_POSITIONS: (spotifyId: string) => `${API_URL}/api/trades/my-positions?spotify_id=${encodeURIComponent(spotifyId)}`,
    ALL_POSITIONS: `${API_URL}/api/trades/my-positions`,
    CLOSE: `${API_URL}/api/trades/close`,
    HISTORY: `${API_URL}/api/trades/history`,
  },
  ORDERS: {
    PLACE: `${API_URL}/api/orders/place`,
    OPEN: `${API_URL}/api/orders/open`,
  },
  POSITIONS: {
    FOR_ARTIST: (name: string) => `${API_URL}/api/trades/my-positions?artist_name=${encodeURIComponent(name)}`,
  },
  FEED: {
    LIST: (limit: number, offset: number) => `${API_URL}/api/feed?limit=${limit}&offset=${offset}`,
    CREATE: `${API_URL}/api/feed`,
    DELETE: (id: string) => `${API_URL}/api/feed/${id}`,
    LIKE: (id: string) => `${API_URL}/api/feed/${id}/like`,
  },
  FEED_COMMENTS: {
    LIST: (postId: string) => `${API_URL}/api/feed-comments?post_id=${postId}&limit=100`,
    CREATE: `${API_URL}/api/feed-comments`,
    DELETE: (id: string) => `${API_URL}/api/feed-comments/${id}`,
    LIKE: (id: string) => `${API_URL}/api/feed-comments/${id}/like`,
  },
  USERS: (username: string) => `${API_URL}/api/users/${encodeURIComponent(username)}`,
  COMMENTS: {
    LIST: (spotifyId: string, limit = 50, offset = 0) =>
      `${API_URL}/api/comments?spotify_id=${encodeURIComponent(spotifyId)}&limit=${limit}&offset=${offset}`,
    CREATE: `${API_URL}/api/comments`,
    DELETE: (id: string) => `${API_URL}/api/comments/${id}`,
    LIKE: (id: string) => `${API_URL}/api/comments/${id}/like`,
  },
};
