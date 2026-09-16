import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * Operational health, in the shape TappedIn's pipeline_health_alert proved
 * useful: not "is the process up" but "does the data still make sense".
 *
 * Everything here is a question that went unanswered during the 2026-08 audit
 * and cost real time to answer by hand — whether the feed ran, whether the
 * catalog is stale, whether the two price stores agree, whether balances still
 * reconcile against the ledger.
 *
 * 200 with ok:true when clean, 503 when any check fails, so an uptime monitor
 * can watch the URL directly. Details are deliberately coarse: this endpoint is
 * unauthenticated, so it reports WHICH check failed and how many rows, never
 * user ids or balances.
 */

const LATENCY_BUDGET_MS = 1500

type Finding = { check: string; detail: string }

export async function GET() {
  const started = Date.now()
  const supabase = createAdminClient()
  const findings: Finding[] = []
  const timings: Record<string, number> = {}

  async function probe<T>(label: string, run: () => Promise<T>): Promise<T | null> {
    const t0 = Date.now()
    try {
      return await run()
    } catch (err) {
      findings.push({ check: label, detail: (err as Error).message })
      return null
    } finally {
      timings[label] = Date.now() - t0
    }
  }

  // Untimed warm-up. The first call from a cold serverless instance pays
  // connection and auth setup — measured here at 3,428 ms against 80 ms warm —
  // which would otherwise be charged to whichever probe happened to run first
  // and trip the latency budget on a perfectly healthy database. TappedIn hit
  // exactly this and blamed a 40 ms query for 2,076 ms.
  await supabase.rpc('platform_today').then(() => {}, () => {})

  // Feed integrity: did today's points reach the history table, and has
  // anything been written at all in the last 36 hours.
  await probe('index_history_drift', async () => {
    const { data, error } = await supabase.rpc('index_history_drift')
    if (error) throw new Error(error.message)
    for (const row of (data ?? []) as { check_name: string; detail: string; magnitude: number }[]) {
      findings.push({ check: row.check_name, detail: `${row.detail} (${row.magnitude})` })
    }
  })

  // Money: balances against the ledger, position sizes against their trade
  // rows, the index floor, positions stranded on unpriced markets.
  await probe('sonotrade_invariants', async () => {
    const { data, error } = await supabase.rpc('sonotrade_invariants')
    if (error) throw new Error(error.message)
    for (const row of (data ?? []) as { check_name: string; detail: string }[]) {
      findings.push({ check: row.check_name, detail: row.detail })
    }
  })

  // A pricing-formula change reprices the catalog in place. An organic day
  // moves nobody 2x; hundreds means a deploy did it.
  await probe('mass_reprice', async () => {
    const { data, error } = await supabase.rpc('mass_reprice_count')
    if (error) throw new Error(error.message)
    const n = Number(data ?? 0)
    if (n > 25) findings.push({ check: 'catalog_repriced', detail: `${n} artists moved >=2x today` })
  })

  // Latency budget on the hot read path. TappedIn added this after a
  // leaderboard RPC silently degraded from milliseconds to 6.8s as its history
  // table grew — correctness tests on small local data are blind to that whole
  // class of regression.
  await probe('chart_rpc_latency', async () => {
    const { error } = await supabase.rpc('artist_history_batch', {
      p_spotify_ids: ['3TVXtAsR1Inumwj472S9r4'],
      p_window: '30d',
    })
    if (error) throw new Error(error.message)
  })
  if (timings.chart_rpc_latency > LATENCY_BUDGET_MS) {
    findings.push({
      check: 'chart_rpc_slow',
      detail: `artist_history_batch took ${timings.chart_rpc_latency}ms (budget ${LATENCY_BUDGET_MS}ms)`,
    })
  }

  const ok = findings.length === 0
  return NextResponse.json(
    { ok, checked_at: new Date().toISOString(), took_ms: Date.now() - started, timings, findings },
    { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  )
}
