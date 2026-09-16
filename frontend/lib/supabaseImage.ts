/**
 * Rewrite a Supabase Storage **public object** URL to the on-the-fly image
 * transform endpoint, requesting a resized + re-compressed variant.
 *
 * Why:
 *   Profile photos are stored at 512×512. Rendering them at avatar size
 *   (~36–48px) or featured-card size (~192px) from the raw object URL ships
 *   the full ~70KB original every time. The transform endpoint serves a
 *   width-constrained variant straight from Supabase's CDN (no Next.js
 *   image-optimizer Lambda in the path) and content-negotiates the output
 *   format — modern browsers receive webp/avif via the `Accept` header
 *   automatically. Measured: 73KB → ~13KB at width=96.
 *
 * Endpoint shape:
 *   .../storage/v1/object/public/<bucket>/<path>
 *     →
 *   .../storage/v1/render/image/public/<bucket>/<path>?width=W&height=H&resize=cover&quality=Q
 *
 * Why width AND height (+ resize=cover) — NOT width alone:
 *   Supabase's transform does NOT auto-scale height when only `width` is
 *   given. `?width=96` on a 512×512 source returns a distorted 96×512 strip
 *   (width squished, height untouched). Run through a CSS `object-fit: cover`
 *   avatar that strip shows a thin vertical sliver of the face. Passing both
 *   dimensions with `resize=cover` makes Supabase scale-and-center-crop to a
 *   true W×H box — identical framing to rendering the original under
 *   `object-fit: cover`, just at thumbnail resolution (verified: 512² → 96²
 *   drops 73KB → 3KB).
 *
 * Contract:
 *   - Non-Supabase URLs, empty strings, and null/undefined are returned
 *     unchanged so callers can wrap unconditionally.
 *   - `height` defaults to `width` (a square), which matches the square
 *     profile-photo sources + circular avatars / square card crops. Pass an
 *     explicit height only when the *source* you want cropped is non-square.
 *   - The element's CSS `object-fit: cover` still performs the final shape
 *     crop (circle, banner), exactly as it did against the raw original.
 *
 * Requires the Supabase project to have image transformations enabled
 * (paid plans). Verified working on the prod project 2026-06-10.
 */
export function supabaseImage(
  url: string | null | undefined,
  width: number,
  height: number = width,
  quality = 75,
): string {
  if (!url) return ''
  const marker = '/storage/v1/object/public/'
  const idx = url.indexOf(marker)
  if (idx === -1) return url // not a Supabase public-object URL — leave as-is
  const base = url.slice(0, idx)
  const path = url.slice(idx + marker.length)
  const w = Math.round(width)
  const h = Math.round(height)
  return `${base}/storage/v1/render/image/public/${path}?width=${w}&height=${h}&resize=cover&quality=${quality}`
}
