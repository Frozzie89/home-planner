import { test, expect, type Page } from '@playwright/test';
import {
  injectAuth,
  mockRemainingPbCalls,
  mockHouseholdsApi,
  mockSettingsMembersApi,
  mockExpensesApi,
  mockSettlementsApi,
  MOCK_HOUSEHOLD_ID,
  MOCK_MEMBER_ID,
  MOCK_MEMBER_ID_2,
  type MockExpense,
  type MockSettlement,
} from './helpers/auth';

const PB_URL = 'http://pb.home-planner.localhost';

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

const MOCK_SETTLEMENT: MockSettlement = {
  id: 'settlement-1',
  household_id: MOCK_HOUSEHOLD_ID,
  member_a_id: MOCK_MEMBER_ID,
  member_b_id: MOCK_MEMBER_ID_2,
  settled_at: '2026-06-10 00:00:00.000Z',
  created: '2026-06-10 00:00:00.000Z',
  updated: '2026-06-10 00:00:00.000Z',
};

async function setupBase(page: Page) {
  await injectAuth(page);
  await mockRemainingPbCalls(page);
  await mockHouseholdsApi(page);
  await page.route(`${PB_URL}/api/realtime*`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      headers: { 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
      body: 'event: PB_CONNECT\ndata: {"clientId":"test-client"}\n\n',
    })
  );
}

test('settlement state persists across page reload', async ({ page }) => {
  await test.step('set up mocks: Bob expense, existing settlement', async () => {
    await setupBase(page);
    await mockSettingsMembersApi(page);
    // Bob's expense predates the settlement -> excluded from balance
    await mockExpensesApi(page, [BOB_EXPENSE]);
    // Load with an existing settlement already present
    await mockSettlementsApi(page, [MOCK_SETTLEMENT]);
    await page.goto('/finances');
    await page.waitForLoadState('networkidle');
  });

  await test.step('balance is zero - pre-settlement expense is excluded', async () => {
    await expect(page.getByRole('button', { name: 'Settle up' })).toHaveCount(0);
    await expect(page.getByText('All settled')).toBeVisible();
  });

  await test.step('reload page - re-register mocks so server returns same settlement', async () => {
    await mockExpensesApi(page, [BOB_EXPENSE]);
    await mockSettlementsApi(page, [MOCK_SETTLEMENT]);
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  await test.step('settled state persists after reload', async () => {
    await expect(page.getByRole('button', { name: 'Settle up' })).toHaveCount(0);
    await expect(page.getByText('All settled')).toBeVisible();
  });
});

test('new post-settlement expense resurfaces non-zero balance', async ({ page }) => {
  await test.step('set up mocks: settlement exists, then new expense added', async () => {
    await setupBase(page);
    await mockSettingsMembersApi(page);
    await mockExpensesApi(page, [BOB_EXPENSE]);
    await mockSettlementsApi(page, [MOCK_SETTLEMENT]);
    await page.goto('/finances');
    await page.waitForLoadState('networkidle');
  });

  await test.step('initially settled state is shown', async () => {
    await expect(page.getByRole('button', { name: 'Settle up' })).toHaveCount(0);
    await expect(page.getByText('All settled')).toBeVisible();
  });

  await test.step('reload with new post-settlement expense', async () => {
    const postSettlementExpense: MockExpense = {
      ...BOB_EXPENSE,
      id: 'exp-post',
      created: '2026-06-11 00:00:00.000Z', // after MOCK_SETTLEMENT.settled_at
      date: '2026-06-11 00:00:00.000Z',
    };
    // Re-mock to include the new expense
    await mockExpensesApi(page, [BOB_EXPENSE, postSettlementExpense]);
    await mockSettlementsApi(page, [MOCK_SETTLEMENT]);
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  await test.step('Settle up button reappears - post-settlement expense is included', async () => {
    await expect(page.getByRole('button', { name: 'Settle up' })).toBeVisible();
  });
});

test('member who joined after expenses sees zero balance', async ({ page }) => {
  await test.step('set up mocks: existing expense predates Bob join date', async () => {
    await setupBase(page);
    // Override members: Bob joined AFTER BOB_EXPENSE.created
    await page.route(`${PB_URL}/api/collections/members/records*`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          page: 1,
          perPage: 30,
          totalItems: 2,
          totalPages: 1,
          items: [
            {
              id: MOCK_MEMBER_ID,
              household_id: MOCK_HOUSEHOLD_ID,
              user_id: 'smoke-user-id',
              role: 'admin',
              display_name: '',
              expand: {
                user_id: {
                  id: 'smoke-user-id',
                  name: 'Smoke User',
                  username: 'smokeuser',
                  email: 'smoke@test.local',
                },
              },
              created: '2026-01-01 00:00:00.000Z',
              updated: '2026-01-01 00:00:00.000Z',
            },
            {
              id: MOCK_MEMBER_ID_2,
              household_id: MOCK_HOUSEHOLD_ID,
              user_id: 'smoke-user-id-2',
              role: 'member',
              display_name: 'Bob',
              expand: {
                user_id: {
                  id: 'smoke-user-id-2',
                  name: 'Bob',
                  username: 'bob',
                  email: 'bob@test.local',
                },
              },
              // Bob joined AFTER the expense was created (2026-06-09)
              created: '2026-06-20 00:00:00.000Z',
              updated: '2026-06-20 00:00:00.000Z',
            },
          ],
        }),
      })
    );
    await mockExpensesApi(page, [BOB_EXPENSE]);
    await mockSettlementsApi(page, []);
    await page.goto('/finances');
    await page.waitForLoadState('networkidle');
  });

  await test.step('balance is zero - Bob joined after his own expense was created', async () => {
    await expect(page.getByRole('button', { name: 'Settle up' })).toHaveCount(0);
  });
});

test('viewer who joined after expenses sees zero balance', async ({ page }) => {
  await test.step('set up mocks: existing expense predates viewer join date', async () => {
    await setupBase(page);
    // Override members: Alice (the viewer, MOCK_MEMBER_ID) joined AFTER BOB_EXPENSE.created
    await page.route(`${PB_URL}/api/collections/members/records*`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          page: 1,
          perPage: 30,
          totalItems: 2,
          totalPages: 1,
          items: [
            {
              id: MOCK_MEMBER_ID,
              household_id: MOCK_HOUSEHOLD_ID,
              user_id: 'smoke-user-id',
              role: 'admin',
              display_name: '',
              expand: {
                user_id: {
                  id: 'smoke-user-id',
                  name: 'Smoke User',
                  username: 'smokeuser',
                  email: 'smoke@test.local',
                },
              },
              // Alice (the viewer) joined AFTER the expense was created (2026-06-09)
              created: '2026-06-20 00:00:00.000Z',
              updated: '2026-06-20 00:00:00.000Z',
            },
            {
              id: MOCK_MEMBER_ID_2,
              household_id: MOCK_HOUSEHOLD_ID,
              user_id: 'smoke-user-id-2',
              role: 'member',
              display_name: 'Bob',
              expand: {
                user_id: {
                  id: 'smoke-user-id-2',
                  name: 'Bob',
                  username: 'bob',
                  email: 'bob@test.local',
                },
              },
              created: '2026-01-01 00:00:00.000Z',
              updated: '2026-01-01 00:00:00.000Z',
            },
          ],
        }),
      })
    );
    await mockExpensesApi(page, [BOB_EXPENSE]);
    await mockSettlementsApi(page, []);
    await page.goto('/finances');
    await page.waitForLoadState('networkidle');
  });

  await test.step('balance is zero - Alice joined after Bob paid, so the expense is excluded', async () => {
    await expect(page.getByRole('button', { name: 'Settle up' })).toHaveCount(0);
  });
});
