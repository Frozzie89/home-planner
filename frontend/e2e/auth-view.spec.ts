import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

test('auth view renders without WCAG 2.1 AA violations', async ({ page }) => {
  // No auth injection needed  - /auth is meta: { public: true }
  await page.goto('/auth');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: 'Home Planner' })).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations).toEqual([]);
});
