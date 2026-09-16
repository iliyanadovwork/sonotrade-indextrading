'use client'

import Link from 'next/link'
import { CSXText } from '@/components/sx/core/CSXText'

export default function PrivacyPage() {
  return (
    <main className="flex flex-col flex-1 min-h-screen">
      <section className="py-12 sm:py-16 px-6 flex flex-col items-center justify-center">
        <h1 className="m-0 p-0 text-4xl sm:text-5xl font-light text-center" style={{ color: 'var(--st-white)', fontFamily: 'var(--font-inter)' }}>
          Privacy Policy
        </h1>
      </section>

      <section className="flex-1 py-8 sm:py-12 px-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <p className="m-0 mb-6">
            <CSXText variant="body2" color="STSecondary">
              Last updated: February 2026. Sonotrade (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) respects your privacy. This policy describes how we collect, use, and protect your information when you use our platform.
            </CSXText>
          </p>

          <div>
            <h2 className="mb-3 m-0 p-0">
              <CSXText variant="subtitle" color="STWhite">
                Information we collect
              </CSXText>
            </h2>
            <CSXText variant="body2" color="STSecondary">
              We collect information you provide when you register (e.g. email address), information from your use of the service (e.g. trading activity, device and log data), and cookies or similar technologies where applicable.
            </CSXText>
          </div>

          <div>
            <h2 className="mb-3 m-0 p-0">
              <CSXText variant="subtitle" color="STWhite">
                How we use your information
              </CSXText>
            </h2>
            <CSXText variant="body2" color="STSecondary">
              We use your information to operate and improve the platform, process transactions, communicate with you, enforce our terms, and comply with legal obligations. We may use aggregated or anonymised data for analytics and product development.
            </CSXText>
          </div>

          <div>
            <h2 className="mb-3 m-0 p-0">
              <CSXText variant="subtitle" color="STWhite">
                Sharing and disclosure
              </CSXText>
            </h2>
            <CSXText variant="body2" color="STSecondary">
              We do not sell your personal data. We may share information with service providers who assist our operations, with regulators or law enforcement when required by law, or in connection with a merger or sale of assets, subject to applicable law.
            </CSXText>
          </div>

          <div>
            <h2 className="mb-3 m-0 p-0">
              <CSXText variant="subtitle" color="STWhite">
                Security and retention
              </CSXText>
            </h2>
            <CSXText variant="body2" color="STSecondary">
              We implement appropriate technical and organisational measures to protect your data. We retain your information for as long as needed to provide the service and to comply with legal, regulatory, or contractual requirements.
            </CSXText>
          </div>

          <div>
            <h2 className="mb-3 m-0 p-0">
              <CSXText variant="subtitle" color="STWhite">
                Your rights
              </CSXText>
            </h2>
            <p className="m-0">
              <CSXText variant="body2" color="STSecondary">
                Depending on where you live, you may have rights to access, correct, delete, or port your data, or to object to or restrict certain processing. To exercise these rights or ask questions about this policy, please contact us at the details on our{' '}
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

          <div>
            <h2 className="mb-3 m-0 p-0">
              <CSXText variant="subtitle" color="STWhite">
                Changes
              </CSXText>
            </h2>
            <CSXText variant="body2" color="STSecondary">
              We may update this privacy policy from time to time. We will post the updated policy on this page and, where appropriate, notify you by email or through the platform. Your continued use of the service after changes constitutes acceptance of the updated policy.
            </CSXText>
          </div>
        </div>
      </section>
    </main>
  )
}
