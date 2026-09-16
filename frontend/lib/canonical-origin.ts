import type { NextRequest } from 'next/server'

/**
 * Resolve the public-facing origin (`https://example.com`) of the
 * current request, robust against the Amplify SSR Lambda quirk where
 * `request.nextUrl.origin` resolves to the internal `http://localhost:3000`
 * instead of the real host.
 *
 * Trust chain:
 *
 *   1. `APP_BASE_URL` env var — explicit override. Set this in environments
 *      where the public origin is fixed and you'd rather not trust headers
 *      (e.g. prod). Never throws even if malformed; falls through.
 *
 *   2. `x-forwarded-host` + `x-forwarded-proto` headers — set by the CDN /
 *      reverse proxy (CloudFront in front of Amplify, Cloudflare, etc.).
 *      These reflect the **browser's** request, bypassing Amplify's
 *      internal-host quirk. This is what makes the function work on
 *      hosted environments without needing the env var to propagate to
 *      the Lambda runtime.
 *
 *   3. `request.nextUrl.origin` — correct in local dev (and any
 *      deployment where the Host header reflects the real host). Last
 *      resort because behind Amplify SSR it can be `localhost:3000`.
 *
 * The returned string never has a trailing slash, so callers can
 * concatenate like `${origin}${pathname}` without producing `//`.
 */
export function canonicalOrigin(request: NextRequest): string {
  // 1. Explicit override.
  const fromEnv = process.env.APP_BASE_URL
  if (fromEnv && /^https?:\/\//.test(fromEnv)) {
    return fromEnv.replace(/\/$/, '')
  }

  // 2. CDN-forwarded host. `x-forwarded-host` may be a comma-separated
  //    list if there are multiple proxies in the chain; the leftmost
  //    entry is the original client-facing host.
  const forwardedHost = request.headers
    .get('x-forwarded-host')
    ?.split(',')[0]
    ?.trim()
  const forwardedProto = request.headers
    .get('x-forwarded-proto')
    ?.split(',')[0]
    ?.trim()
  if (forwardedHost) {
    const proto = forwardedProto || 'https'
    return `${proto}://${forwardedHost}`
  }

  // 3. Last resort: whatever Next.js inferred from the request URL.
  return request.nextUrl.origin.replace(/\/$/, '')
}

/**
 * Public origin for request-less contexts — `app/robots.ts` and
 * `app/sitemap.ts` are Metadata routes and never receive a NextRequest.
 *
 * Prefers SITE_URL, then APP_BASE_URL. Both are in the amplify.yml env
 * allowlist, so they reach the SSR runtime.
 */
export function siteOrigin(): string {
  const raw = process.env.SITE_URL || process.env.APP_BASE_URL || ''
  if (/^https?:\/\//.test(raw)) return raw.replace(/\/$/, '')
  return 'http://localhost:3000'
}

/**
 * Whether this deployment should be crawlable.
 *
 * Gated on the build being production AND having a real public https origin —
 * deliberately NOT on a hardcoded domain. robots.ts used to compare
 * APP_BASE_URL against the retired product's domain, which Sonotrade never
 * sets, so `isProd` was permanently false and every deployment served
 * `Disallow: /` — the entire site was de-indexed.
 */
export function isIndexableDeployment(): boolean {
  if (process.env.NODE_ENV !== 'production') return false
  const origin = siteOrigin()
  return /^https:\/\//.test(origin) && !/localhost|127\.0\.0\.1/.test(origin)
}
