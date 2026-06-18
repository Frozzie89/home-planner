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

## How to use Home Planner

Each [GitHub Release](../../releases/latest) ships a ready-to-use `compose.yml` with
pinned image tags and an `.env.example`. Images are pulled from Docker Hub. No build step needed.

1. Download `compose.yml` and `.env.example` from the [latest release](../../releases/latest).
2. Configure your environment:
   ```sh
   cp .env.example .env
   # Set FRONTEND_HOST and POCKETBASE_HOST to your actual domains
   ```
3. Start the stack:
   ```sh
   docker compose up -d
   ```
4. Open `http://<FRONTEND_HOST>` in your browser and follow the first-run setup
   (OAuth2 provider configuration + household creation).

## Local development

### Using Docker

```sh
cp .env.example .env                  # set FRONTEND_HOST and POCKETBASE_HOST
cp frontend/.env.example frontend/.env  # optional - set VITE_PB_URL if needed
docker compose up -d
```

### Manual

A dev container is available for VS Code and GitHub Codespaces (`.devcontainer/`). It installs Node.js, PocketBase 0.27, and the recommended extensions automatically. If you use it, skip the PocketBase download below.

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

See [CONTRIBUTING.md](CONTRIBUTING.md). 

Bug reports, feature requests, and pull requests are welcome via [GitHub Issues](../../issues).
