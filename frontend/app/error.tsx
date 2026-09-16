'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="flex flex-1 w-full flex-col items-center justify-center bg-[rgb(10,10,10)] text-white px-6 py-16">
      <p className="mb-6 text-sm" style={{ color: 'var(--st-secondary)', fontFamily: 'var(--font-geist-sans)' }}>
        Something went wrong
      </p>
      <button
        onClick={reset}
        className="px-5 py-2 text-sm rounded-full border border-zinc-700 text-zinc-400 hover:text-white transition-colors cursor-pointer"
        style={{ fontFamily: 'var(--font-geist-sans)' }}
      >
        Try again
      </button>
    </main>
  )
}
