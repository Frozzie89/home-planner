import { test, expect } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import {
  injectAuth,
  mockRemainingPbCalls,
  mockSettingsMembersApi,
  mockHouseholdsApi,
  MOCK_HOUSEHOLD_ID,
} from './helpers/auth'

const PB_URL = 'http://pb.home-planner.localhost'

test.beforeEach(async ({ page }) => {
  await injectAuth(page)
  // Catch-all registered first (Playwright LIFO = lowest priority)
  await mockRemainingPbCalls(page)
  // Expenses endpoint — FinancesView needs this if the router redirects there
  await page.route(`${PB_URL}/api/collections/expenses/records*`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ page: 1, perPage: 30, totalItems: 0, totalPages: 0, items: [] }),
    }),
  )
  // Settings-specific mocks (registered after catch-all, so higher LIFO priority)
  await mockSettingsMembersApi(page, { currentUserRole: 'admin' })
  await mockHouseholdsApi(page)
})

test('settings view renders without WCAG 2.1 AA violations', async ({ page }) => {
  await page.goto('/settings')
  await page.waitForLoadState('networkidle')
  await expect(page).toHaveURL(/\/settings/)

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(
    results.violations,
    results.violations
      .map(v => `[${v.id}] ${v.description}\n  ${v.nodes.map(n => n.html).join('\n  ')}`)
      .join('\n'),
  ).toEqual([])
})

test('settings form pre-fills with household data', async ({ page }) => {
  await page.goto('/settings')
  await page.waitForLoadState('networkidle')
  await expect(page).toHaveURL(/\/settings/)

  // Household name is pre-filled from the API response
  await expect(page.locator('#household-name')).toHaveValue('Test Household')
  // Split ratio sum should be valid (50 + 50 = 100) and display ✓
  await expect(page.getByText('100 / 100')).toBeVisible()
})

test('member list shows both members — current user first with "You" badge', async ({ page }) => {
  await page.goto('/settings')
  await page.waitForLoadState('networkidle')

  // "You" badge should appear on the current user's entry (scoped to the member list)
  const memberList = page.locator('.member-list')
  await expect(memberList.getByText('You')).toBeVisible()
  // Second member "Bob" should appear in the member list
  await expect(memberList.getByText('Bob')).toBeVisible()
})

test('member-role user navigating to /settings is redirected to /finances', async ({ page }) => {
  // Override the members mock — last registered wins (LIFO)
  await mockSettingsMembersApi(page, { currentUserRole: 'member' })

  await page.goto('/settings')
  await page.waitForLoadState('networkidle')

  // Router guard redirects members away from /settings
  await expect(page).toHaveURL(/\/finances/)
})

test('invite member sheet opens and displays a link input', async ({ page }) => {
  // Stub invitations collection so the invite generation succeeds
  await page.route(`${PB_URL}/api/collections/invitations/records*`, (route) => {
    if (route.request().method() === 'POST') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'inv-1',
          token: 'abc123token',
          household_id: MOCK_HOUSEHOLD_ID,
          accepted: false,
        }),
      })
    } else {
      // GET (getFirstListItem for existing invite) → 404 so a new one is created
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ code: 404, message: 'Not found.', data: {} }),
      })
    }
  })

  await page.goto('/settings')
  await page.waitForLoadState('networkidle')

  await page.getByRole('button', { name: 'Invite member' }).click()

  // Bottom sheet should open and show the invite link input
  await expect(page.locator('#invite-link')).toBeVisible()
})
