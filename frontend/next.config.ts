import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

/** Non-internal IPv4 addresses of this machine, e.g. ['192.168.1.38']. */
function lanAddresses(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((nic): nic is NonNullable<typeof nic> => !!nic && nic.family === 'IPv4' && !nic.internal)
    .map((nic) => nic.address);
}

const nextConfig: NextConfig = {
  devIndicators: false,
  skipTrailingSlashRedirect: true,
  // Dev-only: lets phones/other LAN devices load the dev server via the Mac's
  // LAN IP. Without this, Next 16 serves the HTML but silently refuses the
  // cross-origin dev/RSC asset requests, so React never hydrates — the page
  // renders and scrolls (static SSR HTML) but every tap is dead. Ignored by
  // production builds.
  //
  // Read from the live interfaces rather than hardcoded: DHCP reassigns this
  // machine's LAN IP, and a pinned address silently stops matching (the
  // symptom returns as dead taps on device, with nothing in the logs).
  allowedDevOrigins: lanAddresses(),
  async rewrites() {
    return [
      { source: '/ingest/static/:path*', destination: 'https://us-assets.i.posthog.com/static/:path*' },
      { source: '/ingest/:path*',        destination: 'https://us.i.posthog.com/:path*' },
    ]
  },
  images: {
    // next/image optimized variants (e.g. /_next/image?url=%2Fpauv.png) were
    // served with a 4h TTL. Bump to 1 year so the optimizer's CDN copies
    // persist across visits (PSI "Use efficient cache lifetimes").
    minimumCacheTTL: 31536000,
    remotePatterns: [
      { protocol: "https", hostname: "i.scdn.co", pathname: "/image/**" },
      { protocol: "https", hostname: "*.scdn.co" },
      { protocol: "https", hostname: "media.giphy.com" },
      { protocol: "https", hostname: "media0.giphy.com" },
      { protocol: "https", hostname: "media1.giphy.com" },
      { protocol: "https", hostname: "media2.giphy.com" },
      { protocol: "https", hostname: "media3.giphy.com" },
      { protocol: "https", hostname: "media4.giphy.com" },
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  // Long-lived caching for immutable static assets under /public. These were
  // being served with a 5-second TTL, forcing every repeat visitor to
  // re-download them (PSI flagged ~960 KiB of avoidable re-transfer). The
  // logo/brand assets are stable; rename the file if one ever changes
  // (standard cache-busting). Next.js already sets immutable caching on
  // hashed /_next/static/* bundles, so those are not listed here.
  async headers() {
    return [
      {
        source: "/:all*(svg|jpg|jpeg|png|webp|avif|gif|ico|woff|woff2)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ]
  },
};

export default nextConfig;
