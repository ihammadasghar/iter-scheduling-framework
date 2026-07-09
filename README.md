# iter-scheduling-framework

> A **"Git-flow" decision support system** for university timetable management. Users branch off the official schedule to simulate changes, submit proposals as Pull Requests, and a CI pipeline validates them for hard constraint violations before an Admin merges them.

![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)
![Express](https://img.shields.io/badge/Express-5-lightgrey)
![Memgraph](https://img.shields.io/badge/Memgraph-openCypher-orange)
![pnpm](https://img.shields.io/badge/pnpm-package--manager-yellow)

---

## Overview

The system stores the university schedule as a flat JSON file (`schedule.json`) in a GitHub repository. Users create isolated simulation branches, edit class assignments with live conflict checking, then submit their changes as Pull Requests. An automated CI pipeline hydrates the schedule into an in-memory [Memgraph](https://memgraph.com) graph database, runs Cypher conflict queries, and labels the PR as `ci:ready` or `ci:blocked` before an Admin can merge.

For full architecture, design decisions, and a deep-dive into the codebase, see [ONBOARDING.md](./ONBOARDING.md).

---

## Quick Start

```bash
# 1. Install all dependencies (backend + frontend)
make install

# 2. Configure the backend environment
cp backend/.env.example backend/.env
# Edit backend/.env — fill in GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO

# 3. Start everything (Memgraph + backend + frontend)
make dev
```

| Service | URL |
|---|---|
| Backend API | http://localhost:3000 |
| Frontend | http://localhost:5173 |

> **Prerequisite:** You need a separate GitHub repository containing `schedule.json` and `rules.json` on `main`. See [ONBOARDING.md §2 — Schedule Repository Setup](./ONBOARDING.md) for the one-time setup.

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| **Node.js** | ≥ 22 | [nodejs.org](https://nodejs.org) |
| **pnpm** | any | `npm i -g pnpm` |
| **Docker** | any | [docs.docker.com](https://docs.docker.com/get-docker/) |
| **make** | any | Pre-installed on macOS/Linux; Windows: use WSL or [GnuWin32](http://gnuwin32.sourceforge.net/packages/make.htm) |
| **GitHub PAT** | — | [Settings → Developer settings → Tokens](https://github.com/settings/tokens) — needs `repo` scope |

---

## Development Commands

| Command | Description |
|---|---|
| `make install` | Install all dependencies (backend + frontend) |
| `make dev` | Start Memgraph, backend, and frontend in parallel |
| `make dev-backend` | Start backend dev server only |
| `make dev-frontend` | Start frontend dev server only |
| `make test` | Run all tests once |
| `make test-watch` | Run all tests in watch mode |
| `make test-coverage` | Run tests with coverage reports |
| `make lint` | Type-check both workspaces (`tsc --noEmit`) |
| `make check` | Full pre-commit check (lint + tests) |
| `make build` | Compile backend + build frontend bundle |
| `make clean` | Remove all build artifacts and `node_modules` |

You can also run workspace-specific commands directly:

```bash
# Backend
cd backend && pnpm vitest run -t "<test name>"   # Run a single test
cd backend && pnpm lint                          # Type-check only

# Frontend
cd frontend && pnpm vitest run -t "<test name>"
cd frontend && pnpm lint
```

---

## Project Structure

```
iter-scheduling-framework/
├── Makefile             # Unified dev commands
├── docker-compose.yml   # Memgraph infrastructure
├── ONBOARDING.md        # Full architecture, API reference, design patterns
├── AGENTS.md            # Code conventions for contributors
├── docs/                # Design documents and OpenAPI spec
├── backend/             # Node.js + Express API (TypeScript)
│   ├── .env.example
│   └── src/
│       ├── app.ts             # Express app factory
│       ├── container.ts       # Dependency injection wiring
│       ├── controllers/       # HTTP request handlers
│       ├── services/          # Business logic
│       ├── interfaces/        # TypeScript contracts for all services
│       ├── routes/            # Express routers
│       ├── sessions/          # Session registry + garbage collector
│       ├── clients/           # Memgraph Bolt client
│       ├── middleware/        # Error handler, 404 handler
│       ├── types/             # Domain types, ApiError
│       └── utils/             # ScheduleHydrator, MetricRuleTranslator
└── frontend/            # React + MUI + Redux Toolkit (TypeScript)
    ├── .env.example
    └── src/
        ├── atoms/             # Single-responsibility UI primitives
        ├── molecules/         # Composed components
        ├── organisms/         # Complex sections with state
        ├── templates/         # Page layout shells
        ├── pages/             # Route components
        ├── hooks/             # Custom React hooks
        ├── services/          # Axios API wrappers
        ├── store/reducers/    # Redux slices
        ├── types/             # Shared TypeScript interfaces
        └── utils/             # Pure utility functions
```

---

## Documentation

| Document | Purpose |
|---|---|
| [ONBOARDING.md](./ONBOARDING.md) | Full architecture, workflows, API reference, design patterns |
| [docs/system-architecture.md](./docs/system-architecture.md) | High-level 3-layer architecture design |
| [docs/api-overview.md](./docs/api-overview.md) | API design decisions |
| [docs/graph-erd.md](./docs/graph-erd.md) | Memgraph node/edge model |
| [docs/schedule-schema.md](./docs/schedule-schema.md) | `schedule.json` schema design |
| [docs/sequence-diagram.md](./docs/sequence-diagram.md) | CI pipeline sequence diagram |
| [docs/openapi.yaml](./docs/openapi.yaml) | OpenAPI specification |

---

## Contributing

See [AGENTS.md](./AGENTS.md) for code conventions, commit message format, and PR guidelines.

Run `make check` before opening a PR.

