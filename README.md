# Home Planner

A simple home planner web app to manage chores, tasks, and shared responsibilities.
Built for personal use, with a focus on being lightweight, easy to use, and self-hostable.

![CI](../../actions/workflows/ci.yml/badge.svg)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)

---

## Features

- **Expense tracking** : log shared expenses, track balances, and settle up between members
- **Food planner** : plan meals and manage a shared grocery list *(not yet implemented)*
- **Member management** : invitation-only household, user profiles and avatars
- **Self-hostable** : runs as two Docker containers behind Traefik

... and more to come


## Requirements

| Tool | Version | Context |
|------|---------|---------|
| Docker | 24+ | Docker setup |
| Docker Compose | v2 | Docker setup |
| Node.js | 20+ | Local dev |
| PocketBase | 0.27.x | Local dev |

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vue 3, Vite, TypeScript, Pinia, PrimeVue |
| Backend | PocketBase 0.27 (embedded SQLite + auth + realtime) |
| Reverse proxy | Traefik v3 |

## Quick start (Docker)

```sh
cp .env.example .env
# Edit .env et set environment keys
docker compose up -d
```

Then open `http://<FRONTEND_HOST>` in your browser.

On first load you will be prompted to configure an OAuth2 provider in PocketBase and create the household.

### Environment variables

Copy `.env.example` to `.env` and adjust as needed. The frontend has its own `frontend/.env.example`.

## Local development

```sh
# 1. Download and place the PocketBase binary in the pocketbase/ directory

# 2. Start PocketBase
cd pocketbase
./pocketbase serve --hooksDir pb_hooks --migrationsDir pb_migrations

# 3. Start the frontend
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

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Bug reports, feature requests, and pull requests are welcome via [GitHub Issues](../../issues).
