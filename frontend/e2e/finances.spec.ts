import { test, expect } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import {
  injectAuth,
  mockRemainingPbCalls,
  mockSettingsMembersApi,
  mockHouseholdsApi,
  mockExpensesApi,
  MOCK_HOUSEHOLD_ID,
  MOCK_MEMBER_ID,
} from './helpers/auth'

// 3.1-E1: Zero balance when no expenses
test('balance card shows zero state when no expenses exist', async ({ page }) => {
  await injectAuth(page)
  await mockRemainingPbCalls(page)       // catch-all first (LIFO)
  await mockHouseholdsApi(page)          // router loads household store
  await mockSettingsMembersApi(page)     // 2 members with expand — handles auth + finances store
  await mockExpensesApi(page, [])        // empty expenses

  await page.goto('/finances')
  await page.waitForLoadState('networkidle')

  await expect(page.getByText('No expenses logged this period')).toBeVisible()
  await expect(page.getByText('Nothing here yet — add your first expense')).toBeVisible()
})

// 3.1-E2: Correct positive balance amount when viewer is owed money
test('balance card shows correct positive amount when viewer is owed money', async ({ page }) => {
  await injectAuth(page)
  await mockRemainingPbCalls(page)
  await mockHouseholdsApi(page)
  await mockSettingsMembersApi(page)

  // viewer (MOCK_MEMBER_ID) paid €100.00 (10000 cents) with 50% portion
  // -> Bob (MOCK_MEMBER_ID_2) owes viewer 50% of the remaining 50% = €50.00
  await mockExpensesApi(page, [
    {
      id: 'exp-1',
      household_id: MOCK_HOUSEHOLD_ID,
      member_id: MOCK_MEMBER_ID,
      title: 'Groceries',
      amount: 10000,
      portion: 50,
      date: '2026-06-01 00:00:00.000Z',
      created: '2026-06-01 00:00:00.000Z',
      updated: '2026-06-01 00:00:00.000Z',
    },
  ])

  await page.goto('/finances')
  await page.waitForLoadState('networkidle')

  // +€50.00: viewer is owed €50 by Bob
  await expect(page.getByText(/\+.*50/)).toBeVisible()
  await expect(page.getByText('Bob owes you')).toBeVisible()
})

// 3.1-E3: WCAG 2.1 AA — finances view with zero expenses
test('finances view renders without WCAG 2.1 AA violations', async ({ page }) => {
  await injectAuth(page)
  await mockRemainingPbCalls(page)
  await mockHouseholdsApi(page)
  await mockSettingsMembersApi(page)
  await mockExpensesApi(page, [])

  await page.goto('/finances')
  await page.waitForLoadState('networkidle')

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(
    results.violations,
    results.violations.map(v => `[${v.id}] ${v.description}\n  ${v.nodes.map(n => n.html).join('\n  ')}`).join('\n'),
  ).toEqual([])
})
