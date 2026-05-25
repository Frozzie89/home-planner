import { test, expect } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import { injectAuth, mockMembersApi, mockRemainingPbCalls } from './helpers/auth'

test('household setup view renders without WCAG 2.1 AA violations', async ({ page }) => {
  // Auth valid, but no household → router allows /setup
  await injectAuth(page, { householdId: null })
  // Catch-all registered first so specific routes below take precedence (Playwright LIFO)
  await mockRemainingPbCalls(page)
  await mockMembersApi(page, false) // 404 → householdId stays null

  await page.goto('/setup')
  await page.waitForLoadState('networkidle')
  await expect(page).toHaveURL(/\/setup/)

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(results.violations).toEqual([])
})
