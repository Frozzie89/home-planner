import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import {
  injectAuth,
  mockRemainingPbCalls,
  mockSettingsMembersApi,
  mockHouseholdsApi,
  mockExpensesApi,
  mockExpenseUpdateApi,
  mockExpenseDeleteApi,
  MOCK_HOUSEHOLD_ID,
  MOCK_MEMBER_ID,
  MOCK_MEMBER_ID_2,
} from './helpers/auth';
import type { MockExpense } from './helpers/auth';

const VIEWER_EXPENSE: MockExpense = {
  id: 'exp-viewer',
  household_id: MOCK_HOUSEHOLD_ID,
  member_id: MOCK_MEMBER_ID,
  title: 'Groceries',
  amount: 5000,
  portion: 50,
  date: '2026-06-09 00:00:00.000Z',
  created: '2026-06-09 00:00:00.000Z',
  updated: '2026-06-09 00:00:00.000Z',
};

const BOB_EXPENSE: MockExpense = {
  id: 'exp-bob',
  household_id: MOCK_HOUSEHOLD_ID,
  member_id: MOCK_MEMBER_ID_2,
  title: 'Dinner',
  amount: 8000,
  portion: 50,
  date: '2026-06-08 00:00:00.000Z',
  created: '2026-06-08 00:00:00.000Z',
  updated: '2026-06-08 00:00:00.000Z',
};

async function setupMocks(page: Page, options: { currentUserRole?: 'admin' | 'member' } = {}) {
  await injectAuth(page);
  await mockRemainingPbCalls(page);
  await mockHouseholdsApi(page);
  await mockSettingsMembersApi(page, options);
  await mockExpensesApi(page, [VIEWER_EXPENSE, BOB_EXPENSE]);
}

// 3.3-E1: Expense list renders with correct data
test('expense list renders title, amount, and member name', async ({ page }) => {
  await test.step('set up mocks', async () => {
    await setupMocks(page);
  });
  await test.step('navigate to finances', async () => {
    await page.goto('/finances');
    await page.waitForLoadState('networkidle');
  });
  await test.step('verify expense data is visible', async () => {
    await expect(page.getByText('Groceries')).toBeVisible();
    await expect(page.getByText('Dinner')).toBeVisible();
    await expect(page.getByText('You paid')).toBeVisible();
    await expect(page.getByText('Bob paid')).toBeVisible();
  });
});

// 3.3-E2: Owner can open edit form pre-filled
test('owner can open edit form pre-filled with expense data', async ({ page }) => {
  await test.step('set up mocks', async () => {
    await setupMocks(page);
  });
  await test.step('navigate to finances', async () => {
    await page.goto('/finances');
    await page.waitForLoadState('networkidle');
  });
  await test.step("hover viewer's own expense row to reveal actions", async () => {
    await page.getByText('Groceries').hover();
  });
  await test.step('click Edit expense', async () => {
    await page.getByRole('button', { name: 'Edit expense' }).first().click();
  });
  await test.step('verify edit sheet opens pre-filled', async () => {
    await expect(page.getByLabel('Title')).toHaveValue('Groceries');
  });
});

// 3.3-E3: Owner can save edited expense
test('owner can save edited expense and list updates', async ({ page }) => {
  const updatedExpense = { ...VIEWER_EXPENSE, title: 'Supermarket', amount: 6000 };
  await test.step('set up mocks', async () => {
    await setupMocks(page);
    await mockExpenseUpdateApi(page, 'exp-viewer', updatedExpense);
  });
  await test.step('navigate, hover, and open edit', async () => {
    await page.goto('/finances');
    await page.waitForLoadState('networkidle');
    await page.getByText('Groceries').hover();
    await page.getByRole('button', { name: 'Edit expense' }).first().click();
  });
  await test.step('update title and save', async () => {
    await page.getByLabel('Title').fill('Supermarket');
    await page.getByRole('button', { name: 'Save Changes' }).click();
  });
  await test.step('verify updated title appears in list', async () => {
    await expect(page.getByText('Supermarket')).toBeVisible();
  });
});

// 3.3-E4: Member cannot see actions on others' expenses
test("member role cannot see edit button on another member's expense", async ({ page }) => {
  await test.step('set up mocks as member role', async () => {
    await setupMocks(page, { currentUserRole: 'member' });
  });
  await test.step('navigate to finances', async () => {
    await page.goto('/finances');
    await page.waitForLoadState('networkidle');
  });
  await test.step("verify only viewer's own expense has edit button (not Bob's)", async () => {
    await expect(page.getByRole('button', { name: 'Edit expense' })).toHaveCount(1);
  });
});

// 3.3-E5: Owner can delete own expense
test('owner can delete own expense and list updates', async ({ page }) => {
  await test.step('set up mocks', async () => {
    await setupMocks(page);
    await mockExpenseDeleteApi(page, 'exp-viewer');
  });
  await test.step('navigate, hover, and click delete', async () => {
    await page.goto('/finances');
    await page.waitForLoadState('networkidle');
    await page.getByText('Groceries').hover();
    await page.getByRole('button', { name: 'Delete expense' }).first().click();
  });
  await test.step('confirm deletion in bottom sheet', async () => {
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
  });
  await test.step('verify expense removed from list', async () => {
    await expect(page.getByText('Groceries')).not.toBeVisible();
    await expect(page.getByText('Dinner')).toBeVisible();
  });
});

// 3.3-E6: Admin can access actions on all expenses
test('admin can access edit and delete on all expenses', async ({ page }) => {
  await test.step('set up mocks as admin role', async () => {
    await setupMocks(page, { currentUserRole: 'admin' });
  });
  await test.step('navigate to finances', async () => {
    await page.goto('/finances');
    await page.waitForLoadState('networkidle');
  });
  await test.step('verify edit and delete buttons present for both expenses', async () => {
    await expect(page.getByRole('button', { name: 'Edit expense' })).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'Delete expense' })).toHaveCount(2);
  });
});

// 3.3-E8: PATCH failure  - edit reverts and error banner appears
test('edit failure reverts expense and shows error banner', async ({ page }) => {
  await test.step('set up mocks with failing PATCH', async () => {
    await setupMocks(page);
    await mockExpenseUpdateApi(page, 'exp-viewer', VIEWER_EXPENSE, { failWithStatus: 500 });
  });
  await test.step('navigate and open edit sheet', async () => {
    await page.goto('/finances');
    await page.waitForLoadState('networkidle');
    await page.getByText('Groceries').hover();
    await page.getByRole('button', { name: 'Edit expense' }).first().click();
  });
  await test.step('change title and save', async () => {
    await page.getByLabel('Title').fill('Should Not Stick');
    await page.getByRole('button', { name: 'Save Changes' }).click();
  });
  await test.step('verify original title restored and error banner visible', async () => {
    await expect(page.getByText('Groceries')).toBeVisible();
    await expect(
      page.getByRole('alert').filter({ hasText: "Couldn't save the changes" })
    ).toBeVisible();
  });
});

// 3.3-E9: DELETE failure  - expense reverts and error banner appears
test('delete failure reverts expense and shows error banner', async ({ page }) => {
  await test.step('set up mocks with failing DELETE', async () => {
    await setupMocks(page);
    await mockExpenseDeleteApi(page, 'exp-viewer', { failWithStatus: 500 });
  });
  await test.step('navigate and click delete', async () => {
    await page.goto('/finances');
    await page.waitForLoadState('networkidle');
    await page.getByText('Groceries').hover();
    await page.getByRole('button', { name: 'Delete expense' }).first().click();
  });
  await test.step('confirm deletion', async () => {
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
  });
  await test.step('verify expense restored and error banner visible', async () => {
    await expect(page.getByText('Groceries')).toBeVisible();
    await expect(
      page.getByRole('alert').filter({ hasText: "Couldn't delete the expense" })
    ).toBeVisible();
  });
});

// 3.3-E10: Empty state after last expense is deleted
test('empty state appears after last expense is deleted', async ({ page }) => {
  await test.step('set up mocks with single expense', async () => {
    await injectAuth(page);
    await mockRemainingPbCalls(page);
    await mockHouseholdsApi(page);
    await mockSettingsMembersApi(page);
    await mockExpensesApi(page, [VIEWER_EXPENSE]);
    await mockExpenseDeleteApi(page, 'exp-viewer');
  });
  await test.step('navigate to finances', async () => {
    await page.goto('/finances');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Groceries')).toBeVisible();
  });
  await test.step('delete the only expense', async () => {
    await page.getByText('Groceries').hover();
    await page.getByRole('button', { name: 'Delete expense' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
  });
  await test.step('verify empty state appears', async () => {
    await expect(page.getByText('Nothing here yet — add your first expense')).toBeVisible();
  });
});

// 3.3-E7: WCAG 2.1 AA
test('expense list with items has no WCAG 2.1 AA violations', async ({ page }) => {
  await test.step('set up mocks', async () => {
    await setupMocks(page);
  });
  await test.step('navigate to finances', async () => {
    await page.goto('/finances');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Groceries')).toBeVisible();
  });
  await test.step('run axe accessibility audit', async () => {
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(
      results.violations,
      results.violations
        .map((v) => `[${v.id}] ${v.description}\n  ${v.nodes.map((n) => n.html).join('\n  ')}`)
        .join('\n')
    ).toEqual([]);
  });
});
