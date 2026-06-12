# Contributing to Home Planner

Thank you for your interest in Home Planner. Contributions are welcome.

If you want to submit code, **fork the repository** and open a pull request targeting the `dev` branch. Direct pushes to `dev` or `main` are not available to non-maintainers. Pull requests to `main` from non-maintainers will not be accepted - `main` is a release-only branch managed by code owners.

## Reporting bugs

Use the [bug report template](../../issues/new?template=bug_report.md). Please include:

- What you did
- What you expected to happen
- What actually happened
- Your deployment method (Docker / dev mode) and browser
- Relevant error logs (browser console, Docker container logs)

## Requesting features

Use the [feature request template](../../issues/new?template=feature_request.md). Describe the problem you're trying to solve, not just the solution you have in mind.

## For contributors

### Prerequisites

- Node.js 20+
- A PocketBase instance (see the [Quick start](../README.md#quick-start-docker) and [Local development](../README.md#local-development) sections in the README)
- Familiarity with the [architecture](../docs/architecture.md) is recommended before making changes

### Branching

- Branch from `dev`
- Name branches: `feat/short-description`, `fix/short-description`
- `dev` is the integration branch - all feature work merges here
- `main` is release-only; merges to `main` require code owner approval (see [CODEOWNERS](.github/CODEOWNERS)) and are only done to cut a release

### Commits

Follow [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix | When to use |
|--------|------------|
| `feat:` | A new user-facing feature |
| `fix:` | A bug fix |
| `refactor:` | Code restructuring with no behaviour change |
| `style:` | Formatting, whitespace, cosmetic changes only |
| `test:` | Adding or updating tests |
| `chore:` | Dependency updates, tooling, config changes |
| `ci:` | Changes to the CI pipeline |
| `docs:` | Documentation only |

### Testing

Every change must pass:

```sh
cd frontend
npm run test          # unit tests
npm run test:e2e      # Playwright smoke tests
```

New features require new E2E tests covering the happy path.

### Pull requests

- Keep PRs focused - one logical change per PR
- Fill in the PR template
- Link the related issue

### Code style

The project uses TypeScript with Vue 3 Composition API and enforces formatting with [Prettier](https://prettier.io/).

Before committing, format your changes:

```sh
cd frontend
npm run format
```

To check formatting without writing:

```sh
cd frontend
npm run format:check
```

The CI pipeline runs `format:check` on every push and pull request. Unformatted code will fail the build.

Key Prettier settings (see `frontend/.prettierrc.json`): single quotes, semicolons, 100-character print width, 2-space indent, trailing commas where valid in ES5.

## Code of Conduct

All participants are expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
