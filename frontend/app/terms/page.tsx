'use client'

import Link from 'next/link'
import { CSXText } from '@/components/sx/core/CSXText'

export default function TermsPage() {
  return (
    <main className="flex flex-col flex-1 min-h-screen">
      <section className="py-12 sm:py-16 px-6 flex flex-col items-center justify-center">
        <h1 className="m-0 p-0 text-4xl sm:text-5xl font-light text-center" style={{ color: 'var(--st-white)', fontFamily: 'var(--font-inter)' }}>
          Terms &amp; Conditions
        </h1>
      </section>

      <section className="flex-1 py-8 sm:py-12 px-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <p className="m-0 mb-6">
            <CSXText variant="body2" color="STSecondary">
              Last updated: February 2026. Please read these Terms and Conditions (&quot;Terms&quot;) carefully before using the Sonotrade platform. By accessing or using our service, you agree to be bound by these Terms.
            </CSXText>
          </p>

          <div>
            <h2 className="mb-3 m-0 p-0">
              <CSXText variant="subtitle" color="STWhite">
                Account and conduct
              </CSXText>
            </h2>
            <CSXText variant="body2" color="STSecondary">
              You must provide accurate information when registering and keep your account secure. You are responsible for all activity under your account. You agree not to use the platform for any illegal purpose, to manipulate markets, to harass others, or to violate any applicable rules or policies we publish.
            </CSXText>
          </div>

          <div>
            <h2 className="mb-3 m-0 p-0">
              <CSXText variant="subtitle" color="STWhite">
                Trading and funds
              </CSXText>
            </h2>
            <CSXText variant="body2" color="STSecondary">
              Trading on prediction markets involves risk. You may lose the funds you use to trade. We do not provide financial, legal, or tax advice. Resolution of markets and payouts are subject to our rules and the specific market terms. Withdrawals and processing may be subject to verification and applicable limits.
            </CSXText>
          </div>

          <div>
            <h2 className="mb-3 m-0 p-0">
              <CSXText variant="subtitle" color="STWhite">
                Intellectual property
              </CSXText>
            </h2>
            <CSXText variant="body2" color="STSecondary">
              The Sonotrade platform, including its design, branding, and content (other than user-generated content), is owned by us or our licensors. You may not copy, modify, or exploit our intellectual property without permission.
            </CSXText>
          </div>

          <div>
            <h2 className="mb-3 m-0 p-0">
              <CSXText variant="subtitle" color="STWhite">
                Disclaimer and limitation of liability
              </CSXText>
            </h2>
            <CSXText variant="body2" color="STSecondary">
              The service is provided &quot;as is&quot;. We disclaim warranties to the fullest extent permitted by law. We are not liable for any indirect, incidental, special, or consequential damages, or for loss of profits or data, arising from your use of the platform. Our total liability is limited to the amount you have paid us in the twelve months preceding the claim, or as otherwise required by law.
            </CSXText>
          </div>

          <div>
            <h2 className="mb-3 m-0 p-0">
              <CSXText variant="subtitle" color="STWhite">
                Changes and termination
              </CSXText>
            </h2>
            <CSXText variant="body2" color="STSecondary">
              We may change these Terms or the platform at any time. We will notify you of material changes (e.g. by email or a notice on the platform). Continued use after changes constitutes acceptance. We may suspend or terminate your account or access to the service for breach of these Terms or for any other reason at our discretion.
            </CSXText>
          </div>

          <div>
            <h2 className="mb-3 m-0 p-0">
              <CSXText variant="subtitle" color="STWhite">
                Disclaimers
              </CSXText>
            </h2>
            <p className="m-0 mb-3">
              <CSXText variant="body2Medium" color="STWhite">
                Sonotrade Radio.
              </CSXText>
              <CSXText variant="body2" color="STSecondary">
                {' '}Sonotrade Radio is fully streamed via SoundCloud. None of the songs or music played on Sonotrade Radio are owned by Sonotrade or us. We do not own the rights to the songs being played and are simply streaming them as any user could themselves via digital service providers (DSPs). We have no intent to redistribute content illegally. If you are a rights holder and wish to have content removed, please{' '}
              </CSXText>
              <Link href="/contact" className="no-underline hover:underline">
                <CSXText variant="body2" color="STSecondary">
                  contact us
                </CSXText>
              </Link>
              <CSXText variant="body2" color="STSecondary">
                {' '}and we will take it down upon request.
              </CSXText>
            </p>
          </div>

          <div>
            <h2 className="mb-3 m-0 p-0">
              <CSXText variant="subtitle" color="STWhite">
                Contact
              </CSXText>
            </h2>
            <p className="m-0">
              <CSXText variant="body2" color="STSecondary">
                For questions about these Terms, please contact us via the details on our{' '}
              </CSXText>
              <Link href="/contact" className="no-underline hover:underline">
                <CSXText variant="body2" color="STSecondary">
                  Contact
                </CSXText>
              </Link>
              <CSXText variant="body2" color="STSecondary">
                {' '}page.
              </CSXText>
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
