import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { headers } from 'next/headers'
import { Suspense } from 'react'
import "./globals.css";
import { AppHeader } from '@/components/layout/AppHeader'
import { GlobalSideRail } from '@/components/layout/GlobalSideRail'
import { SXFooter } from '@/components/sx/SXFooter'
import { ScrollToTop } from '@/components/sx/ScrollToTop'
import { AuthProvider } from '@/components/auth/AuthProvider'
import AuthModal from '@/components/auth/AuthModal'
import HowItWorksModal from '@/components/sx/HowItWorksModal'
import OnboardingTutorial from '@/components/onboarding/OnboardingTutorial'
import { MobileSearchShell } from '@/components/mobile/MobileSearchShell'
import { MobilePanels } from '@/components/mobile/MobilePanels'
import { ProfilePanelProvider } from '@/context/ProfilePanelContext'
import { PortfolioPanelProvider } from '@/context/PortfolioPanelContext'
import { SearchDrawerProvider } from '@/context/SearchDrawerContext'
import { MobileProvider } from '@/context/MobileContext'
import { PostHogProvider } from './providers'

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Sonotrade",
  description: "Trade real-time artist indexes",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

function isMobileUA(ua: string): boolean {
  return /android|iphone|ipod|mobile/i.test(ua) && !/ipad/i.test(ua)
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers()
  const ua = headersList.get('user-agent') ?? ''
  const isMobile = isMobileUA(ua)

  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="rgb(10,10,10)" />
        {/* Preconnect to Supabase Storage — every profile photo (hero,
            featured cards, sidebar avatars) is served from this origin.
            Establishing the TLS connection early shaves ~80–300ms off the
            first image request (PSI "Network dependency tree"). */}
        <link rel="preconnect" href="https://iawngxubkakulvrqvxal.supabase.co" crossOrigin="anonymous" />
        <link rel="preload" href="/sonotrade_glyph_square_transparent.png" as="image" />
        {/* NOTE: the /images/monogram.png preload (886 KB!) was removed
            2026-06-10 — SXMonogramBg (its only consumer) is no longer
            rendered anywhere, so the preload downloaded ~886 KB of dead
            weight on every page load and starved the real LCP image of
            bandwidth on mobile. If SXMonogramBg is ever re-introduced,
            re-export the asset as a sized webp first (it was 1080×1350). */}
      </head>
      <body
        className={`bg-[rgb(10,10,10)] font-sans ${inter.variable} ${jetbrainsMono.variable} antialiased flex flex-col min-h-screen`}
        suppressHydrationWarning
      >
        <PostHogProvider>
        <MobileProvider initialMobile={isMobile}>
        <SearchDrawerProvider>
        <ProfilePanelProvider>
        <PortfolioPanelProvider>
        <AuthProvider>
          <ScrollToTop />
{/* App shell: the side rail is an in-flow column, so page content is
              laid out in the space *beside* it and can never slide underneath.
              `min-w-0` on the content column is load-bearing — without it a wide
              child (data tables, card grids) sets the flex item's min-content
              width and pushes the column out from under the rail again. */}
          <div className="flex flex-1">
            <GlobalSideRail />
            <div className="flex min-w-0 flex-1 flex-col">
              <AppHeader />
              {/* Page body shares --st-page-gutter-x with the desktop header so
                  home columns, discover, profiles, etc. clear the rail / window
                  the same way Log In / Sign Up do. md+ only: below that, mobile
                  layouts keep their own px-3 and the rail is hidden. */}
              <div className="flex min-w-0 flex-1 flex-col st-page-x">
                <Suspense>
                  {children}
                </Suspense>
                <SXFooter />
              </div>
            </div>
          </div>
          {/* Overlays stay outside the shell so they cover the full viewport,
              rail included. */}
          <Suspense>
            <AuthModal />
            <HowItWorksModal />
            <OnboardingTutorial />
            <MobileSearchShell />
            <MobilePanels />
          </Suspense>
        </AuthProvider>
        </PortfolioPanelProvider>
        </ProfilePanelProvider>
        </SearchDrawerProvider>
        </MobileProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
