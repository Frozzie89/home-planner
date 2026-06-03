import { test, expect } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import { injectAuth, mockMembersApi, mockRemainingPbCalls } from './helpers/auth'

const PB_URL = 'http://pb.home-planner.localhost'

test('finances view renders without WCAG 2.1 AA violations', async ({ page }) => {
  // Auth valid + householdId set → router allows /finances
  await injectAuth(page)
  // Catch-all registered first so specific routes below take precedence (Playwright LIFO)
  await mockRemainingPbCalls(page)
  await mockMembersApi(page, true)

  // Mock the expenses endpoint so FinancesView doesn't fail with network errors
  await page.route(`${PB_URL}/api/collections/expenses/records*`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ page: 1, perPage: 30, totalItems: 0, totalPages: 0, items: [] }),
    }),
  )

  await page.goto('/finances')
  await page.waitForLoadState('networkidle')

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(
    results.violations,
    results.violations.map(v => `[${v.id}] ${v.description}\n  ${v.nodes.map(n => n.html).join('\n  ')}`).join('\n'),
  ).toEqual([])
})
