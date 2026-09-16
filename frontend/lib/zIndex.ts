/**
 * Central z-index tiers. Nothing enforces these beyond convention — a new
 * overlay should pick a tier from here rather than hardcoding a number.
 *
 * AUTH_MODAL must stay the highest of all of them: it can be triggered as
 * an interrupt from inside any other overlay (e.g. the mobile trade
 * drawer's "Sign up to trade" CTA sets `?auth=signup` while the drawer is
 * still open). It previously hardcoded 1100 — the same tier as ordinary
 * route-driven panels — so it silently rendered underneath the trade
 * drawer (10000) and the artist page's own mobile wrapper (9999), and only
 * became visible once those unmounted on navigation.
 */
export const Z_STICKY_CHROME = 1000        // header, bottom nav, side rail
export const Z_ROUTE_MODAL = 1100          // MobileMorePanel, HowItWorksModal, OnboardingTutorial, SXSearchModal, ConfirmCloseDialog
export const Z_SEARCH_DRAWER = 1200
export const Z_MOBILE_PAGE_OVERLAY = 9999  // full-screen mobile page/panel wrappers (ProfileClient, MobileProfilePanel, MobilePortfolioPanel)
export const Z_MOBILE_SHEET = 10000        // MobileTradeDrawer, BottomSheet
export const Z_MOBILE_SHEET_STACKED = 10002 // sheets/overlays opened from within another sheet
export const Z_MEDIA_OVERLAY = 10100       // GifPicker, OverlayCard, SXSharePositionModal, lightbox

/** Global auth interrupt. Must outrank every tier above. */
export const Z_AUTH_MODAL = 10200
