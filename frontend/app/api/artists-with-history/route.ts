// Alias for the Expo app. Its FeaturedCarousel (frontend-expo/components/
// FeaturedCarousel.tsx) calls /api/artists-with-history; the web app implements
// the identical contract at /api/artists. One handler, two names.
//
// This file was deleted on 2026-08-09 as "zero consumers" and restored the same
// day: that search covered frontend/app, frontend/components and frontend/lib
// only, and missed the sibling frontend-expo package entirely. The Expo client
// resolves its base URL from EXPO_PUBLIC_API_URL at build time, so whether it
// currently points here cannot be determined from this repo — which is exactly
// why the alias should stay until that client is confirmed dead.
//
// NOTE: segment config must be declared locally — re-exporting `dynamic` from
// another module defeats Next's static analysis and 500s the route.
export const dynamic = 'force-dynamic'
export { GET } from '../artists/route'
