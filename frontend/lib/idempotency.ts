/**
 * Idempotency keys for the two money endpoints.
 *
 * The server side has been complete since the hardening migration —
 * `place_order_tx` and `close_position_tx` both cache their response against
 * the key and replay it — but no client ever sent one, so replay protection
 * was inert. A request whose response was lost in transit had no way to be
 * safely retried: the trade had already happened, and retrying placed a second.
 *
 * Matches the routes' `^[A-Za-z0-9_-]{8,64}$` validation (a UUID is 36 chars
 * of hex and hyphens).
 */
export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  // Older Safari / non-secure contexts have no randomUUID. Any unique string
  // in the allowed charset works; the server only uses it as a cache key.
  const rand = () => Math.random().toString(36).slice(2, 10)
  return `${Date.now().toString(36)}-${rand()}-${rand()}`
}

/**
 * Mint-once-per-intent holder.
 *
 * The subtlety worth stating: a fresh key on every submit would NOT stop a
 * double-tap, and a key derived from the order's parameters would wrongly
 * dedupe two orders a user genuinely meant to place twice. What actually needs
 * protecting is the retry-after-no-answer case, so:
 *
 *   - the key is minted on the first attempt and reused while attempts fail
 *     with no HTTP response (network error, timeout);
 *   - it is retired the moment the server answers at all — success or error —
 *     because the next submit is then a new intent.
 *
 * Usage:
 *   const idem = useRef(createIdempotencyHolder()).current
 *   ... headers: { 'Idempotency-Key': idem.take() }
 *   ... after any server response: idem.settle()
 */
export function createIdempotencyHolder() {
  let key: string | null = null
  return {
    take(): string {
      if (key === null) key = newIdempotencyKey()
      return key
    },
    settle(): void {
      key = null
    },
  }
}
