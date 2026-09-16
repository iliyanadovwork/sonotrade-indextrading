// Pure math for the scraper pipeline. No I/O — unit-tested in
// index-math.test.ts. The index continues each artist's frozen value via
// RELATIVE listener changes, so reviving the feed produces no artificial
// discontinuity: only genuine post-revival movement moves the index.

/**
 * Parse Spotify's og:description listener figures: "91.2M", "854.3K",
 * "1,234", "12". Returns null when the string isn't a listeners figure.
 */
export function parseListeners(raw: string): number | null {
  const m = raw.match(/([\d.,]+)\s*([KMB]?)\s*monthly listeners/i)
  if (!m) return null
  const num = parseFloat(m[1].replace(/,/g, ''))
  if (!Number.isFinite(num)) return null
  const mult = m[2].toUpperCase() === 'B' ? 1e9 : m[2].toUpperCase() === 'M' ? 1e6 : m[2].toUpperCase() === 'K' ? 1e3 : 1
  return Math.round(num * mult)
}

export interface IndexStep {
  index: number
  /** Listener pct change actually applied (post-clamp), as a fraction. */
  applied: number
  clamped: boolean
}

/** Lowest index we ever write. Keep in sync with the poller and the DB clamp trigger. */
export const MIN_INDEX_VALUE = 0.000001

/**
 * One daily index step.
 * - No previous listeners (first observation / legacy row): index unchanged —
 *   today becomes the baseline; movement starts tomorrow.
 * - Change is clamped to ±maxDailyMove to keep one bad parse from destroying
 *   an artist's price history.
 * - Floor at 0.000001 (one millionth, the 6-dp resolution) so an index can
 *   crash but never hit 0 (division safety). This is an epsilon, not a pricing
 *   floor: the old 0.01 froze every long-tail artist at a fake price.
 */
export function nextIndex(
  prevIndex: number,
  prevListeners: number | null,
  newListeners: number,
  sensitivity: number,
  maxDailyMove: number,
): IndexStep {
  if (!prevListeners || prevListeners <= 0 || newListeners <= 0) {
    return { index: prevIndex, applied: 0, clamped: false }
  }
  const rawPct = (newListeners - prevListeners) / prevListeners
  const clamped = Math.abs(rawPct) > maxDailyMove
  const pct = clamped ? Math.sign(rawPct) * maxDailyMove : rawPct
  const idx = Math.max(MIN_INDEX_VALUE, prevIndex * (1 + sensitivity * pct))
  return { index: round6(idx), applied: pct, clamped }
}

/** EMA of the index (continuity with the legacy artist_daily_streams.ema). */
export function nextEma(prevEma: number | null, index: number, alpha = 0.2): number {
  if (prevEma == null || !Number.isFinite(prevEma)) return round6(index)
  return round6(alpha * index + (1 - alpha) * prevEma)
}

export function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6
}
