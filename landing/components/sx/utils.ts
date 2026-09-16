export function formatNumber(num: number | null): string {
  if (num === null || num === undefined) return '-'
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toLocaleString()
}

export function formatPercent(value: number): string {
  if (value === null || value === undefined) return '-'
  const percent = (value * 100).toFixed(2)
  const sign = value >= 0 ? '+' : ''
  return `${sign}${percent}%`
}

export function formatRankChange(delta: number | null): string {
  if (delta === null || delta === undefined) return '-'
  const sign = delta > 0 ? '+' : ''
  return `${sign}${delta}`
}
