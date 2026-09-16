'use client'

import { CSXText } from './core/CSXText'
import { fmtVolume } from '@/lib/format'
import { formatPercent } from '@/lib/utils'

interface SXMarketStatsRowProps {
  totalForecastsUsd: number
  volume24hUsd: number
  holders: number
  change1h: number
  change24h: number
  change7d: number
  className?: string
}

function StatCard({
  label,
  value,
  change,
}: {
  label: string
  value: React.ReactNode
  change?: number
}) {
  const positive = change === undefined || change >= 0
  const valueColor = change !== undefined
    ? (positive ? 'var(--st-chart-positive)' : 'var(--st-chart-negative)')
    : undefined
  return (
    <div className="flex flex-col gap-1">
      <CSXText variant="body3" color="STMuted">
        {label}
      </CSXText>
      <CSXText variant="body2Semibold" color="STWhite">
        <span
          style={{
            fontFamily: 'var(--font-inter)',
            ...(valueColor ? { color: valueColor } : {}),
          }}
        >
          {value}
        </span>
      </CSXText>
    </div>
  )
}

/**
 * Six-stat summary row shown below the price chart on the profile page.
 * Mirrors OLD's layout (`/components/ProfileView.tsx` StatCard grid):
 * Total Forecasts · 24h Volume · Holders · 1H · 24H · 7D Change.
 *
 * Values are USD; change percentages already rounded server-side
 * (see `market_stats` RPC). Stats live-update via `useLiveMarketStats`
 * — pass `liveStats.*` directly from the parent.
 */
export function SXMarketStatsRow({
  totalForecastsUsd,
  volume24hUsd,
  holders,
  change1h,
  change24h,
  change7d,
  className = '',
}: SXMarketStatsRowProps) {
  return (
    <div
      className={`grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-6 ${className}`}
    >
      <StatCard
        label="Total Forecasts"
        value={`$${fmtVolume(totalForecastsUsd)}`}
      />
      <StatCard label="24h Volume" value={`$${fmtVolume(volume24hUsd)}`} />
      <StatCard label="Holders" value={holders.toLocaleString('en-US')} />
      <StatCard
        label="1H Change"
        value={formatPercent(change1h)}
        change={change1h}
      />
      <StatCard
        label="24H Change"
        value={formatPercent(change24h)}
        change={change24h}
      />
      <StatCard
        label="7D Change"
        value={formatPercent(change7d)}
        change={change7d}
      />
    </div>
  )
}
