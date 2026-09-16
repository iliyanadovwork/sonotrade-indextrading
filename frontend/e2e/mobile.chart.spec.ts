import { test, expect } from '@playwright/test'

const DRAKE = '3TVXtAsR1Inumwj472S9r4'

// Regression tests for the mobile chart-width fixes: the chart's drawing
// block is inset 12px each side (matching the mobile UI's px-3 rhythm) and
// the page must never scroll horizontally.

test.describe('mobile artist chart', () => {
  test('chart matches the mobile margins and page has no horizontal scroll', async ({ page }) => {
    await page.goto(`/artist/${DRAKE}`)
    const path = page.locator('svg[width="100%"] path[d*="L"]').first()
    await expect(path).toBeVisible({ timeout: 20_000 })

    const svg = page.locator('svg[width="100%"]').filter({ has: page.locator('path[d*="L"]') }).first()
    const box = (await svg.boundingBox())!
    const viewport = page.viewportSize()!

    // Left edge ≈ 12px margin (CSS zoom 0.9 scales it to ~10.8): 5–20px band.
    expect(box.x).toBeGreaterThan(5)
    expect(box.x).toBeLessThan(20)
    // Right edge symmetric with the left — the pre-fix bug left ~50-70px dead
    // space on the right. Allow the same 5–20px band.
    const rightGap = viewport.width - (box.x + box.width)
    expect(rightGap).toBeGreaterThan(5)
    expect(rightGap).toBeLessThan(20)

    // No horizontal page scroll (dot pulse / chart overflow would cause it).
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
  })
})
