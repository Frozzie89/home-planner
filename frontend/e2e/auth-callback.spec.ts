import { test, expect } from '@playwright/test';
import {
  mockRemainingPbCalls,
  mockMembersApi,
  mockAuthMethodsApi,
  mockOAuth2CodeExchange,
  mockHouseholdExistsApi,
  mockHouseholdsApi,
  injectOAuthProviderSession,
  OAUTH_TEST_STATE,
} from './helpers/auth';

const PB_URL = 'http://pb.home-planner.localhost';

// code is opaque to the client; state must match what injectOAuthProviderSession put in sessionStorage
const CALLBACK_PARAMS = `code=test-auth-code&state=${OAUTH_TEST_STATE}`;

test('oauth2 callback: registered member is redirected to /finances', async ({ page }) => {
  await test.step('Set up mocks - authenticated user with household membership', async () => {
    await injectOAuthProviderSession(page);
    await mockRemainingPbCalls(page);
    await page.route(`${PB_URL}/api/collections/expenses/records*`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ page: 1, perPage: 30, totalItems: 0, totalPages: 0, items: [] }),
      })
    );
    await mockHouseholdsApi(page); // router guard calls householdStore.load() after OAuth2 success
    await mockOAuth2CodeExchange(page);
    await mockMembersApi(page, true); // returns member record -> authStore.householdId is set
  });

  await test.step('Navigate to /auth with OAuth2 callback params', async () => {
    await page.goto(`/auth?${CALLBACK_PARAMS}`);
    await page.waitForLoadState('networkidle');
  });

  await test.step('Verify redirect to /finances', async () => {
    await expect(page).toHaveURL(/\/finances/);
  });
});

test('oauth2 callback: unregistered user sees not-registered message on /auth', async ({
  page,
}) => {
  await test.step('Set up mocks - authenticated user with no household membership', async () => {
    await injectOAuthProviderSession(page);
    await mockRemainingPbCalls(page);
    // auth-methods needed because AuthView calls loadProviders() after rejecting the session
    await mockAuthMethodsApi(page);
    await mockOAuth2CodeExchange(page);
    await mockMembersApi(page, false); // 404 -> householdId = null
    await mockHouseholdExistsApi(page, true); // household exists -> path 3: reject and redirect
  });

  await test.step('Navigate to /auth with OAuth2 callback params', async () => {
    await page.goto(`/auth?${CALLBACK_PARAMS}`);
    await page.waitForLoadState('networkidle');
  });

  await test.step('Verify URL updated to /auth?error=not_registered', async () => {
    await expect(page).toHaveURL(/\/auth.*error=not_registered/);
  });

  await test.step('Verify not-registered message and sign-in button are shown', async () => {
    await expect(page.getByText(/isn't linked to this household/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Sign in with Google/i })).toBeVisible();
  });
});

test('oauth2 callback: new user on an instance with no household is redirected to /setup', async ({
  page,
}) => {
  await test.step('Set up mocks - authenticated user, no household exists on instance', async () => {
    await injectOAuthProviderSession(page);
    await mockRemainingPbCalls(page);
    await mockOAuth2CodeExchange(page);
    await mockMembersApi(page, false); // 404 -> householdId = null
    await mockHouseholdExistsApi(page, false); // no household -> path 1: bootstrapper flow
  });

  await test.step('Navigate to /auth with OAuth2 callback params', async () => {
    await page.goto(`/auth?${CALLBACK_PARAMS}`);
    await page.waitForLoadState('networkidle');
  });

  await test.step('Verify redirect to /setup', async () => {
    await expect(page).toHaveURL(/\/setup/);
  });
});

test('/auth?error=not_registered loaded directly shows message and sign-in form', async ({
  page,
}) => {
  await test.step('Set up auth-methods mock', async () => {
    await mockRemainingPbCalls(page);
    await mockAuthMethodsApi(page);
  });

  await test.step('Navigate directly to /auth?error=not_registered', async () => {
    await page.goto('/auth?error=not_registered');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/auth/);
  });

  await test.step('Verify not-registered message and sign-in button are shown', async () => {
    await expect(page.getByText(/isn't linked to this household/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Sign in with Google/i })).toBeVisible();
  });
});
