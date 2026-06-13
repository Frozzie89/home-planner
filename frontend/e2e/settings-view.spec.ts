import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import {
  injectAuth,
  mockRemainingPbCalls,
  mockSettingsMembersApi,
  mockHouseholdsApi,
  MOCK_HOUSEHOLD_ID,
} from './helpers/auth';

const PB_URL = 'http://pb.home-planner.localhost';

test.beforeEach(async ({ page }) => {
  await injectAuth(page);
  // Catch-all registered first (Playwright LIFO = lowest priority)
  await mockRemainingPbCalls(page);
  // Expenses endpoint - FinancesView needs this if the router redirects there
  await page.route(`${PB_URL}/api/collections/expenses/records*`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ page: 1, perPage: 30, totalItems: 0, totalPages: 0, items: [] }),
    })
  );
  // Settings-specific mocks (registered after catch-all, so higher LIFO priority)
  await mockSettingsMembersApi(page, { currentUserRole: 'admin' });
  await mockHouseholdsApi(page);
});

test('settings view renders without WCAG 2.1 AA violations', async ({ page }) => {
  await test.step('Navigate to /settings', async () => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/settings/);
  });

  await test.step('Scan for WCAG 2.1 AA violations', async () => {
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(
      results.violations,
      results.violations
        .map((v) => `[${v.id}] ${v.description}\n  ${v.nodes.map((n) => n.html).join('\n  ')}`)
        .join('\n')
    ).toEqual([]);
  });
});

test('settings form pre-fills with household data', async ({ page }) => {
  await test.step('Navigate to /settings', async () => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/settings/);
  });

  await test.step('Verify household name and split ratio sum are pre-filled', async () => {
    await expect(page.locator('#household-name')).toHaveValue('Test Household');
    await expect(page.getByText('100 / 100')).toBeVisible();
  });
});

test('member list shows both members — current user first with "You" badge', async ({ page }) => {
  await test.step('Navigate to /settings', async () => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
  });

  await test.step('Verify both members appear with correct badges', async () => {
    const memberList = page.locator('.member-list');
    await expect(memberList.getByText('You')).toBeVisible();
    await expect(memberList.getByText('Bob')).toBeVisible();
  });
});

test('member-role user navigating to /settings is redirected to /finances', async ({ page }) => {
  await test.step('Override members mock to return member role', async () => {
    // Registered after beforeEach mock - LIFO gives this higher priority
    await mockSettingsMembersApi(page, { currentUserRole: 'member' });
  });

  await test.step('Navigate to /settings and verify redirect to /finances', async () => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/finances/);
  });
});

test('invite member sheet opens and displays a link input', async ({ page }) => {
  await test.step('Mock invitations endpoint', async () => {
    await page.route(`${PB_URL}/api/collections/invitations/records*`, (route) => {
      if (route.request().method() === 'POST') {
        // POST -> return the created invite record
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'inv-1',
            token: 'abc123token',
            household_id: MOCK_HOUSEHOLD_ID,
            accepted: false,
          }),
        });
      } else {
        // GET (getFirstListItem) -> 404 triggers creation of a new invite
        route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ code: 404, message: 'Not found.', data: {} }),
        });
      }
    });
  });

  await test.step('Navigate to /settings', async () => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
  });

  await test.step('Open invite sheet and verify link input is visible', async () => {
    await page.getByRole('button', { name: 'Invite member' }).click();
    await expect(page.locator('#invite-link')).toBeVisible();
  });
});
