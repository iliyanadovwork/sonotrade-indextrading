"use client";

import { useSyncExternalStore } from "react";

/**
 * Custom-JWT auth state for the current browser session.
 *
 * Source of truth is the `auth_token` issued by /api/auth/login (and stored in
 * localStorage + an httpOnly cookie). We resolve the current user via
 * GET /api/auth/me (Bearer token) and cache it under localStorage `user`.
 *
 * Returns `{ user, loading }`. `user` is null while loading and when signed
 * out. A `user_metadata` shim is provided so legacy consumers that read
 * `user.user_metadata?.username` keep working alongside the flat fields.
 *
 * Module-level singleton — one in-flight `/api/auth/me` fetch and one set of
 * event listeners shared across every consumer via `useSyncExternalStore`.
 * Re-fetches on `authChange` (login/logout), cross-tab `storage`, and
 * `balanceRefresh` (post-trade) events.
 */

export interface AppUser {
  id: string;
  email: string;
  username: string;
  avatar_url?: string | null;
  balance?: number;
  total_volume?: number;
  total_pnl?: number;
  first_name?: string | null;
  last_name?: string | null;
  is_verified?: boolean;
  created_at?: string;
  last_login?: string;
  /** Compatibility shim for components written against the Supabase user shape. */
  user_metadata: { username?: string; avatar_url?: string | null };
  [key: string]: unknown;
}

type State = { user: AppUser | null; loading: boolean };

const INITIAL: State = { user: null, loading: true };

let state: State = INITIAL;
let initialized = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function setState(next: State) {
  state = next;
  emit();
}

function normalize(raw: Record<string, unknown>): AppUser {
  return {
    ...raw,
    id: String(raw.id ?? ""),
    email: String(raw.email ?? ""),
    username: String(raw.username ?? ""),
    user_metadata: {
      username: (raw.username as string | undefined) ?? undefined,
      avatar_url: (raw.avatar_url as string | null | undefined) ?? null,
    },
  } as AppUser;
}

async function load() {
  if (typeof window === "undefined") return;
  const token = localStorage.getItem("auth_token");

  // No local token = signed out, PERIOD. Every client API call authenticates
  // with this token, so the header must not claim a session the rest of the
  // app can't use. Without this guard, a leftover httpOnly cookie (old
  // session, failed logout) let /api/auth/me answer 200 via cookie auth — the
  // header showed the logged-in state while /portfolio (which requires the
  // token) bounced straight back home. Kill the orphan cookie so the server
  // agrees with the client.
  if (!token) {
    localStorage.removeItem("user");
    setState({ user: null, loading: false });
    void fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    return;
  }

  try {
    const res = await fetch("/api/auth/me", {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data: unknown = await res.json();
      const u =
        data && typeof data === "object" && "user" in data
          ? (data as { user: unknown }).user
          : null;
      if (u && typeof u === "object") {
        localStorage.setItem("user", JSON.stringify(u));
        setState({ user: normalize(u as Record<string, unknown>), loading: false });
        return;
      }
    } else {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("user");
    }
    setState({ user: null, loading: false });
  } catch {
    // Network failure — fall back to the cached user so the UI doesn't flicker
    // to signed-out on a transient blip.
    try {
      const cached = JSON.parse(localStorage.getItem("user") || "null");
      setState({
        user: cached ? normalize(cached as Record<string, unknown>) : null,
        loading: false,
      });
    } catch {
      setState({ user: null, loading: false });
    }
  }
}

/** Force a re-resolve of the current user (e.g. after login). */
export function refreshUser(): void {
  void load();
}

function ensureInitialized() {
  if (initialized) return;
  initialized = true;
  void load();
  if (typeof window !== "undefined") {
    window.addEventListener("storage", (e: StorageEvent) => {
      if (e.key === "auth_token" || e.key === "user") void load();
    });
    window.addEventListener("authChange", () => void load());
    window.addEventListener("balanceRefresh", () => void load());
  }
}

function subscribe(listener: () => void): () => void {
  ensureInitialized();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): State {
  return state;
}

function getServerSnapshot(): State {
  return INITIAL;
}

export function useUser(): State {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function __resetUserSingletonForTests(): void {
  initialized = false;
  state = INITIAL;
  listeners.clear();
}
