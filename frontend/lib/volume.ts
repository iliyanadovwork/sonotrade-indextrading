/**
 * Sum the notional (quantity × price) of a set of `trade_ledger` rows, rounded
 * to cents.
 *
 * Pure so it can be unit-tested without a Supabase client. The server read
 * funnel (`lib/data.ts`) feeds it the last 24h of an artist's fills to produce
 * the "24h Volume" stat. Values may arrive as strings: PostgREST serialises
 * `numeric` columns as strings by default.
 */
export interface LedgerNotionalRow {
  quantity: number | string | null
  price: number | string | null
}

export function sumLedgerNotional(rows: ReadonlyArray<LedgerNotionalRow>): number {
  let total = 0
  for (const row of rows) {
    const quantity = Number(row.quantity)
    const price = Number(row.price)
    if (!Number.isFinite(quantity) || !Number.isFinite(price)) continue
    total += quantity * price
  }
  return Math.round(total * 100) / 100
}
