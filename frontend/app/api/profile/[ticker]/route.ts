import { NextRequest, NextResponse } from 'next/server'
import { getProfileByTicker } from '@/lib/data'

export const dynamic = 'force-dynamic'

// REWIRED to sonotrade: ticker === spotify_id; reuses lib/data mapper.
export async function GET(request: NextRequest, { params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params
  const slim = request.nextUrl.searchParams.get('slim') === 'true'
  try {
    const profile = await getProfileByTicker(ticker, { slim })
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    return NextResponse.json(
      { profile },
      {
        headers: {
          // Slim payloads are card metadata — they churn slower than price
          // (which arrives via realtime/stats), so they can sit longer at CDN.
          'Cache-Control': slim
            ? 'public, s-maxage=60, stale-while-revalidate=300'
            : 'public, s-maxage=30, stale-while-revalidate=60',
        },
      },
    )
  } catch (err) {
    console.error('Profile API error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
