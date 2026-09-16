/**
 * Shared GIF-URL extraction for user-authored text.
 *
 * These URLs render as raw <img>, which bypasses the next/image host allowlist
 * in next.config.ts. Without a host check any user could paste a URL they
 * control and make every viewer's browser fetch it — leaking viewer IPs and
 * User-Agents to a third party and giving them per-viewer read receipts.
 *
 * Lived inline in four components; extracted so a future host change happens
 * once rather than in four places that can drift apart.
 */
const GIPHY_HOST = /^(?:media\d*\.giphy\.com|i\.giphy\.com|giphy\.com)$/

export function isGiphyUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return (u.protocol === 'https:' || u.protocol === 'http:') && GIPHY_HOST.test(u.hostname)
  } catch {
    return false
  }
}

/** Every .gif URL in the text that is hosted on Giphy. Others are dropped. */
export function extractGifUrls(text: string): string[] {
  return (text.match(/(https?:\/\/[^\s]+\.gif)/g) || []).filter(isGiphyUrl)
}

/** Strip all .gif URLs (allowlisted or not) so they don't render as text. */
export function removeGifUrls(text: string): string {
  return text.replace(/https?:\/\/[^\s]+\.gif/g, '').trim()
}
