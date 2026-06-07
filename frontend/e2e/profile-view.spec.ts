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
  await test.step('Set up mocks as member role', async () => {
    await setupProfileMocks(page, 'member')
  })

  await test.step('Navigate to /profile', async () => {
    await page.goto('/profile')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/\/profile/)
  })

  await test.step('Scan for WCAG 2.1 AA violations', async () => {
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(
      results.violations,
      results.violations
        .map(v => `[${v.id}] ${v.description}\n  ${v.nodes.map(n => n.html).join('\n  ')}`)
        .join('\n'),
    ).toEqual([])
  })
})

test('sign out button is visible and redirects to /auth', async ({ page }) => {
  await test.step('Set up mocks as admin role', async () => {
    await setupProfileMocks(page, 'admin')
  })

  await test.step('Navigate to /profile', async () => {
    await page.goto('/profile')
    await page.waitForLoadState('networkidle')
  })

  await test.step('Click Sign out and verify redirect to /auth', async () => {
    const signOutBtn = page.getByRole('button', { name: 'Sign out' })
    await expect(signOutBtn).toBeVisible()
    await signOutBtn.click()
    await expect(page).toHaveURL(/\/auth/)
  })
})

test('leave household button is visible for a non-admin member', async ({ page }) => {
  await test.step('Set up mocks as member role', async () => {
    // mockSettingsMembersApi with currentUserRole: 'member' sets auth store role to 'member',
    // which is what controls the leave section visibility (isNonAdminMember computed)
    await injectAuth(page)
    await mockRemainingPbCalls(page)
    await mockSettingsMembersApi(page, { currentUserRole: 'member' })
    await mockProfileMemberApi(page, 'member')
  })

  await test.step('Navigate to /profile', async () => {
    await page.goto('/profile')
    await page.waitForLoadState('networkidle')
  })

  await test.step('Verify Leave household button is visible', async () => {
    await expect(page.getByRole('button', { name: 'Leave household' })).toBeVisible()
  })
})

test('leave household button is absent for an admin member', async ({ page }) => {
  await test.step('Set up mocks as admin role', async () => {
    await setupProfileMocks(page, 'admin')
  })

  await test.step('Navigate to /profile', async () => {
    await page.goto('/profile')
    await page.waitForLoadState('networkidle')
  })

  await test.step('Verify Leave household button is not rendered', async () => {
    await expect(page.getByRole('button', { name: 'Leave household' })).not.toBeVisible()
  })
})

test('leave household confirmation sheet appears and can be cancelled', async ({ page }) => {
  await test.step('Set up mocks as member role', async () => {
    await injectAuth(page)
    await mockRemainingPbCalls(page)
    await mockSettingsMembersApi(page, { currentUserRole: 'member' })
    await mockProfileMemberApi(page, 'member')
  })

  await test.step('Navigate to /profile', async () => {
    await page.goto('/profile')
    await page.waitForLoadState('networkidle')
  })

  await test.step('Open leave household confirmation sheet', async () => {
    await page.getByRole('button', { name: 'Leave household' }).click()
    // exact: true distinguishes the confirm "Leave" from the trigger "Leave household"
    await expect(page.getByRole('button', { name: 'Leave', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible()
  })

  await test.step('Cancel and verify still on /profile', async () => {
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page).toHaveURL(/\/profile/)
  })
})
