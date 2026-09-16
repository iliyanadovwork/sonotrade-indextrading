import { describe, it, expect } from 'vitest'
import { sumLedgerNotional } from './volume'

describe('sumLedgerNotional', () => {
  it('sums quantity × price across rows', () => {
    expect(sumLedgerNotional([{ quantity: 2, price: 10 }, { quantity: 3, price: 1.5 }])).toBe(24.5)
  })
  it('accepts numeric strings as PostgREST returns them', () => {
    expect(sumLedgerNotional([{ quantity: '4', price: '0.25' }])).toBe(1)
  })
  it('skips rows with unparseable values', () => {
    expect(sumLedgerNotional([
      { quantity: null, price: 5 },
      { quantity: 1, price: 'abc' },
      { quantity: 1, price: 2 },
    ])).toBe(2)
  })
  it('rounds to cents', () => {
    expect(sumLedgerNotional([{ quantity: 3, price: 0.1 }])).toBe(0.3)
  })
  it('returns 0 for no rows', () => {
    expect(sumLedgerNotional([])).toBe(0)
  })
})
