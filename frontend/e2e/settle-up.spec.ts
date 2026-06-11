import { test, expect, type Page } from '@playwright/test';
import {
  injectAuth,
  mockRemainingPbCalls,
  mockHouseholdsApi,
  mockSettingsMembersApi,
  mockExpensesApi,
  MOCK_HOUSEHOLD_ID,
  MOCK_MEMBER_ID_2,
  type MockExpense,
} from './helpers/auth';

const PB_URL = 'http://pb.home-planner.localhost';

// Bob paid €80 with 50/50 split → viewer owes Bob €40 → bilateralBalances returns -4000
const BOB_EXPENSE: MockExpense = {
  id: 'exp-bob',
  household_id: MOCK_HOUSEHOLD_ID,
  member_id: MOCK_MEMBER_ID_2,
  title: 'Dinner',
  amount: 8000,
  portion: 50,
  date: '2026-06-09 00:00:00.000Z',
  created: '2026-06-09 00:00:00.000Z',
  updated: '2026-06-09 00:00:00.000Z',
};

async function setupMocks(page: Page, expenses: MockExpense[] = [BOB_EXPENSE]) {
  await injectAuth(page);
  await mockRemainingPbCalls(page);
  await mockHouseholdsApi(page);
  await mockSettingsMembersApi(page);
  await mockExpensesApi(page, expenses);
  await page.route(`${PB_URL}/api/realtime*`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      headers: { 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
      body: 'event: PB_CONNECT\ndata: {"clientId":"test-client"}\n\n',
    })
  );
}

// 3.5-E1: SettleUpCard is visible when balance is non-zero
test('SettleUpCard is visible when balance is non-zero', async ({ page }) => {
  await test.step("set up mocks with Bob's expense and navigate to finances", async () => {
    await setupMocks(page);
    await page.goto('/finances');
    await page.waitForLoadState('networkidle');
  });

  await test.step('assert Settle up button is visible', async () => {
    await expect(page.getByRole('button', { name: 'Settle up' })).toBeVisible();
  });
});

// 3.5-E2: SettleUpCard is not rendered when balance is zero
test('SettleUpCard is not rendered when balance is zero', async ({ page }) => {
  await test.step('set up mocks with no expenses and navigate to finances', async () => {
    await setupMocks(page, []);
    await page.goto('/finances');
    await page.waitForLoadState('networkidle');
  });

  await test.step('assert Settle up button is not present in the DOM', async () => {
    await expect(page.getByRole('button', { name: 'Settle up' })).toHaveCount(0);
  });
});

// 3.5-E3: Confirming settle-up hides SettleUpCard and shows golden wash
test('confirming settle-up hides SettleUpCard and shows settled state', async ({ page }) => {
  await test.step("set up mocks with Bob's expense and navigate to finances", async () => {
    await setupMocks(page);
    await page.goto('/finances');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('button', { name: 'Settle up' })).toBeVisible();
  });

  await test.step('click Settle up to open confirmation sheet', async () => {
    await page.getByRole('button', { name: 'Settle up' }).click();
  });

  await test.step('confirmation sheet shows correct copy', async () => {
    await expect(page.getByText("Confirm you've settled the balance with Bob?")).toBeVisible();
  });

  await test.step('click Confirm', async () => {
    await page.getByRole('button', { name: 'Confirm' }).click();
  });

  await test.step('SettleUpCard is no longer in DOM', async () => {
    await expect(page.getByRole('button', { name: 'Settle up' })).toHaveCount(0);
  });

  await test.step('"All settled" text is visible', async () => {
    await expect(page.getByText('All settled')).toBeVisible();
  });
});

// 3.5-E4: Cancelling settle-up leaves balance and SettleUpCard unchanged
test('cancelling settle-up leaves balance and SettleUpCard unchanged', async ({ page }) => {
  await test.step("set up mocks with Bob's expense and navigate to finances", async () => {
    await setupMocks(page);
    await page.goto('/finances');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('button', { name: 'Settle up' })).toBeVisible();
  });

  await test.step('click Settle up to open confirmation sheet', async () => {
    await page.getByRole('button', { name: 'Settle up' }).click();
  });

  await test.step('click Cancel to dismiss the sheet', async () => {
    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  await test.step('Settle up button is still visible after cancellation', async () => {
    await expect(page.getByRole('button', { name: 'Settle up' })).toBeVisible();
  });
});
