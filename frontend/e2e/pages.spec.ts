import { test, expect } from '@playwright/test'

const DRAKE = '3TVXtAsR1Inumwj472S9r4'

test.describe('core pages (read-only)', () => {
  test('home renders the market table', async ({ page }) => {
    await page.goto('/')
    // The trade table lists artist rows — wait for at least one artist link.
    await expect(page.locator('a[href^="/artist/"]').first()).toBeVisible({ timeout: 15_000 })
  })

  test('artist page renders the price chart', async ({ page }) => {
    await page.goto(`/artist/${DRAKE}`)
    await expect(page.getByText('Drake').first()).toBeVisible({ timeout: 15_000 })
    // The chart is a custom SVG with a drawn path whose `d` has real segments.
    const path = page.locator('svg[width="100%"] path[d*="L"]').first()
    await expect(path).toBeVisible({ timeout: 15_000 })
    const d = await path.getAttribute('d')
    expect((d ?? '').length).toBeGreaterThan(50)
  })

  test('artist page period switch keeps the chart alive', async ({ page }) => {
    await page.goto(`/artist/${DRAKE}`)
    await expect(page.locator('svg[width="100%"] path[d*="L"]').first()).toBeVisible({ timeout: 15_000 })
    await page.getByText('1W', { exact: true }).first().click()
    // Chart must still draw a real path after the period change. NOTE: use
    // toBeAttached, not toBeVisible — a flat market (e.g. a stale feed) draws
    // a perfectly horizontal line whose bounding box has height 0, which
    // Playwright's visibility check treats as hidden.
    const path = page.locator('svg[width="100%"] path[d*="L"]').first()
    await expect(path).toBeAttached({ timeout: 10_000 })
    expect(((await path.getAttribute('d')) ?? '').length).toBeGreaterThan(10)
  })

  test('leaderboard renders and links to public profiles', async ({ page }) => {
    await page.goto('/leaderboard')
    const profileLink = page.locator('a[href^="/profile/"]').first()
    await expect(profileLink).toBeVisible({ timeout: 15_000 })
  })

  test('public user profile renders identity', async ({ page }) => {
    // Walk in from the leaderboard instead of hardcoding a username — user
    // rows come and go (the old fixture user was wiped in the account
    // overhaul), but whoever tops the leaderboard must have a live profile.
    await page.goto('/leaderboard')
    const profileLink = page.locator('a[href^="/profile/"]').first()
    await expect(profileLink).toBeVisible({ timeout: 15_000 })
    const username = (await profileLink.getAttribute('href'))!.split('/').pop()!
    await page.goto(`/profile/${username}`)
    // The account overhaul dropped the "@" prefix — the page shows the bare
    // username above the "Joined …" line.
    await expect(page.getByText(username, { exact: true }).first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/Joined /)).toBeVisible()
  })

  test('unknown user profile shows not-found UI', async ({ page }) => {
    await page.goto('/profile/__no_such_user__')
    await expect(page.getByText(/not.*found|404/i).first()).toBeVisible({ timeout: 15_000 })
  })
})

test.describe('side rail proximity animation (desktop)', () => {
  test('rail expands when the cursor nears the left edge and collapses away', async ({ page }) => {
    await page.goto('/')
    // The animated element is the INNER panel (the outer nav column stays 64px
    // by design — it reserves layout space while the panel overlays on expand).
    const rail = page.getByTestId('side-rail-panel')
    await expect(rail).toBeVisible()

    // Park the cursor mid-screen → collapsed (icon strip).
    await page.mouse.move(640, 400)
    await page.waitForTimeout(450)
    const collapsed = (await rail.boundingBox())!.width

    // Approach the left edge → must unfold wider.
    await page.mouse.move(40, 400)
    await page.waitForTimeout(450)
    const expanded = (await rail.boundingBox())!.width
    expect(expanded).toBeGreaterThan(collapsed * 1.5)

    // Retreat → folds back down.
    await page.mouse.move(640, 400)
    await page.waitForTimeout(450)
    const refolded = (await rail.boundingBox())!.width
    expect(refolded).toBeLessThan(expanded * 0.6)
  })
})
