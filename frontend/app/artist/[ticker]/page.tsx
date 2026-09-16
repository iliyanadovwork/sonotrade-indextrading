import { notFound } from 'next/navigation'
import { getProfileByTicker, getMarketStats } from '@/lib/data'
import { ProfileClient } from './_components/ProfileClient'

export const dynamic = 'force-dynamic'

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ ticker: string }>
}) {
  const { ticker } = await params
  // Both queries key on spotify_id === ticker (Profile.id IS the ticker in
  // sonotrade), so they run in parallel — previously stats waited for the
  // profile round trip, doubling SSR latency on every artist page.
  const [profile, initialStats] = await Promise.all([
    getProfileByTicker(ticker),
    getMarketStats(ticker),
  ])
  if (!profile) notFound()
  return (
    <ProfileClient
      initialProfile={profile}
      ticker={ticker}
      initialStats={initialStats}
    />
  )
}
