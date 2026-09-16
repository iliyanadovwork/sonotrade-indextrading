import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex flex-1 w-full flex-col items-center justify-center bg-[rgb(10,10,10)] text-white px-6 py-16">
      <p
        className="mb-2 text-[2.5rem] font-semibold leading-none"
        style={{ fontFamily: 'var(--font-inter)' }}
      >
        404
      </p>
      <p
        className="mb-6 text-sm"
        style={{ color: 'var(--st-secondary)', fontFamily: 'var(--font-inter)' }}
      >
        Page not found
      </p>
      <Link
        href="/"
        className="px-5 py-2 text-sm rounded-full border border-zinc-700 text-zinc-400 hover:text-white transition-colors"
        style={{ fontFamily: 'var(--font-inter)' }}
      >
        Go home
      </Link>
    </main>
  )
}
