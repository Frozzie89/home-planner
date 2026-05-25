# CI Pipeline

The CI pipeline runs on every push to `main` and every pull request targeting `main`. It is defined in `.github/workflows/ci.yml` and consists of two jobs: **validate** and **smoke**.

---

## Running Each Check Locally

### Build

```bash
cd frontend
npm run build
```

Runs `vue-tsc --build` (type check) and `vite build` in parallel. Fails if TypeScript reports errors or Vite cannot bundle the app.

### Unit Tests

```bash
cd frontend
npm run test
```

Runs Vitest in watch mode (add `--run` for a single pass). Test files match `src/**/*.test.ts` and run in a jsdom environment.

### Playwright Smoke Tests

Before running E2E tests locally, build the app first (Playwright serves the pre-built `dist/`):

```bash
cd frontend
npm run build
npm run test:e2e
```

On first run, install the Chromium browser binary:

```bash
cd frontend
npx playwright install chromium
```

To open the Playwright HTML report after a run:

```bash
cd frontend
npx playwright show-report
```

---

## What Each Gate Validates

### Gate 1 — Build & Unit Tests (`validate` job)

| Step | What it checks |
|------|---------------|
| `npm run build` | TypeScript types are valid; the app bundles without errors |
| `npm run test` | All Vitest unit tests pass; no regressions in stores, composables, or components |

The built `dist/` folder is uploaded as a GitHub Actions artifact so the `smoke` job can serve it without rebuilding.

### Gate 2 — Playwright Smoke Tests (`smoke` job)

Runs after `validate` succeeds (`needs: validate`). Downloads `dist/`, installs Chromium with OS dependencies, then runs three smoke tests:

| Test file | View tested | What it validates |
|-----------|-------------|-------------------|
| `e2e/auth-view.spec.ts` | `/auth` | Page renders; no WCAG 2.1 AA violations |
| `e2e/household-setup.spec.ts` | `/setup` | Page renders with injected auth (no household); no WCAG 2.1 AA violations |
| `e2e/finances.spec.ts` | `/finances` | Page renders with injected auth + mocked API; no WCAG 2.1 AA violations |

All smoke tests use `page.addInitScript` to inject a fake JWT into localStorage (no live PocketBase needed) and `page.route` to intercept PocketBase API calls. CI is entirely backend-free.

Browser target: **Chromium only**.

---

## Interpreting and Fixing axe-core Violations

Each smoke test calls `injectAxe(page)` then `checkA11y(page)` from `@axe-core/playwright`. A violation causes the test to fail with output like:

```
Error: Found 1 accessibility violation(s):
  1. color-contrast (serious): Elements must have sufficient color contrast
     Elements: .my-button
     Help: https://dequeuniversity.com/rules/axe/4.x/color-contrast
```

### Reading the output

- **Rule ID** (e.g. `color-contrast`) — identifies which WCAG criterion failed
- **Impact** — `critical`, `serious`, `moderate`, `minor`
- **Elements** — CSS selector for the offending DOM node
- **Help URL** — links to Deque's explanation with fix guidance

### Fixing violations

1. Open the failing test locally: `npm run test:e2e`
2. Use `npx playwright show-report` to view the HTML report and screenshot
3. Inspect the element flagged by axe in browser DevTools
4. Apply the fix (e.g. increase contrast ratio, add `aria-label`, fix heading order)
5. Re-run `npm run test:e2e` to confirm the violation is resolved

### Suppressing false positives (use sparingly)

If a PrimeVue component triggers a false positive that cannot be fixed at source, add a targeted rule exclusion to that specific test only:

```typescript
await checkA11y(page, undefined, {
  runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
  rules: { 'color-contrast': { enabled: false } }, // document why this is a false positive
})
```

Do not disable rules globally. Document the reason inline.

---

## Branch Protection Setup

After the first successful pipeline run, enable branch protection on `main`:

1. Go to **Repository Settings → Branches → Add rule**
2. Branch name pattern: `main`
3. Enable **"Require status checks to pass before merging"**
4. Add required checks:
   - `Build & Unit Tests`
   - `Playwright Smoke Tests`
5. Enable **"Require branches to be up to date before merging"**
6. Save the rule

These check names match the `name:` fields in `.github/workflows/ci.yml`.
