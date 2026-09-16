/** Derive a shortened display name: "Kendrick Lamar" → "K. Lamar" */
export function deriveShortName(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length === 1) return name
  return `${words[0][0]}. ${words.slice(1).join(' ')}`
}

/** Derive a ticker from a full name by dropping spaces + vowels:
 *  "Bruno Mars" → "BRNMRS", "Drake" → "DRK", "Taylor Swift" → "TYLRSW" */
export function deriveTicker(name: string): string {
  const letters = name.trim().replace(/[^a-zA-Z]/g, '')
  if (!letters) return name.trim().slice(0, 4).toUpperCase()
  const consonants = letters.replace(/[aeiou]/gi, '')
  const base = consonants.length >= 3 ? consonants : letters
  return base.slice(0, 6).toUpperCase()
}

export interface FmtVolumeOptions {
  /** Fraction digits for K/M/B-scaled values (default 2). */
  decimals?: number
  /** Fraction digits for values below 1,000 (default: same as `decimals`). */
  smallDecimals?: number
}

/** Compact volume without currency symbol: "1.23M", "456.78K" */
export function fmtVolume(value: number | null | undefined, opts?: FmtVolumeOptions): string {
  if (value == null) return '-'
  const d = opts?.decimals ?? 2
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(d)}B`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(d)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(d)}K`
  return value.toFixed(opts?.smallDecimals ?? d)
}

/** Compact volume with $ prefix: "$1.23M" */
export function fmtVolumeUSD(value: number | null | undefined, opts?: FmtVolumeOptions): string {
  if (value == null) return '-'
  return `$${fmtVolume(value, opts)}`
}

/** Change percentage with explicit sign and space: "+ 1.23%" or "- 1.23%" */
export function fmtChange(value: number | null | undefined): string {
  if (value == null) return '-'
  const sign = value >= 0 ? '+ ' : '- '
  return `${sign}${Math.abs(value).toFixed(2)}%`
}

/** Funding rate as percentage: "+0.0050%" */
export function fmtFunding(value: number | null | undefined): string {
  if (value == null) return '-'
  const percent = value * 100
  const sign = percent >= 0 ? '+' : ''
  return `${sign}${percent.toFixed(4).replace(/\.?0+$/, '')}%`
}

/**
 * Number and date formatting, consolidated.
 *
 * Ten private copies of these lived across app/ and components/, and three had
 * already drifted: the null placeholder was an em dash ('—') in portfolio and
 * MobilePortfolioPanel but a hyphen ('-') in SXProfileHeader and
 * SXFeaturedCards, so the same missing value rendered differently depending on
 * which screen you were looking at. Unified on the em dash, which is what the
 * discover grid and the rest of the app already used.
 *
 * Two date formats survive as separate functions because they are genuinely
 * different things: a trade timestamp wants the time, a join date does not.
 */

/** Fixed-decimal number, null-safe. The default for money and index values. */
export function fmtNumber(
  value: number | null | undefined,
  decimals = 2,
  fallback = '—',
): string {
  if (value == null || Number.isNaN(value)) return fallback
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/** Magnitude only — for P&L rows that render their own sign or arrow. */
export function fmtAbs(value: number | null | undefined, decimals = 2): string {
  if (value == null || Number.isNaN(value)) return '—'
  return Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/** Compact magnitude: 1.2M, 4.5K, 320. For follower and listener counts. */
export function fmtCompact(value: number | null | undefined, fallback = '—'): string {
  if (value == null || Number.isNaN(value)) return fallback
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toLocaleString('en-US')
}

/** "Aug 9, 04:12" — a trade or event timestamp. */
export function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

/** "Aug 9, 2026" — a date with no meaningful time-of-day, e.g. joined-on. */
export function fmtDateOnly(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

/**
 * Index / contract price for display. Two decimals with thousands separators
 * from a cent up (identical to the inline toLocaleString calls it replaces),
 * and enough decimals to show two significant digits below a cent, so a
 * 0.0015 market reads "0.0015" rather than "0.00". Capped at 6 decimals, the
 * feed's own resolution. Sub-cent prices exist because the index floor is an
 * epsilon, not a cent (lib/spotify-listeners.ts MIN_INDEX_VALUE).
 */
export function fmtIndexPrice(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const decimals = indexPriceDecimals(value)
  return value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

/** Decimal places fmtIndexPrice uses for `value`; for animated number formats. */
export function indexPriceDecimals(value: number): number {
  const abs = Math.abs(value)
  if (!Number.isFinite(abs) || abs === 0 || abs >= 0.01) return 2
  return Math.min(6, 1 - Math.floor(Math.log10(abs)))
}
