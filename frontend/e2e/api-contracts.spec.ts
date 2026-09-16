import { test, expect } from '@playwright/test'

// Contract tests for the read-only API surface the UI depends on.
// These pin the response shapes the optimization branch pushed down to
// PostgREST — a regression here blanks real UI surfaces.

const DRAKE = '3TVXtAsR1Inumwj472S9r4'

test.describe('API contracts (read-only)', () => {
  test('/api/trade returns sorted artists + total', async ({ request }) => {
    const res = await request.get('/api/trade?limit=5&offset=0&sort_by=volume&sort_dir=desc')
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(Array.isArray(body.artists)).toBeTruthy()
    expect(body.artists.length).toBeGreaterThan(0)
    expect(body.artists.length).toBeLessThanOrEqual(5)
    expect(typeof body.total).toBe('number')
    const a = body.artists[0]
    expect(typeof a.id).toBe('string')
    expect(typeof a.name).toBe('string')
    // volume-desc ordering actually holds
    const vols = body.artists.map((x: { volume: number | null }) => x.volume ?? 0)
    const sorted = [...vols].sort((p: number, q: number) => q - p)
    expect(vols).toEqual(sorted)
  })

  test('/api/search finds artists by name', async ({ request }) => {
    const res = await request.get('/api/search?q=drake')
    expect(res.ok()).toBeTruthy()
    const { results } = await res.json()
    expect(Array.isArray(results)).toBeTruthy()
    expect(results.some((r: { id: string }) => r.id === DRAKE)).toBeTruthy()
  })

  test('/api/markets/[id]/history returns ascending price points', async ({ request }) => {
    const res = await request.get(`/api/markets/${DRAKE}/history?window=all`)
    expect(res.ok()).toBeTruthy()
    const points = await res.json()
    expect(Array.isArray(points)).toBeTruthy()
    expect(points.length).toBeGreaterThan(1)
    for (const p of points.slice(0, 5)) {
      expect(typeof p.price).toBe('number')
      expect(Number.isFinite(new Date(p.timestamp).getTime())).toBeTruthy()
    }
    // chronological order — the chart assumes it
    const times = points.map((p: { timestamp: string }) => new Date(p.timestamp).getTime())
    for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThanOrEqual(times[i - 1])
  })

  test('/api/profile/[id] 404s for unknown artists', async ({ request }) => {
    const res = await request.get('/api/profile/0000000000000000000000')
    expect(res.status()).toBe(404)
  })

  test('/api/profile/[id]?slim=true returns the artist', async ({ request }) => {
    const res = await request.get(`/api/profile/${DRAKE}?slim=true`)
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    const p = body.profile ?? body
    expect(p.name).toBe('Drake')
  })

  test('anonymous users cannot reach protected APIs', async ({ request }) => {
    const res = await request.get('/api/portfolio')
    expect([401, 403]).toContain(res.status())
  })
})
