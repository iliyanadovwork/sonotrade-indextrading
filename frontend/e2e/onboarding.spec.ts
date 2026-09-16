import { test, expect } from '@playwright/test'

/**
 * First-login onboarding tutorial. Auth is fully mocked — /api/auth/me is
 * intercepted and never reaches the backend, and the fake Bearer token means
 * any other authed fetch just 401s. Read-only against the live dev server.
 */
const MOCK_USER = {
  id: 'e2e-onboarding-user',
  email: 'e2e-onboarding@example.com',
  username: 'e2e_onboarding',
  balance: 1000,
}

test.describe('first-login onboarding tutorial', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/auth/me', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: MOCK_USER }),
      }),
    )
    await page.addInitScript(() => localStorage.setItem('auth_token', 'e2e-fake-token'))
  })

  test('opens once after login, walks long → short → cash out, never re-opens', async ({ page }) => {
    await page.goto('/')

    // Slide 1 — welcome + live chart. Scope to the dialog: the home page's own
    // carousels also expose "Next"-labeled buttons.
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Artists, priced live.')).toBeVisible({ timeout: 15_000 })

    // Slide 2 — long demo mirrors the trading panel. Placing the order opens
    // the demo position (the slide also auto-opens it hands-free after 1.6s,
    // so the click may lose that race — either way the position must open).
    await dialog.getByRole('button', { name: 'Next', exact: true }).click()
    const longOrder = dialog.getByRole('button', { name: 'Place long order' })
    await expect(longOrder).toBeVisible()
    await longOrder.click({ timeout: 3000 }).catch(() => {}) // no-op if auto-open won
    await expect(dialog.getByRole('button', { name: 'Position open' })).toBeVisible()
    await expect(dialog.getByText('LONG', { exact: true })).toBeVisible()

    // Slide 3 — short demo, same open mechanics.
    await dialog.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(dialog.getByRole('button', { name: 'Place short order' })).toBeVisible()
    await expect(dialog.getByText('SHORT', { exact: true })).toBeVisible({ timeout: 5000 }) // via auto-open

    // Slide 4 — close a position, watch it cash out.
    await dialog.getByRole('button', { name: 'Next', exact: true }).click()
    const startTrading = dialog.getByRole('button', { name: 'Start trading' })
    await expect(startTrading).toBeVisible()
    // Position rows carry an accessible name like "LONG Entry $36.00 +$25.00 Close"
    // (the bare-"Close" button is the modal's × and must not be matched here).
    await dialog.getByRole('button', { name: /Entry \$/ }).first().click()
    await expect(dialog.getByText(/cashed out/)).toBeVisible()

    // Finishing marks it seen and closes the modal.
    await startTrading.click()
    await expect(page.getByText('Artists, priced live.')).toHaveCount(0)
    expect(await page.evaluate(() => localStorage.getItem('sonotrade:onboarding-seen'))).toBe('1')

    // Reload — the tutorial must not come back (600ms open delay, so give it time).
    await page.reload()
    await expect(page.locator('a[href^="/artist/"]').first()).toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(1500)
    await expect(page.getByText('Artists, priced live.')).toHaveCount(0)
  })
})
