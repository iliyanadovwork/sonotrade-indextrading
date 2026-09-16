import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { ProfileView, type ProfileData, type Position, type ClosedPosition } from '@/components/profile/ProfileView'

export const dynamic = 'force-dynamic'

// PostgREST puts `in.(...)` in the URL, so an unbounded id list eventually
// exceeds the request-line limit and 414s.
const IN_CHUNK_SIZE = 100
const MAX_POSITIONS = 200

interface UserRow {
  id: string
  username: string
  avatar_url: string | null
  created_at: string | null
  total_volume: string | number | null
}

interface PositionRow {
  id: string
  spotify_id: string
  artist_name: string | null
  position_type: string
  contracts: string | number
  entry_price: string | number
  current_price: string | number | null
  total_cost: string | number
  unrealized_pnl: string | number | null
  opened_at: string
  closed_at: string | null
  status: string
}

// Escape ilike wildcards so a username like "jo_hn" matches literally,
// not as a pattern.
function escapeLike(s: string) {
  return s.replace(/[\\%_]/g, '\\$&')
}

const num = (v: unknown) => (v == null ? 0 : Number(v) || 0)

/**
 * Public trader profile: identity, open positions and closed trades.
 *
 * `users` and `positions` are RLS default-deny to anon, so these reads go
 * through the service-role client — which makes the SELECT lists below the
 * privacy boundary. They deliberately omit `balance`, `email`,
 * `password_hash`, and the verification/reset token columns. P&L and volume
 * are already public via the leaderboard, so those stay.
 */
async function getPublicProfile(username: string): Promise<ProfileData | null> {
  const supabase = createAdminClient()

  const { data: users } = await supabase
    .from('users')
    .select('id, username, avatar_url, created_at, total_volume')
    .ilike('username', escapeLike(username))
    .limit(1)
    .returns<UserRow[]>()

  const user = users?.[0]
  if (!user) return null

  const { data: rows } = await supabase
    .from('positions')
    .select('id, spotify_id, artist_name, position_type, contracts, entry_price, current_price, total_cost, unrealized_pnl, opened_at, closed_at, status')
    .eq('user_id', user.id)
    .order('opened_at', { ascending: false })
    .limit(MAX_POSITIONS)
    .returns<PositionRow[]>()

  const all = rows ?? []
  const open = all.filter(p => p.status === 'open')
  const closed = all.filter(p => p.status === 'closed' || p.status === 'liquidated')

  // Mark open positions to market. Same formula as /api/portfolio, so the two
  // surfaces cannot disagree about the same position.
  const spotifyIds = [...new Set(open.map(p => p.spotify_id))]
  const priceMap: Record<string, number> = {}
  const nameMap: Record<string, string> = {}

  for (let i = 0; i < spotifyIds.length; i += IN_CHUNK_SIZE) {
    const { data: artists } = await supabase
      .from('artists_with_history')
      .select('spotify_id, artist_name, current_index_value')
      .in('spotify_id', spotifyIds.slice(i, i + IN_CHUNK_SIZE))

    for (const a of artists ?? []) {
      nameMap[a.spotify_id] = a.artist_name
      if (a.current_index_value != null) priceMap[a.spotify_id] = num(a.current_index_value)
    }
  }

  const label = (p: PositionRow) => p.artist_name || nameMap[p.spotify_id] || p.spotify_id
  const side = (p: PositionRow): 'long' | 'short' => (p.position_type === 'short' ? 'short' : 'long')

  const positions: Position[] = open.map(p => {
    const entryPrice = num(p.entry_price)
    const contracts = num(p.contracts)
    const currentPrice = priceMap[p.spotify_id] ?? entryPrice
    return {
      id: p.id,
      artist_name: label(p),
      ticker: p.spotify_id,
      position_type: side(p),
      contracts,
      entry_price: entryPrice,
      current_price: currentPrice,
      total_cost: num(p.total_cost),
      market_value: contracts * currentPrice,
      unrealized_pnl: side(p) === 'long'
        ? (currentPrice - entryPrice) * contracts
        : (entryPrice - currentPrice) * contracts,
      opened_at: p.opened_at,
    }
  })

  const trades: ClosedPosition[] = closed.map(p => ({
    id: p.id,
    artist_name: label(p),
    ticker: p.spotify_id,
    position_type: side(p),
    contracts: num(p.contracts),
    entry_price: num(p.entry_price),
    // close_position_tx writes the realized close price into current_price.
    // Fall back to entry so a legacy row reads as flat rather than as a 100% loss.
    current_price: p.current_price != null ? num(p.current_price) : num(p.entry_price),
    total_cost: num(p.total_cost),
    unrealized_pnl: num(p.unrealized_pnl),
    opened_at: p.opened_at,
    closed_at: p.closed_at ?? p.opened_at,
    status: p.status === 'liquidated' ? 'liquidated' : 'closed',
  }))

  return {
    userId: user.id,
    username: user.username,
    avatar_url: user.avatar_url,
    created_at: user.created_at ?? new Date(0).toISOString(),
    total_volume: num(user.total_volume),
    total_unrealized_pnl: positions.reduce((s, p) => s + p.unrealized_pnl, 0),
    realized_pnl: trades.reduce((s, t) => s + t.unrealized_pnl, 0),
    positions,
    trades,
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ username: string }> },
): Promise<Metadata> {
  const { username } = await params
  const name = decodeURIComponent(username)
  return {
    title: `@${name} | Sonotrade`,
    description: `Positions and trade history for @${name} on Sonotrade.`,
  }
}

export default async function PublicProfilePage(
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params
  const data = await getPublicProfile(decodeURIComponent(username))
  if (!data) notFound()

  return <ProfileView data={data} isOwn={false} />
}
