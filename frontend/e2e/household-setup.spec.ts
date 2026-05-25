import { test, expect } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import { injectAuth, mockMembersApi, mockRemainingPbCalls } from './helpers/auth'

test('household setup view renders without WCAG 2.1 AA violations', async ({ page }) => {
  // Auth valid, but no household → router allows /setup
  await injectAuth(page, { householdId: null })
  await mockMembersApi(page, false) // 404 → householdId stays null
  await mockRemainingPbCalls(page)

  await page.goto('/setup')

  // HouseholdSetupView renders a Household Name InputText — wait for its label
  await expect(page.getByLabel('Household Name')).toBeVisible()

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(results.violations).toEqual([])
})
