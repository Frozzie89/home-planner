import { test, expect, type Page } from '@playwright/test';
import {
  injectAuth,
  mockRemainingPbCalls,
  mockHouseholdsApi,
  mockSettingsMembersApi,
  mockExpensesApi,
  MOCK_HOUSEHOLD_ID,
  MOCK_MEMBER_ID,
  MOCK_MEMBER_ID_2,
  type MockExpense,
} from './helpers/auth';

const PB_URL = 'http://pb.home-planner.localhost';

const EXISTING_EXPENSE: MockExpense = {
  id: 'exp-existing',
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
  id: 'exp-bob-new',
  household_id: MOCK_HOUSEHOLD_ID,
  member_id: MOCK_MEMBER_ID_2,
  title: 'Pizza Night',
  amount: 2400,
  portion: 50,
  date: '2026-06-10 00:00:00.000Z',
  created: '2026-06-10 00:00:00.000Z',
  updated: '2026-06-10 00:00:00.000Z',
};

async function setupMocks(page: Page) {
  await injectAuth(page);
  await mockRemainingPbCalls(page);
  await mockHouseholdsApi(page);
  await mockSettingsMembersApi(page);
  await mockExpensesApi(page, [EXISTING_EXPENSE]);
  // Intercept SSE realtime endpoint - return a minimal connect event and keep open
  await page.route(`${PB_URL}/api/realtime*`, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      headers: { 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
      body: 'event: PB_CONNECT\ndata: {"clientId":"test-client"}\n\n',
    });
  });
}

async function injectSSEEvent(page: Page, action: string, record: MockExpense | { id: string }) {
  await page.evaluate(
    ({ action, record }) => {
      const appEl = document.querySelector('#app') as HTMLElement & {
        __vue_app__?: {
          config?: {
            globalProperties?: {
              $pinia?: { _s?: Map<string, { applySSEEvent?: (a: string, r: unknown) => void }> };
            };
          };
        };
      };
      const store = appEl?.__vue_app__?.config?.globalProperties?.$pinia?._s?.get('finances');
      store?.applySSEEvent?.(action, record);
    },
    { action, record }
  );
}

// 3.4-E1: New expense from another member appears after SSE create
test('expense list updates when SSE create event is injected', async ({ page }) => {
  await test.step('set up mocks and navigate to finances', async () => {
    await setupMocks(page);
    await page.goto('/finances');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Groceries')).toBeVisible();
  });

  await test.step("inject SSE create event for Bob's new expense", async () => {
    await injectSSEEvent(page, 'create', BOB_EXPENSE);
  });

  await test.step('Pizza Night appears in the expense list', async () => {
    await expect(page.getByText('Pizza Night')).toBeVisible();
  });
});

// 3.4-E2: Balance updates when SSE create event injected
test('balance updates when SSE create event is injected', async ({ page }) => {
  let initialAriaLabel = '';

  await test.step('set up mocks and navigate to finances', async () => {
    await setupMocks(page);
    await page.goto('/finances');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Groceries')).toBeVisible();
    initialAriaLabel = (await page.locator('.slim-amt').getAttribute('aria-label')) ?? '';
  });

  await test.step("inject SSE create event for Bob's expense", async () => {
    await injectSSEEvent(page, 'create', BOB_EXPENSE);
  });

  await test.step('balance aria-label reflects the updated computed amount', async () => {
    await expect(page.locator('.slim-amt')).not.toHaveAttribute('aria-label', initialAriaLabel);
  });
});

// 3.4-E3: Expense disappears from list after SSE delete event
test('expense disappears from list after SSE delete event', async ({ page }) => {
  await test.step('set up mocks and navigate to finances', async () => {
    await setupMocks(page);
    await page.goto('/finances');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Groceries')).toBeVisible();
  });

  await test.step('inject SSE delete event for the existing expense', async () => {
    await injectSSEEvent(page, 'delete', EXISTING_EXPENSE);
  });

  await test.step('Groceries is removed and empty state appears', async () => {
    await expect(page.getByText('Groceries')).not.toBeVisible();
    await expect(page.getByText('Nothing here yet')).toBeVisible();
  });
});
