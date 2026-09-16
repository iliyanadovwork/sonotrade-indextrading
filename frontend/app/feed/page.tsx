'use client'

import FeedSection from '@/components/feed/FeedSection'
import { feedColumnWidthStyle } from '@/lib/mainColumnLayout'

export default function FeedPage() {
  return (
    <main className="bg-[rgb(10,10,10)] text-white flex justify-center" style={{ minHeight: '100vh' }}>
      <div className="flex items-start">
        {/* Feed */}
        <div
          className="shrink-0 border-x border-[#262626]"
          style={{ ...feedColumnWidthStyle, minHeight: '100vh' }}
        >
          <FeedSection />
        </div>
      </div>
    </main>
  )
}
