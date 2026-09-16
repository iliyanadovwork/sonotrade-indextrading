/**
 * Strip HTML tags and decode the common HTML entities that show up in
 * upstream artist bios (e.g. `Plain White T&#39;s` → `Plain White T's`).
 * Single source of truth — used by the profile About section and the
 * home hero widget bio.
 */
export function decodeHtml(str: string | null | undefined): string {
  if (!str) return ''
  let s = str.replace(/<[^>]+>/g, '')
  s = s.replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
  s = s.replace(/&#x([0-9A-Fa-f]+);/g, (_, hex) => {
    try { return String.fromCodePoint(parseInt(hex, 16)) } catch { return '' }
  })
  s = s.replace(/&#(\d+);/g, (_, dec) => {
    try { return String.fromCodePoint(parseInt(dec, 10)) } catch { return '' }
  })
  return s
}
