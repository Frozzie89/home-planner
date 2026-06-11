# Contributing to Home Planner

Thank you for your interest in Home Planner.

**This project is not yet actively seeking external contributions.** It is in early development and the architecture is still evolving. Pull requests from outside contributors may not be reviewed promptly.

That said, bug reports and feature requests are genuinely welcome. Opening an issue is the best way to contribute right now.

---

## Reporting bugs

Use the [bug report template](../../issues/new?template=bug_report.md). Please include:

- What you did
- What you expected to happen
- What actually happened
- Your deployment method (Docker / dev mode) and browser
- Relevant error logs (browser console, Docker container logs)

## Requesting features

Use the [feature request template](../../issues/new?template=feature_request.md). Describe the problem you're trying to solve, not just the solution you have in mind.

---

## For future contributors

When this project opens up to contributions, the following will apply.

### Prerequisites

- Node.js 20+
- A PocketBase instance (see [development guide](docs/development.md))

### Branching

- Branch from `main`
- Name branches: `feat/short-description`, `fix/short-description`

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

---

## Code of Conduct

All participants are expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
