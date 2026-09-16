'use client'

import * as React from 'react'
import Link from 'next/link'
import { CSXText } from '@/components/sx/core/CSXText'
import { CSXAccordion } from '@/components/sx/core/CSXAccordion'

// FAQ data
const FAQ_ENTRIES: { id: string; question: string; answer: string; category: string }[] = [
  // The Exchange
  {
    id: 'what-is-sonotrade',
    category: 'The Exchange',
    question: 'What is Sonotrade?',
    answer:
      'Sonotrade is the first regulated exchange for music derivatives. It lets you take long or short positions on individual artist indexes, financial instruments whose value is derived from real, live streaming and performance data across platforms like Spotify, Apple Music, and YouTube.\n\nThis is not a prediction market. There are no yes/no outcomes. Prices move continuously based on data, just like a stock exchange.',
  },
  {
    id: 'what-is-artist-index',
    category: 'The Exchange',
    question: 'What is an artist index?',
    answer:
      'An artist index is a composite score that reflects an artist\'s current cultural and commercial momentum. It is calculated from a weighted combination of streaming volume, chart positions, discovery rate, social engagement, and other signals across multiple platforms.\n\nThe index is updated continuously, meaning prices move in real time as the underlying data changes.',
  },
  {
    id: 'how-is-price-determined',
    category: 'The Exchange',
    question: 'How is the price of an artist determined?',
    answer:
      'Prices are driven by two forces: the underlying index value, which is calculated from live streaming and performance data, and market activity, specifically the orders placed by participants on the exchange.\n\nThe mark price reflects current market consensus. The index price reflects the raw data signal. When the two diverge significantly, funding mechanisms bring them back into alignment.',
  },
  {
    id: 'long-short',
    category: 'Trading',
    question: 'What does it mean to go long or short on an artist?',
    answer:
      'Going long means you believe an artist\'s index will rise. Their streams, chart positions, and cultural presence will grow. Going short means you believe their index will fall.\n\nYou profit when the market moves in the direction of your position, and lose when it moves against you. Positions can be closed at any time.',
  },
  {
    id: 'what-moves-price',
    category: 'Trading',
    question: 'What kinds of events move an artist\'s price?',
    answer:
      'Anything that materially affects an artist\'s streaming performance or cultural reach. Album releases, chart entries, tour announcements, award nominations, collaborations, and even controversy can all move the index.\n\nBecause the index is data-driven, the market reacts to what actually happens, not speculation about what might happen.',
  },
  {
    id: 'who-is-it-for',
    category: 'Trading',
    question: 'Who is Sonotrade for?',
    answer:
      'Sonotrade is built for three types of participants.\n\nRetail traders who want direct financial exposure to the music industry. People who follow artists closely and want to act on that knowledge.\n\nRecord labels and industry institutions that carry financial exposure across artist signings, advance structures, and royalty portfolios, and need instruments to hedge that risk.\n\nAny participant who recognises that cultural output carries measurable economic value and wants a structured, transparent way to act on it.',
  },
  {
    id: 'data-sources',
    category: 'Data & Index',
    question: 'Where does the streaming data come from?',
    answer:
      'The index aggregates data from multiple sources including Spotify, Apple Music, YouTube, Shazam, SoundCloud, Deezer, Amazon Music, Pandora, and Genius. Each source is weighted by its signal strength and relevance to the overall index.\n\nData is ingested continuously and the index is recalculated on a rolling basis.',
  },
  {
    id: 'index-manipulation',
    category: 'Data & Index',
    question: 'Can the index be manipulated?',
    answer:
      'The index is designed to be resistant to manipulation. It draws from multiple independent data sources, uses rolling averages to smooth out short-term spikes, and applies anomaly detection to flag unusual activity.\n\nNo single platform or event can move the index significantly on its own. It requires sustained, broad-based changes across multiple signals.',
  },
  {
    id: 'beta',
    category: 'Platform',
    question: 'Is Sonotrade in beta?',
    answer:
      'Yes. As of early 2026, the platform is in beta. Core trading functionality is live, and we are actively expanding the artist roster, refining the index methodology, and building out institutional features.\n\nIf you encounter any issues or have feedback, please reach out via the contact page or drop a message in our Discord.',
  },
  {
    id: 'regulated',
    category: 'Platform',
    question: 'What does "regulated" mean in this context?',
    answer:
      'Sonotrade is building toward full regulatory compliance as a derivatives exchange. This means transparent pricing, auditable data sources, participant protections, and clear rules around position limits and settlement.\n\nWe are committed to operating as a legitimate financial market, not a grey-area platform. More details on our regulatory status will be published as we progress through the licensing process.',
  },
]

const FAQ_CATEGORIES = ['The Exchange', 'Trading', 'Data & Index', 'Platform']

const FAQ_NAV_LINKS = [
  { href: '/contact', label: 'Help' },
  { href: '/', label: 'About' },
  { href: '/contact', label: 'Contact' },
]

export default function FAQPage() {
  return (
    <main className="flex flex-col flex-1 min-h-screen">
      <section className="py-12 sm:py-16 px-6 flex flex-col items-center justify-center gap-4">
        <h1 className="m-0 p-0 text-4xl sm:text-5xl font-light text-center" style={{ color: 'var(--st-white)', fontFamily: 'var(--font-inter)' }}>
          Frequently Asked Questions
        </h1>
        <nav aria-label="FAQ categories" className="flex flex-wrap items-center justify-center gap-2">
          {FAQ_NAV_LINKS.map(({ href, label }, i) => (
            <React.Fragment key={href + label}>
              {i > 0 && (
                <span aria-hidden="true">
                  <CSXText variant="body2" color="STSecondary">
                    |
                  </CSXText>
                </span>
              )}
              <Link href={href} className="no-underline hover:underline">
                <CSXText variant="body2" color="STSecondary">
                  {label}
                </CSXText>
              </Link>
            </React.Fragment>
          ))}
        </nav>
      </section>

      <section className="flex-1 py-8 sm:py-12 px-6">
        <div className="max-w-3xl mx-auto flex flex-col gap-12">
          {FAQ_CATEGORIES.map(category => {
            const entries = FAQ_ENTRIES.filter(e => e.category === category)
            return (
              <div key={category}>
                <div className="mb-6">
                  <CSXText variant="subtitle" color="STWhite">
                    {category}
                  </CSXText>
                </div>
                <div className="flex flex-col">
                  {entries.map((entry) => (
                    <CSXAccordion key={entry.id} title={entry.question}>
                      {entry.answer.split('\n\n').map((paragraph, i) => (
                        <p key={i} className="mb-3 last:mb-0">
                          <CSXText variant="body2" color="STSecondary">
                            {paragraph}
                          </CSXText>
                        </p>
                      ))}
                    </CSXAccordion>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </main>
  )
}
