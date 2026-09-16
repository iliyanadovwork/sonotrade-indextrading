'use client'

import { CSXText } from '@/components/sx/core/CSXText'

export default function Contact() {
  return (
    <main className="flex flex-1 items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center justify-center text-center gap-4">
        <h1 className="m-0 p-0 text-5xl sm:text-6xl font-light" style={{ color: 'var(--st-white)', fontFamily: 'var(--font-inter)' }}>
          Contact us
        </h1>
        <a 
          href="mailto:support@sonotrade.io"
          className="no-underline hover:underline"
        >
          <CSXText variant="subtitle" color="STWhite">
            support@sonotrade.io
          </CSXText>
        </a>
      </div>
    </main>
  )
}
