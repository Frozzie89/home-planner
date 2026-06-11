# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Commit messages follow the [Conventional Commits](https://www.conventionalcommits.org/) convention.

## [Unreleased]

### Added
- Settle-up flow: calculate and record debt settlements between household members
- Real-time expense sync via SSE with animated balance updates
- Expense list with inline edit and delete, sorted by date
- Add expense form with amount cap and validation
- Finances view with per-member balance display
- Household settings: member management, leave household, delete household
- User profile: display name and avatar upload
- Invitation-only join flow with admin-generated invite links
- Household setup wizard for first-time deployment
- OAuth2 authentication (PocketBase-managed)
- Navigation bar with module switching
- Docker + Traefik deployment configuration
- GitHub Actions CI pipeline (build, unit tests, Playwright smoke tests)
