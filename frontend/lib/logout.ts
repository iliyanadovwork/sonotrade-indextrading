/**
 * Sign the user out everywhere the session lives.
 *
 * ORDER MATTERS: the httpOnly cookie must be cleared (await the POST) BEFORE
 * `authChange` fires. The event makes useUser re-fetch /api/auth/me, and that
 * endpoint falls back to cookie auth when there's no Bearer token — so firing
 * the event while the cookie is still set resurrects the "logged in" header
 * state from the very session being ended.
 */
export async function logout(): Promise<void> {
  localStorage.removeItem('auth_token')
  localStorage.removeItem('user')
  try {
    await fetch('/api/auth/logout', { method: 'POST' })
  } catch {
    // Cookie clear failed (offline?) — the local token is gone either way, so
    // the client is signed out; the cookie dies on its own expiry.
  }
  window.dispatchEvent(new Event('authChange'))
}
