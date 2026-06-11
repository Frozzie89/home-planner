# Home Planner

A simple home planner web app to manage chores, tasks, and shared responsibilities.
Built for personal use, with a focus on being lightweight, easy to use, and self-hostable.

![CI](../../actions/workflows/ci.yml/badge.svg)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)

---

## Features

- **Expense tracking** : log shared expenses, track balances, and settle up between members
- **Member management** : invitation-only household, user profiles and avatars
- **Food planner** : plan meals and manage a shared grocery list *(not yet implemented)*
- **Self-hostable** : runs as two Docker containers behind Traefik

... and more to come


## Requirements

| Tool | Version |
|------|---------|
| Docker | 24+ |
| Docker Compose | v2 |

For local development without Docker: Node.js 20+ and a PocketBase binary.


## Quick start (Docker)

```sh
git clone <repo-url>
cd home-planner
cp .env.example .env
# Edit .env et set environment keys
docker compose up -d
```

Then open `http://<FRONTEND_HOST>` in your browser.

On first load you will be prompted to configure an OAuth2 provider in PocketBase and create the household.

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `FRONTEND_HOST` | `home-planner.localhost` | Hostname for the Vue frontend |
| `POCKETBASE_HOST` | `pb.home-planner.localhost` | Hostname for the PocketBase API |

The frontend also has its own `frontend/.env.example` with `VITE_PB_URL`.


## Local development

```sh
# 1. Start PocketBase
cd pocketbase
docker build -t home-planner-pb .
docker run -p 8090:8090 home-planner-pb

# 2. Start the frontend
cd frontend
cp .env.example .env      # set VITE_PB_URL=http://localhost:8090
npm install
npm run dev
```

### Tests

```sh
cd frontend
npm run test          # Vitest unit tests
npm run test:e2e      # Playwright smoke tests
```


## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vue 3, Vite, TypeScript, Pinia, PrimeVue |
| Backend | PocketBase 0.27 (embedded SQLite + auth + realtime) |
| Reverse proxy | Traefik v3 |
| Frontend server | Nginx (inside Docker) |
| CI | GitHub Actions |


## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The project is not yet actively seeking pull requests, but bug reports and feature requests are welcome via [GitHub Issues](../../issues).


## License

[GNU Affero General Public License v3.0](LICENSE)
