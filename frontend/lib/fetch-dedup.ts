"use client";

/**
 * In-flight request deduplicator.
 *
 * Two callers asking for the same URL within the same microtask share a
 * single network round-trip. Industry-standard pattern (SWR, React Query
 * do the same). Most acute fix in this codebase is React StrictMode in
 * dev — every `useEffect` mounts → cleans up → mounts again, which
 * doubles every fetch issued from an effect body. Without dedup you see
 * two `/api/...` hits per page load; with dedup, one.
 *
 * Cache key: `METHOD:URL:body`. Body is stringified — for identical
 * payloads from concurrent mounts (the common case), the key collides
 * and the existing in-flight Promise is returned. Entry is cleared via
 * setTimeout(…, 0) AFTER resolution so a normal mount-then-later-mount
 * flow gets a fresh request, while a synchronous mount→unmount→mount
 * (StrictMode replay) reuses the pending Promise.
 *
 * The shared promise resolves to PARSED JSON, not a Response, because
 * Response.body can only be consumed once and we'd otherwise need
 * .clone() per consumer with no real benefit.
 */

const inFlight = new Map<string, Promise<unknown>>();

function bodyKey(body: BodyInit | null | undefined): string {
  if (body == null) return "";
  if (typeof body === "string") return body;
  // Other BodyInit shapes (Blob/FormData/etc) aren't dedupe-friendly —
  // their identity changes per call. Salt with a unique-per-call token
  // so they never collide accidentally.
  return `__nodedupe_${Math.random().toString(36).slice(2)}`;
}

export async function fetchJsonDeduped<T>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const method = init?.method ?? "GET";
  const key = `${method}:${url}:${bodyKey(init?.body)}`;
  const existing = inFlight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const p = (async () => {
    const res = await fetch(url, init);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  })();

  inFlight.set(key, p);
  // Drop the entry once the underlying request settles (success or
  // failure). setTimeout(…, 0) keeps the entry alive across the
  // synchronous StrictMode mount→cleanup→mount cycle but clears it
  // before any subsequent macrotask, so future calls get fresh data.
  p.finally(() => {
    setTimeout(() => {
      // Only delete if the entry is still ours (not replaced by a
      // newer in-flight Promise for the same key).
      if (inFlight.get(key) === p) inFlight.delete(key);
    }, 0);
  }).catch(() => {
    // Swallow here — callers handle their own errors.
  });
  return p;
}
