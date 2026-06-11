import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

const PB_URL = 'http://pb.home-planner.localhost';

// The invite-accept route is public and clears any existing auth on mount,
// so no injectAuth or members mocks are needed.

test('invite-accept view shows error for an invalid or expired token', async ({ page }) => {
  await test.step('Mock invite endpoint to return 404', async () => {
    await page.route(`${PB_URL}/api/invite/*`, (route) =>
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ code: 404, message: 'Not found.', data: {} }),
      })
    );
  });

  await test.step('Navigate to invite URL and verify error message', async () => {
    await page.goto('/invite/invalid-token-abc123');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/invalid or has already been used/)).toBeVisible();
  });
});

test('invite-accept error state renders without WCAG 2.1 AA violations', async ({ page }) => {
  await test.step('Mock invite endpoint to return 404', async () => {
    await page.route(`${PB_URL}/api/invite/*`, (route) =>
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ code: 404, message: 'Not found.', data: {} }),
      })
    );
  });

  await test.step('Navigate to /invite/invalid-token-abc123', async () => {
    await page.goto('/invite/invalid-token-abc123');
    await page.waitForLoadState('networkidle');
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

test('invite-accept view shows household name for a valid token', async ({ page }) => {
  await test.step('Mock valid invite and auth methods endpoints', async () => {
    await page.route(`${PB_URL}/api/invite/*`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ householdName: 'The Smith Family' }),
      })
    );
    // PocketBase SDK appends ?fields=... so use wildcard suffix
    await page.route(`${PB_URL}/api/collections/users/auth-methods*`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          emailPassword: { enabled: false },
          mfa: { enabled: false },
          oauth2: {
            enabled: true,
            providers: [
              {
                name: 'google',
                displayName: 'Google',
                state: 'test-state',
                codeVerifier: 'test-verifier',
                authURL: 'https://accounts.google.com/o/oauth2/auth',
              },
            ],
          },
        }),
      })
    );
  });

  await test.step('Navigate to /invite/valid-token-xyz789', async () => {
    await page.goto('/invite/valid-token-xyz789');
    await page.waitForLoadState('networkidle');
  });

  await test.step('Verify household name and sign-in button are shown', async () => {
    await expect(page.getByText('The Smith Family')).toBeVisible();
    await expect(page.getByRole('button', { name: /Sign in with Google to join/i })).toBeVisible();
  });
});

test('invite-accept valid state renders without WCAG 2.1 AA violations', async ({ page }) => {
  await test.step('Mock valid invite and auth methods endpoints', async () => {
    await page.route(`${PB_URL}/api/invite/*`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ householdName: 'The Smith Family' }),
      })
    );
    // PocketBase SDK appends ?fields=... so use wildcard suffix
    await page.route(`${PB_URL}/api/collections/users/auth-methods*`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          emailPassword: { enabled: false },
          mfa: { enabled: false },
          oauth2: {
            enabled: true,
            providers: [
              {
                name: 'google',
                displayName: 'Google',
                state: 'test-state',
                codeVerifier: 'test-verifier',
                authURL: 'https://accounts.google.com/o/oauth2/auth',
              },
            ],
          },
        }),
      })
    );
  });

  await test.step('Navigate to /invite/valid-token-xyz789', async () => {
    await page.goto('/invite/valid-token-xyz789');
    await page.waitForLoadState('networkidle');
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
