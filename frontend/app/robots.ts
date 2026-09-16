import type { MetadataRoute } from "next";
import { isIndexableDeployment, siteOrigin } from "@/lib/canonical-origin";

/**
 * Served as /robots.txt.
 *
 *   - Production: allow crawl of public marketing/profile pages; deny private
 *     user surfaces (account, portfolio, auth flows) and the API surface
 *     (which has no SEO value and just wastes crawl budget). Point at
 *     the sitemap so Google discovers profile pages efficiently.
 *   - Anything else (preview deploys, local): block everything, to avoid
 *     duplicate-content penalties from staging URLs appearing in search.
 *
 * The production check lives in `isIndexableDeployment()` and is based on
 * NODE_ENV plus a real https origin. It used to compare APP_BASE_URL against
 * a hardcoded domain belonging to the retired product — a value this app never
 * sets — so the check was always false and every deployment, production
 * included, served `Disallow: /`.
 */
export default function robots(): MetadataRoute.Robots {
  if (!isIndexableDeployment()) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  const origin = siteOrigin();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/auth/", "/admin/", "/account/", "/portfolio/"],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
