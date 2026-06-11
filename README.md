# iter-scheduling-framework

> A **"Git-flow" decision support system** for university timetable management. Users branch off the official schedule to simulate changes, submit proposals as Pull Requests, and a CI pipeline validates them for hard constraint violations before an Admin merges them.

![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)
![Express](https://img.shields.io/badge/Express-5-lightgrey)
![Memgraph](https://img.shields.io/badge/Memgraph-openCypher-orange)
![pnpm](https://img.shields.io/badge/pnpm-package--manager-yellow)

---

## Overview

The system stores the university schedule as a flat JSON file (`schedule.json`) in a GitHub repository. Users create isolated simulation branches, edit class assignments with live conflict checking, then submit their changes as Pull Requests. An automated CI pipeline hydrates the schedule into an in-memory [Memgraph](https://memgraph.com) graph database, runs Cypher conflict queries, and labels the PR as `ci:ready` or `ci:blocked` before an Admin can merge.

For full architecture, design decisions, and a deep-dive into the codebase, see [ONBOARDING.md](./ONBOARDING.md).

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| **Node.js** | ≥ 20 | [nodejs.org](https://nodejs.org) |
| **pnpm** | any | `npm i -g pnpm` |
| **Docker** | any | [docs.docker.com](https://docs.docker.com/get-docker/) |
| **GitHub PAT** | — | [GitHub → Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens) — needs `repo` scope |

---

## Local Setup

### Step 1 — Start Memgraph

Memgraph is the in-memory graph engine used for conflict checks and metric calculations. Run it with Docker:

```bash
docker run -d \
  --name memgraph \
  -p 7687:7687 \
  memgraph/memgraph
```

Verify it's up:

```bash
docker logs memgraph   # Should end with "Server startup was successful!"
```

> Memgraph runs with no authentication by default, which matches the `.env.example` defaults. No further configuration is needed for local development.

---

### Step 2 — Set Up the Schedule GitHub Repository

The API needs a dedicated GitHub repository that holds the `schedule.json` and `rules.json` files on its `main` branch. **This is a separate repo from this codebase.**

1. Create a new repository on GitHub (e.g., `my-university-schedule`). It can be private.

2. Add a starter `schedule.json` file to the `main` branch. You can use this minimal example:

```json
{
  "metadata": {
    "semesterId": "FALL_2026",
    "semesterName": "Fall Semester 2026",
    "academicYear": "2026-2027",
    "timeline": {
      "semesterStartDate": "2026-09-07",
      "semesterEndDate": "2026-12-18",
      "exclusionDates": []
    },
    "versioning": {
      "lastModifiedBy": "admin@university.edu",
      "lastModifiedAt": "2026-06-11T00:00:00Z",
      "schemaVersion": "1.0.0"
    }
  },
  "timeSlots": [
    { "id": "TS_MON_P1", "day": "Monday",    "name": "Period 1", "startTime": "08:30", "endTime": "10:15" },
    { "id": "TS_MON_P2", "day": "Monday",    "name": "Period 2", "startTime": "10:30", "endTime": "12:15" },
    { "id": "TS_TUE_P1", "day": "Tuesday",   "name": "Period 1", "startTime": "08:30", "endTime": "10:15" },
    { "id": "TS_WED_P1", "day": "Wednesday", "name": "Period 1", "startTime": "08:30", "endTime": "10:15" }
  ],
  "rooms": [
    { "id": "RM_101", "name": "Room 101", "capacity": 50, "building": "Science Hall" },
    { "id": "RM_102", "name": "Room 102", "capacity": 30, "building": "Arts Block" }
  ],
  "professors": [
    { "id": "PRF_SMITH", "name": "Dr. Jane Smith",   "department": "Biology" },
    { "id": "PRF_JONES", "name": "Prof. Alan Jones", "department": "History" }
  ],
  "studentGroups": [
    { "id": "GRP_BIO_Y1", "name": "Biology Year 1", "size": 45 },
    { "id": "GRP_HIS_Y1", "name": "History Year 1", "size": 25 }
  ],
  "courses": [
    { "id": "CRS_BIO101", "code": "BIO101", "name": "Intro to Biology", "department": "Biology" },
    { "id": "CRS_HIS201", "code": "HIS201", "name": "Modern History",   "department": "History" }
  ],
  "classes": [
    {
      "id": "CLS_00001",
      "courseId": "CRS_BIO101",
      "title": "Intro to Biology - Section A",
      "professorId": "PRF_SMITH",
      "studentGroupId": "GRP_BIO_Y1",
      "roomId": "RM_101",
      "timeSlotIds": ["TS_MON_P1"]
    },
    {
      "id": "CLS_00002",
      "courseId": "CRS_HIS201",
      "title": "Modern History - Section A",
      "professorId": "PRF_JONES",
      "studentGroupId": "GRP_HIS_Y1",
      "roomId": "RM_102",
      "timeSlotIds": ["TS_TUE_P1"]
    }
  ]
}
```

3. Add a `rules.json` file to the `main` branch (empty rules to start):

```json
{
  "metrics": [],
  "constraints": []
}
```

4. Note down the repository **owner** (your GitHub username or organisation) and **repository name** — you'll need them in the next step.

---

### Step 3 — Clone and Install

```bash
git clone https://github.com/ihammadasghar/iter-scheduling-framework.git
cd iter-scheduling-framework/backend
pnpm install
```

---

### Step 4 — Configure Environment

```bash
cp .env.example .env
```

Open `.env` and fill in the required values:

| Variable | Required | Default | What to put |
|---|---|---|---|
| `PORT` | No | `3000` | Port for the API server |
| `NODE_ENV` | No | `development` | Leave as `development` locally |
| `GITHUB_TOKEN` | **Yes** | — | Your GitHub PAT (needs `repo` scope) |
| `GITHUB_OWNER` | **Yes** | — | GitHub username / org that owns the schedule repo |
| `GITHUB_REPO` | **Yes** | — | Name of the schedule repo you created in Step 2 |
| `MEMGRAPH_URI` | No | `bolt://localhost:7687` | Leave as-is if using the Docker command from Step 1 |
| `MEMGRAPH_USERNAME` | No | `""` | Leave empty for local Memgraph (no auth) |
| `MEMGRAPH_PASSWORD` | No | `""` | Leave empty for local Memgraph (no auth) |
| `SESSION_TTL_MS` | No | `300000` | Session timeout in ms (5 minutes) |
| `GC_INTERVAL_MS` | No | `60000` | How often the session GC sweeps (1 minute) |

---

### Step 5 — Start the API

```bash
pnpm dev
```

The server starts on `http://localhost:3000`. Verify it's working:

```bash
# Create a simulation (branches main in your schedule repo + hydrates Memgraph)
curl -s -X POST http://localhost:3000/api/v1/simulations \
  -H "Content-Type: application/json" \
  -d '{"userId": "test-user"}' | jq .

# Expected response:
# {
#   "id": "sim-test-user-a1b2c3d4",
#   "branchId": "sim-test-user-a1b2c3d4",
#   "createdAt": "2026-06-11T..."
# }
```

---

## Development Commands

| Command | Description |
|---|---|
| `pnpm dev` | Start dev server with auto-restart (nodemon) |
| `pnpm build` | Compile TypeScript → `dist/` |
| `pnpm start` | Run compiled server (requires `pnpm build` first) |
| `pnpm test` | Run all tests in watch mode |
| `pnpm vitest run` | Run all tests once (CI mode) |
| `pnpm test:coverage` | Tests + coverage report |
| `pnpm vitest run -t "<name>"` | Run a single named test |
| `pnpm lint` | Type-check only (`tsc --noEmit`) |
| `pnpm lint && pnpm vitest run` | Full pre-commit check |

---

## Project Structure

```
iter-scheduling-framework/
├── ONBOARDING.md        # Full architecture, API reference, design patterns
├── AGENTS.md            # Code conventions for contributors
├── docs/                # Original design documents and diagrams
└── backend/             # Node.js + Express API
    ├── .env.example
    ├── src/
    │   ├── app.ts             # Express app factory
    │   ├── container.ts       # Dependency injection wiring
    │   ├── controllers/       # HTTP request handlers
    │   ├── services/          # Business logic
    │   ├── interfaces/        # TypeScript contracts for all services
    │   ├── routes/            # Express routers
    │   ├── sessions/          # Session registry + garbage collector
    │   ├── clients/           # Memgraph Bolt client
    │   ├── middleware/        # Error handler, 404 handler
    │   ├── types/             # Domain types, ApiError
    │   └── utils/             # ScheduleHydrator, MetricRuleTranslator
    └── ...
```

> A React + MUI frontend is planned but not yet implemented.

---

## Documentation

| Document | Purpose |
|---|---|
| [ONBOARDING.md](./ONBOARDING.md) | Full architecture, workflows, API reference, design patterns, known gaps |
| [docs/system-architecture.md](./docs/system-architecture.md) | High-level 3-layer architecture design |
| [docs/api-overview.md](./docs/api-overview.md) | API design decisions |
| [docs/graph-erd.md](./docs/graph-erd.md) | Memgraph node/edge model |
| [docs/schedule-schema.md](./docs/schedule-schema.md) | `schedule.json` schema design |
| [docs/sequence-diagram.md](./docs/sequence-diagram.md) | CI pipeline sequence diagram |
| [docs/openapi.yaml](./docs/openapi.yaml) | OpenAPI specification |

---

## Contributing

See [AGENTS.md](./AGENTS.md) for code conventions, commit message format, and PR guidelines.

All changes should pass `pnpm lint && pnpm vitest run` before opening a PR.
