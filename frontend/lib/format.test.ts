import { describe, it, expect } from 'vitest'
import { deriveShortName, deriveTicker, fmtVolume, fmtVolumeUSD, fmtChange, fmtIndexPrice } from './format'
import { decodeHtml } from './decodeHtml'

describe('deriveShortName', () => {
  it('shortens multi-word names to initial + rest', () => {
    expect(deriveShortName('Kendrick Lamar')).toBe('K. Lamar')
    expect(deriveShortName('Bruno Mars')).toBe('B. Mars')
  })
  it('keeps single-word names as-is', () => {
    expect(deriveShortName('Drake')).toBe('Drake')
  })
  it('handles three-word names', () => {
    expect(deriveShortName('Rage Against Machine')).toBe('R. Against Machine')
  })
  it('returns single-word names untrimmed (current behavior)', () => {
    // trim() is only applied for word-splitting; the single-word early
    // return hands back the ORIGINAL string, padding included.
    expect(deriveShortName('  Drake  ')).toBe('  Drake  ')
  })
})

describe('deriveTicker', () => {
  it('drops spaces and vowels, uppercased, max 6', () => {
    expect(deriveTicker('Bruno Mars')).toBe('BRNMRS')
    expect(deriveTicker('Drake')).toBe('DRK')
  })
  it('falls back to letters when too few consonants', () => {
    // "Eia" → consonants "" (len<3) → letters base
    expect(deriveTicker('Eia')).toBe('EIA')
  })
  it('handles non-letter-only input', () => {
    expect(deriveTicker('21 Savage')).toBe('SVG')
  })
})

describe('fmtVolume / fmtVolumeUSD', () => {
  it('formats magnitudes with 2 decimals', () => {
    expect(fmtVolume(1_234_567_890)).toBe('1.23B')
    expect(fmtVolume(1_234_567)).toBe('1.23M')
    expect(fmtVolume(456_780)).toBe('456.78K')
    expect(fmtVolume(999.994)).toBe('999.99')
  })
  it('boundary values promote at exactly 1K/1M/1B', () => {
    expect(fmtVolume(1000)).toBe('1.00K')
    expect(fmtVolume(999.99)).toBe('999.99')
  })
  it('null/undefined → dash', () => {
    expect(fmtVolume(null)).toBe('-')
    expect(fmtVolume(undefined)).toBe('-')
  })
  it('USD variant prefixes $', () => {
    expect(fmtVolumeUSD(1_234_567)).toBe('$1.23M')
    expect(fmtVolumeUSD(null)).toBe('-')
  })
})

describe('fmtChange', () => {
  it('positive with explicit sign and space', () => {
    expect(fmtChange(1.234)).toBe('+ 1.23%')
  })
  it('negative shown as "- x%" with abs value', () => {
    expect(fmtChange(-1.234)).toBe('- 1.23%')
  })
  it('zero counts as positive', () => {
    expect(fmtChange(0)).toBe('+ 0.00%')
  })
  it('null → dash', () => {
    expect(fmtChange(null)).toBe('-')
  })
})

describe('decodeHtml', () => {
  it('strips tags and decodes common entities', () => {
    expect(decodeHtml("Plain White T&#39;s")).toBe("Plain White T's")
    expect(decodeHtml('<b>Drake &amp; Future</b>')).toBe('Drake & Future')
    expect(decodeHtml('a &lt;tag&gt; &quot;quoted&quot;')).toBe('a <tag> "quoted"')
  })
  it('decodes hex and decimal codepoints', () => {
    expect(decodeHtml('&#x2019;')).toBe('’')
    expect(decodeHtml('&#8217;')).toBe('’')
  })
  it('null/undefined → empty string', () => {
    expect(decodeHtml(null)).toBe('')
    expect(decodeHtml(undefined)).toBe('')
  })
})

describe('fmtIndexPrice', () => {
  it('keeps two decimals and separators from a cent up', () => {
    expect(fmtIndexPrice(47.963486)).toBe('47.96')
    expect(fmtIndexPrice(1234.5)).toBe('1,234.50')
    expect(fmtIndexPrice(0.01)).toBe('0.01')
    expect(fmtIndexPrice(0)).toBe('0.00')
  })
  it('shows two significant digits below a cent', () => {
    expect(fmtIndexPrice(0.0099)).toBe('0.0099')
    expect(fmtIndexPrice(0.0015)).toBe('0.0015')
    expect(fmtIndexPrice(0.00927)).toBe('0.0093')
    expect(fmtIndexPrice(0.00005)).toBe('0.000050')
  })
  it('caps at six decimals, the feed resolution', () => {
    expect(fmtIndexPrice(0.000001)).toBe('0.000001')
    expect(fmtIndexPrice(0.0000004)).toBe('0.000000')
  })
  it('renders a dash for missing values', () => {
    expect(fmtIndexPrice(null)).toBe('—')
    expect(fmtIndexPrice(Number.NaN)).toBe('—')
  })
})
