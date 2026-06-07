import { test, expect } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import {
  injectAuth,
  mockRemainingPbCalls,
  mockMembersApi,
  mockSettingsMembersApi,
  mockProfileMemberApi,
} from './helpers/auth'

// Profile view setup: auth store init via mockMembersApi (getFirstListItem),
// then profile-specific getOne via mockProfileMemberApi (registered last = LIFO priority).
async function setupProfileMocks(page: Parameters<typeof mockMembersApi>[0], role: 'admin' | 'member') {
  await injectAuth(page)
  await mockRemainingPbCalls(page)
  await mockMembersApi(page, true)           // handles auth store's getFirstListItem (admin role)
  await mockProfileMemberApi(page, role)     // handles ProfileView's getOne (LIFO — wins for /records/:id)
}

test('profile view renders without WCAG 2.1 AA violations', async ({ page }) => {
  await setupProfileMocks(page, 'member')

  await page.goto('/profile')
  await page.waitForLoadState('networkidle')
  await expect(page).toHaveURL(/\/profile/)

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(
    results.violations,
    results.violations
      .map(v => `[${v.id}] ${v.description}\n  ${v.nodes.map(n => n.html).join('\n  ')}`)
      .join('\n'),
  ).toEqual([])
})

test('sign out button is visible and redirects to /auth', async ({ page }) => {
  await setupProfileMocks(page, 'admin')

  await page.goto('/profile')
  await page.waitForLoadState('networkidle')

  const signOutBtn = page.getByRole('button', { name: 'Sign out' })
  await expect(signOutBtn).toBeVisible()

  await signOutBtn.click()
  await expect(page).toHaveURL(/\/auth/)
})

test('leave household button is visible for a non-admin member', async ({ page }) => {
  // Auth store role must be 'member' for the leave section to render.
  // mockSettingsMembersApi with currentUserRole: 'member' handles the auth store's call.
  await injectAuth(page)
  await mockRemainingPbCalls(page)
  await mockSettingsMembersApi(page, { currentUserRole: 'member' })
  await mockProfileMemberApi(page, 'member')

  await page.goto('/profile')
  await page.waitForLoadState('networkidle')

  await expect(page.getByRole('button', { name: 'Leave household' })).toBeVisible()
})

test('leave household button is absent for an admin member', async ({ page }) => {
  // Auth store role is 'admin' → isNonAdminMember = false → section hidden
  await setupProfileMocks(page, 'admin')

  await page.goto('/profile')
  await page.waitForLoadState('networkidle')

  await expect(page.getByRole('button', { name: 'Leave household' })).not.toBeVisible()
})

test('leave household confirmation sheet appears and can be cancelled', async ({ page }) => {
  await injectAuth(page)
  await mockRemainingPbCalls(page)
  await mockSettingsMembersApi(page, { currentUserRole: 'member' })
  await mockProfileMemberApi(page, 'member')

  await page.goto('/profile')
  await page.waitForLoadState('networkidle')

  await page.getByRole('button', { name: 'Leave household' }).click()

  // Confirmation sheet opens — use exact: true to distinguish from the "Leave household" trigger
  await expect(page.getByRole('button', { name: 'Leave', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible()

  // Cancelling closes the sheet without navigating away
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page).toHaveURL(/\/profile/)
})
