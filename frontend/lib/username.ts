/**
 * Username rules, shared by signup, the username-change endpoint, and the
 * client forms so every surface agrees on what a valid handle is.
 *
 * Format is the industry-standard handle shape: lowercase letters, digits,
 * and underscores, 3-20 chars. Usernames are stored lowercase (normalised at
 * the API boundary) and are unique case-insensitively.
 */
export const USERNAME_RE = /^[a-z0-9_]{3,20}$/

export const USERNAME_RULES =
  'Username must be 3-20 characters, using only lowercase letters, numbers, and underscores'

/** Handles nobody should be able to claim — impersonation and confusion. */
const RESERVED = new Set([
  'admin', 'administrator', 'moderator', 'mod', 'staff', 'support', 'help',
  'official', 'sonotrade', 'sonotrader', 'system', 'root', 'api', 'about',
  'settings', 'profile', 'portfolio', 'leaderboard', 'feed', 'artist',
])

export function isReservedUsername(username: string): boolean {
  return RESERVED.has(username)
}

/**
 * Escape LIKE wildcards for PostgREST `ilike` — `_` is a single-character
 * wildcard and usernames may legitimately contain it.
 */
export function escapeLike(value: string): string {
  return value.replace(/[_%\\]/g, m => `\\${m}`)
}
