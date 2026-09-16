'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { CSXText } from './core/CSXText'

// Column-layout pages whose bordered content column should butt up against
// the footer — no desktop top margin there.
const NO_TOP_MARGIN_ROUTES = ['/feed', '/leaderboard', '/profile']

export function SXFooter() {
  const currentYear = new Date().getFullYear()
  const pathname = usePathname()
  const topMargin = NO_TOP_MARGIN_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(`${r}/`),
  )
    ? ''
    : ' md:mt-16'

  return (
    <footer className={`w-full relative${topMargin}`} style={{ backgroundColor: '#131313', zIndex: 2 }}>
      <div className="w-full max-w-[92.5rem] mx-auto px-4 md:px-0 pt-12 pb-28 md:py-20">
        {/* Main footer content */}
        <div className="flex flex-col lg:flex-row gap-10 lg:gap-96 mb-8">
          {/* Brand section */}
          <div className="flex flex-col gap-6 lg:max-w-xs">
            <Link href="/" className="flex items-center gap-0 no-underline xl:-translate-x-[0.4375rem]">
              <Image
                src="/sonotrade_glyph_square_transparent.png"
                alt="Sonotrade"
                width={28.8}
                height={28.8}
                className="block h-8 w-auto"
                style={{ height: '2rem' }}
              />
              <div className="flex items-center gap-2">
                <CSXText variant="wordmark" color="STWhite">
                  Sonotrade
                </CSXText>
              </div>
            </Link>
            <CSXText variant="subtitle2" color="STSecondary">
              The future of entertainment
            </CSXText>
            
            {/* Social links */}
            <div className="flex items-center gap-3 mt-2">
              <a
                href="https://instagram.com/sonotradehq"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-opacity hover:opacity-70"
                style={{ color: 'var(--st-secondary)' }}
                aria-label="Instagram"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" width="20" height="20">
                  <path d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2Zm0 1.5A4.25 4.25 0 0 0 3.5 7.75v8.5A4.25 4.25 0 0 0 7.75 20.5h8.5A4.25 4.25 0 0 0 20.5 16.25v-8.5A4.25 4.25 0 0 0 16.25 3.5h-8.5ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 1.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm5.25-.88a.88.88 0 1 1 0 1.76.88.88 0 0 1 0-1.76Z" />
                </svg>
              </a>
              <a
                href="https://x.com/SonotradeHQ"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-opacity hover:opacity-70"
                style={{ color: 'var(--st-secondary)' }}
                aria-label="X (Twitter)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1227" fill="currentColor" width="20" height="20">
                  <path d="M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866L515.491 750.218L842.672 1226.37H1200L714.137 519.284H714.163ZM569.165 687.828L521.697 619.934L144.011 87.6944H306.615L611.412 515.685L658.88 583.579L1055.08 1143.69H892.476L569.165 687.854V687.828Z" />
                </svg>
              </a>
              <a
                href="https://discord.com/invite/sonotrade"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-opacity hover:opacity-70"
                style={{ color: 'var(--st-secondary)' }}
                aria-label="Discord"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -28.5 256 256" fill="currentColor" width="20" height="20">
                  <path fillRule="nonzero" d="M216.856339,16.5966031 C200.285002,8.84328665 182.566144,3.2084988 164.041564,0 C161.766523,4.11318106 159.108624,9.64549908 157.276099,14.0464379 C137.583995,11.0849896 118.072967,11.0849896 98.7430163,14.0464379 C96.9108417,9.64549908 94.1925838,4.11318106 91.8971895,0 C73.3526068,3.2084988 55.6133949,8.86399117 39.0420583,16.6376612 C5.61752293,67.146514 -3.4433191,116.400813 1.08711069,164.955721 C23.2560196,181.510915 44.7403634,191.567697 65.8621325,198.148576 C71.0772151,190.971126 75.7283628,183.341335 79.7352139,175.300261 C72.104019,172.400575 64.7949724,168.822202 57.8887866,164.667963 C59.7209612,163.310589 61.5131304,161.891452 63.2445898,160.431257 C105.36741,180.133187 151.134928,180.133187 192.754523,160.431257 C194.506336,161.891452 196.298154,163.310589 198.110326,164.667963 C191.183787,168.842556 183.854737,172.420929 176.223542,175.320965 C180.230393,183.341335 184.861538,190.991831 190.096624,198.16893 C211.238746,191.588051 232.743023,181.531619 254.911949,164.955721 C260.227747,108.668201 245.831087,59.8662432 216.856339,16.5966031 Z M85.4738752,135.09489 C72.8290281,135.09489 62.4592217,123.290155 62.4592217,108.914901 C62.4592217,94.5396472 72.607595,82.7145587 85.4738752,82.7145587 C98.3405064,82.7145587 108.709962,94.5189427 108.488529,108.914901 C108.508531,123.290155 98.3405064,135.09489 85.4738752,135.09489 Z M170.525237,135.09489 C157.88039,135.09489 147.510584,123.290155 147.510584,108.914901 C147.510584,94.5396472 157.658606,82.7145587 170.525237,82.7145587 C183.391518,82.7145587 193.761324,94.5189427 193.539891,108.914901 C193.539891,123.290155 183.391518,135.09489 170.525237,135.09489 Z" />
                </svg>
              </a>
              <a
                href="https://www.linkedin.com/company/105421065"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-opacity hover:opacity-70"
                style={{ color: 'var(--st-secondary)' }}
                aria-label="LinkedIn"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" width="20" height="20">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-9h3v9zm-1.5-10.271c-.966 0-1.75-.784-1.75-1.75s.784-1.75 1.75-1.75 1.75.784 1.75 1.75-.784 1.75-1.75 1.75zm13.5 10.271h-3v-4.5c0-1.121-.879-2-2-2s-2 .879-2 2v4.5h-3v-9h3v1.189c.819-1.064 2.319-1.189 3.5-1.189 2.209 0 4 1.791 4 4v5z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Links sections */}
          <div className="flex flex-1 flex-wrap gap-12 lg:gap-96">
            {/* Menu */}
            <div className="flex flex-col gap-4">
              <CSXText variant="subtitle" color="STWhite">
                Menu
              </CSXText>
              <ul className="flex flex-col gap-3 list-none m-0 p-0">
                <li>
                  <Link href="/" className="font-sans m-0 indent-0 p-0 text-[0.8125rem] font-normal leading-normal tracking-[-0.025em] no-underline transition-colors hover:text-white" style={{ color: 'var(--st-secondary)' }}>
                    Home
                  </Link>
                </li>
                <li>
                  <Link href="/" className="font-sans m-0 indent-0 p-0 text-[0.8125rem] font-normal leading-normal tracking-[-0.025em] no-underline transition-colors hover:text-white" style={{ color: 'var(--st-secondary)' }}>
                    About
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="font-sans m-0 indent-0 p-0 text-[0.8125rem] font-normal leading-normal tracking-[-0.025em] no-underline transition-colors hover:text-white" style={{ color: 'var(--st-secondary)' }}>
                    Contact
                  </Link>
                </li>
                <li>
                  <Link href="/how-it-works#data-research" className="font-sans m-0 indent-0 p-0 text-[0.8125rem] font-normal leading-normal tracking-[-0.025em] no-underline transition-colors hover:text-white" style={{ color: 'var(--st-secondary)' }}>
                    Data &amp; Research
                  </Link>
                </li>
              </ul>
            </div>

            {/* Other */}
            <div className="flex flex-col gap-4">
              <CSXText variant="subtitle" color="STWhite">
                Other
              </CSXText>
              <ul className="flex flex-col gap-3 list-none m-0 p-0">
                <li>
                  <Link href="/faq" className="font-sans m-0 indent-0 p-0 text-[0.8125rem] font-normal leading-normal tracking-[-0.025em] no-underline transition-colors hover:text-white" style={{ color: 'var(--st-secondary)' }}>
                    FAQ
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="font-sans m-0 indent-0 p-0 text-[0.8125rem] font-normal leading-normal tracking-[-0.025em] no-underline transition-colors hover:text-white" style={{ color: 'var(--st-secondary)' }}>
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="font-sans m-0 indent-0 p-0 text-[0.8125rem] font-normal leading-normal tracking-[-0.025em] no-underline transition-colors hover:text-white" style={{ color: 'var(--st-secondary)' }}>
                    Terms
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Legal disclaimer */}
        <div className="pt-8 pb-6 border-t" style={{ borderColor: 'var(--st-border)' }}>
          <p className="m-0 leading-relaxed" style={{ fontSize: '0.72rem', color: 'var(--st-muted)', fontFamily: 'var(--font-geist-sans)', maxWidth: '100%' }}>
            <strong style={{ color: 'var(--st-secondary)', fontWeight: 500 }}>Simulated trading only.</strong> All trading activity on this platform uses simulated funds. No real money is at risk. When Sonotrade launches live trading, it will operate as a CFTC-registered derivatives platform subject to applicable regulatory requirements under the Commodity Exchange Act.
          </p>
          <p className="m-0 mt-3 leading-relaxed" style={{ fontSize: '0.72rem', color: 'var(--st-muted)', fontFamily: 'var(--font-geist-sans)', maxWidth: '100%' }}>
            Derivative products involve a significant risk of loss and are not suitable for all participants. You may lose more than your initial deposit. Past performance is not indicative of future results. Information provided on this website is for informational purposes only and does not constitute an offer to sell, a solicitation to buy, or a recommendation for any derivative contract or investment product. Sonotrade does not provide investment, legal, or tax advice.
          </p>
        </div>

        {/* Bottom bar */}
        <div className="pt-6 border-t" style={{ borderColor: 'var(--st-border)' }}>
          <CSXText variant="body2" color="STSecondary">
            © {currentYear} Sonotrade
          </CSXText>
        </div>
      </div>
    </footer>
  )
}
