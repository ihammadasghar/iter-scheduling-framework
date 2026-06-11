# Onboarding Guide — University Scheduling System

Welcome to the **University Scheduling System**. This document is the single source of truth for understanding the architecture, codebase, and workflows. Read it top to bottom once; bookmark it for reference.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Quick Start](#3-quick-start)
4. [Repository Structure](#4-repository-structure)
5. [Data Models](#5-data-models)
6. [API Reference](#6-api-reference)
7. [Key Workflows](#7-key-workflows)
8. [Session Management](#8-session-management)
9. [CI Pipeline](#9-ci-pipeline)
10. [Conflict Detection](#10-conflict-detection)
11. [Supported Metric Rules](#11-supported-metric-rules)
12. [Design Patterns](#12-design-patterns)
13. [Code Conventions](#13-code-conventions)
14. [Testing](#14-testing)
15. [Environment Variables](#15-environment-variables)
16. [Frontend Plans](#16-frontend-plans)
17. [Known Gaps / Not Yet Implemented](#17-known-gaps--not-yet-implemented)

---

## 1. Project Overview

The University Scheduling System is a **"Git-flow" decision support system** for academic timetable management.

### The Core Metaphor

| Git concept | Scheduling equivalent |
|---|---|
| Repository | The university's schedule |
| `main` branch | Official, published timetable |
| Feature branch | A user's sandbox simulation |
| Pull Request | A proposed timetable change |
| CI pipeline | Hard constraint validator |
| Merge | Admin publishes the new timetable |

Instead of editing a shared timetable directly (and risking double-bookings or cascading conflicts), users:

1. **Branch** off the official schedule into an isolated simulation.
2. **Edit** class assignments (room, timeslot, professor) with live conflict feedback.
3. **Commit** their changes back to their simulation branch.
4. **Propose** their changes — this triggers an automated CI check for hard constraint violations.
5. An **Admin** reviews and merges passing proposals into `main`.

---

## 2. System Architecture

The system is split into three distinct layers:

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (Planned)                      │
│              React + MUI + Redux Toolkit                     │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP REST
┌──────────────────────────▼──────────────────────────────────┐
│              Orchestrator Layer — Express.js API             │
│  • Bridges GitHub ↔ Memgraph ↔ Frontend                    │
│  • Manages DI container, routes, session GC                  │
│  • Translates JSON rule definitions → safe Cypher queries    │
└───────────────┬──────────────────────────────┬──────────────┘
                │ octokit (HTTPS)              │ neo4j-driver (Bolt)
┌───────────────▼──────────┐   ┌──────────────▼──────────────┐
│   Storage Layer          │   │   Compute Layer              │
│   GitHub                 │   │   Memgraph                   │
│                          │   │                              │
│  main  ── schedule.json  │   │  In-memory graph DB          │
│  main  ── rules.json     │   │  Ephemeral — flushed after   │
│  sim-* ── schedule.json  │   │  each session expires        │
│  PRs   ── proposals      │   │  Multi-tenant via branchId   │
└──────────────────────────┘   └──────────────────────────────┘
```

### Layer A: Storage (GitHub)

- **Source of truth.** The entire schedule lives as `schedule.json` on the `main` branch.
- User simulations are separate Git branches (e.g., `sim-alice-a1b2c3d4`).
- Proposals are GitHub Pull Requests, managed via `octokit`.
- Admin-defined rules (metrics, constraints) live in `rules.json` on `main` only — kept separate from the schedule data so simulation branches don't diverge in configuration.

### Layer B: Compute (Memgraph)

- **Ephemeral calculation engine, not a persistent database.**
- When a simulation session starts, the API hydrates `schedule.json` into Memgraph once.
- Every node is tagged with `branchId` (= the simulation ID) so multiple simultaneous sessions share one Memgraph instance without interfering.
- The API runs Cypher queries for conflict checks, metrics, and suggestions.
- When a session expires, its nodes are `DETACH DELETE`d by the garbage collector.
- Communicates via `neo4j-driver` over the Bolt protocol (Memgraph is openCypher-compatible).

### Layer C: Orchestrator (Express.js API)

- The **brain** of the application.
- Uses `octokit` for all Git operations (branching, file reads/writes, PR management).
- Uses `neo4j-driver` to run Cypher against Memgraph.
- Manages the CI pipeline: reads the simulation branch JSON, hydrates an isolated Memgraph session, checks for conflicts, then labels the PR accordingly.
- The rule builder accepts structured JSON from the frontend and translates it into Cypher server-side — the frontend never sends raw Cypher.

### Why these choices?

| Decision | Rationale |
|---|---|
| Git/JSON over native graph versioning | Avoids complex delta/diff schema in the DB; gets version control, diffs, and PRs for free |
| Memgraph over Neo4j | Memgraph is purely in-memory and openCypher-compatible, making it ideal for the ephemeral hydrate-query-flush cycle |
| Flat JSON schema | Produces clean Git diffs (a room change touches 2–3 lines); maps directly to Cypher `MERGE` statements in a single pass |
| No relational DB | User auth is out of scope for the demo; roles are hardcoded (admin owns `main`, users own sim branches) |

---

## 3. Quick Start

### Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | ≥ 20 | Check with `node -v` |
| pnpm | any recent | `npm i -g pnpm` |
| Memgraph | any | Docker: `docker run -p 7687:7687 memgraph/memgraph` |
| GitHub PAT | — | Needs `repo` scope on the schedule repository |

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/ihammadasghar/iter-scheduling-framework.git
cd iter-scheduling-framework/backend

# 2. Install dependencies
pnpm install

# 3. Configure environment
cp .env.example .env
# Edit .env — fill in GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO

# 4. Start the API
pnpm dev           # Development mode (nodemon, auto-restart)
pnpm start         # Production mode (requires pnpm build first)
```

### Verify it's running

```bash
curl http://localhost:3000/api/v1/simulations   # Should return 404 (no {id} param)
```

### Commands

```bash
pnpm dev                              # Start dev server (nodemon)
pnpm build                            # Compile TypeScript to dist/
pnpm start                            # Run compiled server
pnpm test                             # Run all tests (watch mode)
pnpm test:coverage                    # Tests + coverage report
pnpm lint                             # Type-check only (tsc --noEmit)
pnpm vitest run -t "<test name>"      # Run a single named test
pnpm lint && pnpm test                # Pre-commit check
```

---

## 4. Repository Structure

```
iter-scheduling-framework/
├── ONBOARDING.md               # ← you are here
├── AGENTS.md                   # Coding conventions for AI agents
├── README.md                   # Project stub
├── docs/                       # Original design documents
│   ├── system-architecture.md
│   ├── api-overview.md
│   ├── graph-erd.md
│   ├── schedule-schema.md
│   ├── sequence-diagram.md
│   └── openapi.yaml
└── backend/                    # Node.js + Express backend
    ├── .env.example            # Environment variable template
    ├── package.json
    ├── tsconfig.json
    ├── vitest.config.ts
    ├── nodemon.json
    └── src/
        ├── server.ts           # Entry point — starts HTTP server
        ├── app.ts              # Express app factory (middleware, routes)
        ├── container.ts        # DI wiring — instantiates all services
        ├── clients/
        │   ├── IMemgraphClient.ts    # Interface for Bolt client
        │   └── MemgraphClient.ts     # neo4j-driver wrapper
        ├── controllers/
        │   ├── SimulationController.ts
        │   ├── ProposalController.ts
        │   └── RulesController.ts
        ├── interfaces/
        │   ├── IGitHubService.ts
        │   ├── IGraphService.ts
        │   ├── ISimulationService.ts
        │   ├── IProposalService.ts
        │   ├── ICiPipelineService.ts
        │   └── IRulesService.ts
        ├── middleware/
        │   ├── errorHandler.ts       # Centralised error → JSON response
        │   └── notFound.ts           # 404 catch-all
        ├── routes/
        │   ├── index.ts              # Mounts sub-routers under /api/v1
        │   ├── simulations.ts
        │   ├── proposals.ts
        │   └── rules.ts
        ├── services/
        │   ├── GitHubService.ts      # octokit wrapper
        │   ├── GraphService.ts       # Memgraph Cypher operations
        │   ├── SimulationService.ts  # Orchestrates GitHub + Graph + Registry
        │   ├── ProposalService.ts    # Orchestrates GitHub + CI pipeline
        │   ├── CiPipelineService.ts  # Hydrate → check conflicts → flush
        │   └── RulesService.ts       # ⚠️ NOT IMPLEMENTED (returns 501)
        ├── sessions/
        │   ├── ISessionRegistry.ts
        │   ├── SessionRegistry.ts         # In-memory heartbeat tracker
        │   └── SessionGarbageCollector.ts # Periodic TTL sweep
        ├── types/
        │   ├── domain.ts           # All shared TypeScript interfaces
        │   ├── ApiError.ts         # Typed HTTP error class
        │   ├── scheduleJson.ts     # Raw JSON shape (as stored in GitHub)
        │   └── rulesJson.ts        # rules.json shape
        └── utils/
            ├── ScheduleHydrator.ts      # JSON → Cypher batch builder
            └── MetricRuleTranslator.ts  # Metric rule → Cypher translator
```

---

## 5. Data Models

### 5.1 `schedule.json` Schema

Stored on every branch (both `main` and simulation branches). The schema is intentionally flat — no nesting — so Git diffs are minimal and Memgraph hydration is a single pass.

```json
{
  "metadata": {
    "semesterId": "FALL_2026",
    "semesterName": "Fall Semester 2026",
    "academicYear": "2026-2027",
    "timeline": {
      "semesterStartDate": "2026-09-07",
      "semesterEndDate": "2026-12-18",
      "exclusionDates": [
        { "date": "2026-11-26", "reason": "Thanksgiving Break" }
      ]
    },
    "versioning": {
      "lastModifiedBy": "admin@university.edu",
      "lastModifiedAt": "2026-05-28T11:25:00Z",
      "schemaVersion": "1.0.0"
    }
  },
  "timeSlots": [
    { "id": "TS_MON_P1", "day": "Monday", "name": "Period 1", "startTime": "08:30", "endTime": "10:15" },
    { "id": "TS_MON_P2", "day": "Monday", "name": "Period 2", "startTime": "10:30", "endTime": "12:15" }
  ],
  "rooms": [
    { "id": "RM_101", "name": "Room 101", "capacity": 50, "building": "Science Hall" }
  ],
  "professors": [
    { "id": "PRF_SMITH", "name": "Dr. Jane Smith", "department": "Biology" }
  ],
  "studentGroups": [
    { "id": "GRP_BIO_Y1", "name": "Biology Year 1", "size": 45 }
  ],
  "courses": [
    { "id": "CRS_BIO101", "code": "BIO101", "name": "Intro to Biology", "department": "Biology" }
  ],
  "classes": [
    {
      "id": "CLS_00001",
      "courseId": "CRS_BIO101",
      "title": "Intro to Biology Lecture - Section A",
      "professorId": "PRF_SMITH",
      "studentGroupId": "GRP_BIO_Y1",
      "roomId": "RM_101",
      "timeSlotIds": ["TS_MON_P1", "TS_MON_P2"]
    }
  ]
}
```

**Key design choices:**
- `classes` is the only array that changes during scheduling edits — all other arrays are "master data" that rarely change.
- Including master data (rooms, professors, groups) in every branch makes each simulation a fully self-contained sandbox — a user can propose adding a new room without touching `main`.
- `metadata` is preserved during the commit cycle but ignored by Memgraph hydration.

### 5.2 `rules.json` Schema

Stored on `main` only (never on simulation branches). Read by the API when evaluating metrics for any simulation.

```json
{
  "metrics": [
    {
      "id": "metric-001",
      "name": "Room Utilization",
      "target": "Room",
      "condition": "utilization",
      "threshold": 80
    }
  ],
  "constraints": []
}
```

### 5.3 Graph Data Model (Memgraph)

When a simulation is hydrated, `ScheduleHydrator.ts` translates the JSON into 12 Cypher batches — 6 node types and 6 relationship types. Every node carries a `branchId` property equal to the simulation ID, enabling multi-tenant isolation on a single Memgraph instance.

#### Node types

| Label | Key properties |
|---|---|
| `Course` | `id`, `code`, `name`, `department`, `branchId` |
| `Professor` | `id`, `name`, `department`, `branchId` |
| `StudentGroup` | `id`, `name`, `size`, `branchId` |
| `Room` | `id`, `name`, `capacity`, `building`, `branchId` |
| `TimeSlot` | `id`, `day`, `name`, `startTime`, `endTime`, `branchId` |
| `Class` | `id`, `title`, `courseId`, `professorId`, `studentGroupId`, `roomId`, `branchId` |

> **Note:** The `Class` node redundantly stores foreign-key IDs (`courseId`, `professorId`, etc.) as properties alongside the graph relationships. This lets queries fall back to property lookups (`COALESCE(c.professorId, p.id)`) without always needing to traverse edges.

#### Relationship types

| Relationship | From → To | Cardinality |
|---|---|---|
| `BELONGS_TO` | `Class` → `Course` | 1:1 |
| `TAUGHT_BY` | `Class` → `Professor` | 1:1 |
| `ATTENDED_BY` | `Class` → `StudentGroup` | 1:1 |
| `HELD_IN` | `Class` → `Room` | 1:1 |
| `SCHEDULED_AT` | `Class` → `TimeSlot` | 1:N (one edge per slot if class spans multiple periods) |
| `NEXT` | `TimeSlot` → `TimeSlot` | Chronological chain, built per-day by `startTime` |

**Why `Class` is the hub:** Conflict detection works by asking "do two Class nodes share a Professor/Room/Group AND a TimeSlot?" — always originating from `Class`, making traversal paths predictable.

**Why direct `SCHEDULED_AT` edges per slot:** Instead of traversing a `NEXT` chain to find overlap, conflict queries simply ask "does this Class touch this TimeSlot directly?" The `NEXT` chain is reserved for sequential metric calculations (gap detection, consecutive-class analysis).

---

## 6. API Reference

All endpoints are prefixed `/api/v1`.

### Simulations

| Method | Endpoint | Status | Description |
|---|---|---|---|
| `POST` | `/simulations` | ✅ Implemented | Create simulation: branch `main` → hydrate graph → register session |
| `POST` | `/simulations/:id/heartbeat` | ✅ Implemented | Reset session TTL timer |
| `POST` | `/simulations/:id/commit` | ✅ Implemented | Export graph state → write `schedule.json` back to branch |
| `GET` | `/simulations/:id/classes` | ✅ Implemented | Paginated class list (requires `?page=&limit=`) |
| `PATCH` | `/simulations/:id/classes/:classId` | ✅ Implemented | Micro-edit: update `roomId`, `professorId`, and/or `timeSlotIds` |
| `GET` | `/simulations/:id/classes/:classId/suggestions` | ✅ Implemented | Conflict-free room+timeslot suggestions for a class |
| `GET` | `/simulations/:id/conflicts` | ✅ Implemented | Run all 3 hard constraint checks |
| `GET` | `/simulations/:id/metrics` | ✅ Implemented | Evaluate active metric rules from `rules.json` |

#### `POST /simulations`

```json
// Request body
{ "userId": "alice" }

// Response 201
{
  "id": "sim-alice-a1b2c3d4",
  "branchId": "sim-alice-a1b2c3d4",
  "createdAt": "2026-06-11T10:00:00.000Z"
}
```

The `id` / `branchId` is formatted as `sim-{sanitized-userId}-{8-char-uuid}`. Use this ID in all subsequent requests for this session.

#### `GET /simulations/:id/classes`

```
GET /api/v1/simulations/sim-alice-a1b2c3d4/classes?page=1&limit=20
```

```json
// Response 200
{
  "data": [
    {
      "id": "CLS_00001",
      "courseId": "CRS_BIO101",
      "title": "Intro to Biology Lecture - Section A",
      "professorId": "PRF_SMITH",
      "studentGroupId": "GRP_BIO_Y1",
      "roomId": "RM_101",
      "timeSlotIds": ["TS_MON_P1", "TS_MON_P2"]
    }
  ],
  "total": 150,
  "page": 1,
  "limit": 20
}
```

Maximum `limit` is capped at 500 server-side.

#### `PATCH /simulations/:id/classes/:classId`

At least one field must be provided:

```json
// Request body (all fields optional, but at least one required)
{
  "roomId": "RM_102",
  "professorId": "PRF_JONES",
  "timeSlotIds": ["TS_TUE_P1"]
}
```

Returns the updated `ScheduleClass` object.

#### `GET /simulations/:id/classes/:classId/suggestions`

Returns conflict-free `(room, timeSlots)` combinations for a given class:

```json
// Response 200
[
  { "roomId": "RM_102", "timeSlotIds": ["TS_WED_P1"], "conflictFree": true }
]
```

#### `GET /simulations/:id/conflicts`

```json
// Response 200 — empty array means no hard conflicts
[
  {
    "id": "ROOM_DOUBLE_BOOK_CLS_00001_CLS_00002",
    "type": "ROOM_DOUBLE_BOOK",
    "classIds": ["CLS_00001", "CLS_00002"],
    "message": "Classes CLS_00001 and CLS_00002 both occupy room 'Room 101' at the same time"
  }
]
```

#### `GET /simulations/:id/metrics`

Reads metric rules from `rules.json` on `main`, evaluates each via Cypher, returns results:

```json
// Response 200
[
  { "name": "Room Utilization", "value": 73.4, "unit": "%" }
]
```

Returns `[]` if no metric rules are defined in `rules.json`.

---

### Proposals

| Method | Endpoint | Status | Description |
|---|---|---|---|
| `POST` | `/proposals` | ✅ Implemented | Submit simulation as a PR; triggers CI pipeline |
| `GET` | `/proposals` | ✅ Implemented | List open PRs labelled `ci:ready` |
| `GET` | `/proposals/:id` | ✅ Implemented | Get PR details + raw Git diff |
| `POST` | `/proposals/:id/merge` | ✅ Implemented | Merge PR into `main` (requires `ci:ready` label) |

#### `POST /proposals`

```json
// Request body
{
  "simulationId": "sim-alice-a1b2c3d4",
  "description": "Move BIO101 to avoid Wednesday afternoon conflicts"
}

// Response 201
{
  "id": "42",
  "simulationId": "sim-alice-a1b2c3d4",
  "status": "READY",
  "createdAt": "2026-06-11T10:15:00.000Z"
}
```

Possible `status` values: `PENDING`, `READY`, `BLOCKED`, `MERGED`.

The CI pipeline runs synchronously during this request — the response already reflects the result.

#### `POST /proposals/:id/merge`

Returns `409 Conflict` if the PR does not carry the `ci:ready` label. Returns the updated proposal with `status: "MERGED"` on success.

---

### Rules

> ⚠️ **All rules endpoints are NOT YET IMPLEMENTED.** Routes are wired and return `501 Not Implemented` for every call. See [Known Gaps](#17-known-gaps--not-yet-implemented).

| Method | Endpoint | Status | Description |
|---|---|---|---|
| `GET` | `/rules/metrics` | ⚠️ 501 | List metric rules from `rules.json` |
| `POST` | `/rules/metrics` | ⚠️ 501 | Create a new metric rule |
| `DELETE` | `/rules/metrics/:metricId` | ⚠️ 501 | Remove a metric rule |
| `GET` | `/rules/constraints` | ⚠️ 501 | List constraint rules |
| `POST` | `/rules/constraints` | ⚠️ 501 | Create a constraint rule |
| `DELETE` | `/rules/constraints/:constraintId` | ⚠️ 501 | Remove a constraint rule |

---

### Error Responses

All errors follow this shape:

```json
{
  "statusCode": 404,
  "code": "NOT_FOUND",
  "message": "Simulation not found or expired"
}
```

Common error codes: `BAD_REQUEST` (400), `NOT_FOUND` (404), `CONFLICT` (409), `INTERNAL_SERVER_ERROR` (500), `NOT_IMPLEMENTED` (501).

---

## 7. Key Workflows

### 7.1 Create a Simulation

```
POST /simulations  { userId: "alice" }
```

Internally:
1. `SimulationService.create` validates `userId` and generates `simulationId = sim-alice-{uuid8}`.
2. `GitHubService.createBranch(simulationId, 'main')` — branches `main` on GitHub.
3. `GitHubService.readFile(simulationId, 'schedule.json')` — fetches the JSON.
4. `GraphService.hydrate(simulationId, json)` — runs 12 Cypher batches (node + edge creation).
5. If hydration fails, the branch is deleted (rollback).
6. `SessionRegistry.register(simulationId)` — starts the TTL clock.

### 7.2 Edit a Class

```
PATCH /simulations/:id/classes/:classId  { roomId: "RM_102" }
```

- Checks the session is still registered (refreshes TTL).
- Runs targeted Cypher to delete the old `HELD_IN` edge and create a new one, updating the `roomId` property on the `Class` node simultaneously.
- The same pattern applies to `TAUGHT_BY` (professorId) and `SCHEDULED_AT` (timeSlotIds).

### 7.3 Check Conflicts

```
GET /simulations/:id/conflicts
```

- Runs 3 Cypher queries in parallel (room, professor, student group).
- Returns an array of `Conflict` objects — empty array = no hard conflicts.

### 7.4 Get Smart Suggestions

```
GET /simulations/:id/classes/:classId/suggestions
```

- Queries all `(Room, TimeSlot)` combinations.
- Filters out any combination where the room, professor, or student group of this class already has another class scheduled.
- Returns only conflict-free options.

### 7.5 Commit to Branch

```
POST /simulations/:id/commit
```

1. Reads the existing `schedule.json` from the GitHub branch (to preserve `metadata`).
2. Exports the current graph state from Memgraph via Cypher queries.
3. Merges: `{ ...exportedData, metadata: existingMetadata }`.
4. Writes the merged JSON back to the branch with commit message `chore(schedule): commit simulation changes`.

### 7.6 Submit a Proposal

```
POST /proposals  { simulationId: "sim-alice-a1b2c3d4", description: "..." }
```

1. Creates a GitHub Pull Request (`sim-alice-a1b2c3d4` → `main`).
2. Runs the CI pipeline (see [Section 9](#9-ci-pipeline)).
3. Posts a comment on the PR with the CI result.
4. Sets the PR label to `ci:ready` or `ci:blocked`.
5. Returns the proposal with its `status`.

### 7.7 Admin Merge

```
POST /proposals/42/merge
```

- Fetches the PR to check for the `ci:ready` label. Returns `409` if absent.
- Calls `GitHubService.mergePullRequest("42")` — merges the branch into `main`.

---

## 8. Session Management

Sessions exist to keep the Memgraph graph data alive while a user is actively editing. They are not persisted to disk — if the API restarts, all sessions are lost.

### `SessionRegistry`

An in-memory `Map<simulationId, lastHeartbeatTimestamp>`.

| Method | Effect |
|---|---|
| `register(id)` | Adds a new entry with `lastBeat = Date.now()` |
| `touch(id)` | Updates `lastBeat`; returns `false` if not found |
| `getExpired(ttlMs)` | Returns IDs whose `lastBeat < now - ttlMs` |
| `remove(id)` | Deletes the entry |

Every simulation endpoint calls `registry.touch(simulationId)` first. A `false` return means the session has been GC'd or never existed — the endpoint returns `404`.

### `SessionGarbageCollector`

Runs a `setInterval` sweep every `GC_INTERVAL_MS` (default: 60 seconds):

1. Calls `registry.getExpired(ttlMs)` to find stale sessions.
2. For each expired ID: calls `graph.flush(simulationId)` — runs `MATCH (n {branchId: $branchId}) DETACH DELETE n`.
3. Removes the ID from the registry.

Default TTL: **5 minutes** (`SESSION_TTL_MS=300000`). The frontend must POST to `/:id/heartbeat` at least once every 5 minutes to keep a session alive.

---

## 9. CI Pipeline

The CI pipeline validates a simulation's schedule for hard constraint violations.

### What actually happens

```
CiPipelineService.run({ proposalId, simulationId })
```

1. Reads `schedule.json` from the **simulation branch** on GitHub.
2. Hydrates a temporary, isolated Memgraph session tagged with `ci-{proposalId}-{timestamp}`.
3. Runs the 3 conflict queries (room, professor, group) via `GraphService.queryConflicts(ciRunId)`.
4. **Always** flushes the temporary session in a `finally` block, regardless of outcome.
5. Returns `{ status: 'READY' | 'BLOCKED', conflicts: Conflict[] }`.

### CI labels on the PR

| Result | Label set | Comment posted |
|---|---|---|
| 0 conflicts | `ci:ready` | ✅ CI passed — no hard constraint conflicts |
| ≥1 conflicts | `ci:blocked` | ❌ CI failed — N conflict(s) detected. Fix and push again. |

### ⚠️ Discrepancy with original design docs

The original `sequence-diagram.md` describes a **"dry-run merge"** workflow where the API merges the simulation branch with `main` to produce a combined JSON before running the CI checks. **This is not implemented.** The current CI reads the simulation branch in isolation — it does not check what the merged schedule would look like. This means the CI may not catch conflicts introduced by the interaction between a simulation's changes and changes on `main` made after the simulation was created.

---

## 10. Conflict Detection

Three hard constraint Cypher queries run in parallel during CI and on-demand via `GET /conflicts`:

### Room Double-Booking

```cypher
MATCH (c1:Class {branchId: $branchId})-[:HELD_IN]->(r:Room {branchId: $branchId})<-[:HELD_IN]-(c2:Class {branchId: $branchId})
MATCH (c1)-[:SCHEDULED_AT]->(t:TimeSlot {branchId: $branchId})<-[:SCHEDULED_AT]-(c2)
WHERE c1.id < c2.id
RETURN c1.id AS classId1, c2.id AS classId2, r.name AS resourceName
```

### Professor Overlap

```cypher
MATCH (c1:Class {branchId: $branchId})-[:TAUGHT_BY]->(p:Professor {branchId: $branchId})<-[:TAUGHT_BY]-(c2:Class {branchId: $branchId})
MATCH (c1)-[:SCHEDULED_AT]->(t:TimeSlot {branchId: $branchId})<-[:SCHEDULED_AT]-(c2)
WHERE c1.id < c2.id
RETURN c1.id AS classId1, c2.id AS classId2, p.name AS resourceName
```

### Student Group Overlap

```cypher
MATCH (c1:Class {branchId: $branchId})-[:ATTENDED_BY]->(g:StudentGroup {branchId: $branchId})<-[:ATTENDED_BY]-(c2:Class {branchId: $branchId})
MATCH (c1)-[:SCHEDULED_AT]->(t:TimeSlot {branchId: $branchId})<-[:SCHEDULED_AT]-(c2)
WHERE c1.id < c2.id
RETURN c1.id AS classId1, c2.id AS classId2, g.name AS resourceName
```

The `WHERE c1.id < c2.id` guard prevents duplicate pairs (e.g., `(A,B)` and `(B,A)` both appearing).

---

## 11. Supported Metric Rules

Metric rules are defined in `rules.json` on `main`. When `GET /simulations/:id/metrics` is called, the API reads each rule, looks it up in `MetricRuleTranslator`, and runs the corresponding Cypher query.

### Supported `target:condition` combinations

| `target` | `condition` | Unit | Description |
|---|---|---|---|
| `Class` | `count` | classes | Total number of classes in the schedule |
| `Professor` | `avg_classes_per_day` | classes/day | Average classes per professor per day |
| `Professor` | `max_classes_per_day` | classes/day | Maximum classes any professor teaches in a single day |
| `Room` | `utilization` | % | `(occupied room-slot pairs / total possible room-slot pairs) × 100` |

### How it works

`MetricRuleTranslator.translateRule(rule)` uses a key `${rule.target}:${rule.condition}` to look up a pre-written Cypher template. If the combination is not in the lookup map, it throws `400 BAD_REQUEST` with a list of supported keys.

To add a new metric type, add a new Cypher template and register it in `TRANSLATION_MAP` inside `MetricRuleTranslator.ts`.

---

## 12. Design Patterns

The codebase follows three core patterns consistently. Understanding them is essential before contributing.

### 12.1 Dependency Injection

Every class that interacts with an external system (GitHub, Memgraph, registry) receives its dependencies through the constructor as interfaces. This makes every class independently testable — swap real implementations for mocks in tests without patching modules.

```typescript
// 1. Define the contract
interface IGraphService {
  hydrate(branchId: string, json: string): Promise<void>;
  queryConflicts(branchId: string): Promise<readonly Conflict[]>;
}

// 2. Inject via constructor — never call `new ConcreteService()` inside a class
export class CiPipelineService {
  constructor(
    private readonly github: IGitHubService,
    private readonly graph: IGraphService,
  ) {}
}

// 3. Wire everything in container.ts (the single composition root)
const ciPipeline = new CiPipelineService(githubService, graphService);

// 4. In tests — inject mocks directly
const mockGraph: IGraphService = {
  hydrate: vi.fn().mockResolvedValue(undefined),
  queryConflicts: vi.fn().mockResolvedValue([]),
  // ...
};
const service = new CiPipelineService(mockGitHub, mockGraph);
```

### 12.2 OOP Structure + Functional Method Style

Classes group related behaviour and encapsulate dependencies. Methods are written in a functional style — `map`, `filter`, `reduce`, `flatMap` over `for`/`while` loops. Complex logic is extracted into small named private functions.

```typescript
// ✅ Functional pipeline inside a class method
async queryConflicts(branchId: string): Promise<readonly Conflict[]> {
  const [roomRows, professorRows, groupRows] = await Promise.all([...]);
  return [
    ...roomRows.map((r) => toConflict(r, 'ROOM_DOUBLE_BOOK')),
    ...professorRows.map((r) => toConflict(r, 'PROFESSOR_OVERLAP')),
    ...groupRows.map((r) => toConflict(r, 'GROUP_OVERLAP')),
  ];
}

// Small, pure named helpers — composable and independently testable
const toConflict = (row: ConflictRow, type: Conflict['type']): Conflict => ({
  id: `${type}_${row.classId1}_${row.classId2}`,
  type,
  classIds: [row.classId1, row.classId2],
  message: buildConflictMessage(type, row.classId1, row.classId2, row.resourceName),
});
```

### 12.3 Immutability

All class fields and interface properties are `readonly`. Functions never mutate their arguments — they return new objects via spread.

```typescript
// ✅ Immutable interface
interface ScheduleClass {
  readonly id: string;
  readonly roomId: string;
  readonly timeSlotIds: readonly string[];
}

// ✅ Return new object instead of mutating
const reassignRoom = (cls: ScheduleClass, newRoomId: string): ScheduleClass =>
  ({ ...cls, roomId: newRoomId });

// ✅ as const for fixed lookup data
const CONFLICT_TYPES = ['ROOM_DOUBLE_BOOK', 'PROFESSOR_OVERLAP', 'GROUP_OVERLAP'] as const;
type ConflictType = typeof CONFLICT_TYPES[number];
```

Avoid: `push`, `splice`, `sort` (in-place), `delete obj[key]`.

### 12.4 `ApiError` Typed Errors

All errors thrown in service/controller code use `ApiError` rather than raw `Error`. This gives every error a `statusCode` and machine-readable `code` string that the `errorHandler` middleware converts to a consistent JSON response.

```typescript
// Throw typed errors in services
throw ApiError.notFound('Simulation not found or expired');
throw ApiError.badRequest('userId is required');
throw ApiError.conflict('Proposal is not READY to merge');

// The errorHandler in middleware/errorHandler.ts catches these and responds:
// { "statusCode": 404, "code": "NOT_FOUND", "message": "..." }
```

---

## 13. Code Conventions

### TypeScript

- `strict` mode is enabled — never use `any`.
- 2-space indentation, single quotes, semicolons required.
- Max line length: 100 characters.
- Explicit return types on all functions.
- Prefer `interface` over `type` for object shapes.
- Use `as const` for fixed-value lookup objects and string union maps.

### Naming

| Kind | Convention | Example |
|---|---|---|
| Interfaces / Types | PascalCase | `ScheduleClass`, `SimulationState` |
| Functions / Variables | camelCase | `hydrateGraph`, `isLoading` |
| Constants | UPPER_SNAKE_CASE | `BASE_API_URL`, `DEFAULT_SESSION_TTL_MS` |
| React Components (planned) | PascalCase.tsx | `ClassCard.tsx` |
| Redux slices (planned) | camelCaseReducer.ts | `simulationReducer.ts` |

### Controller Pattern

Controllers are thin wrappers that delegate immediately to the service layer and handle errors via `next(err)`:

```typescript
router.post('/', (req, res, next) => controller.create(req, res, next));

export class SimulationController {
  constructor(private readonly service: ISimulationService) {}

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.service.create(req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);   // Passed to errorHandler middleware
    }
  }
}
```

---

## 14. Testing

Framework: **Vitest** with TypeScript support. Tests are co-located next to the files they test (e.g., `GraphService.test.ts` next to `GraphService.ts`).

### Mocking with DI

Because every service accepts its dependencies via constructor, tests inject mocks directly — no `vi.mock` module patching needed:

```typescript
describe('CiPipelineService', () => {
  it('returns BLOCKED when conflicts exist', async () => {
    // Arrange
    const mockGitHub: IGitHubService = {
      readFile: vi.fn().mockResolvedValue('{ "classes": [] }'),
      // ...other methods stubbed as needed
    };
    const mockGraph: IGraphService = {
      hydrate: vi.fn().mockResolvedValue(undefined),
      queryConflicts: vi.fn().mockResolvedValue([
        { id: 'ROOM_DOUBLE_BOOK_C1_C2', type: 'ROOM_DOUBLE_BOOK', classIds: ['C1', 'C2'], message: '...' },
      ]),
      flush: vi.fn().mockResolvedValue(undefined),
    };
    const service = new CiPipelineService(mockGitHub, mockGraph);

    // Act
    const result = await service.run({ proposalId: '1', simulationId: 'sim-test' });

    // Assert
    expect(result.status).toBe('BLOCKED');
    expect(result.conflicts).toHaveLength(1);
    expect(mockGraph.flush).toHaveBeenCalledWith('ci-1-' + expect.any(String));
  });
});
```

### Running Tests

```bash
pnpm test                             # Watch mode (interactive)
pnpm vitest run                       # Single run (CI mode)
pnpm test:coverage                    # Coverage report
pnpm vitest run -t "CiPipelineService" # Single test file/suite by name
```

### Coverage targets

- Controllers: 80%+
- Services: 80%+
- Utilities (`ScheduleHydrator`, `MetricRuleTranslator`): 90%+

---

## 15. Environment Variables

Copy `.env.example` to `.env` and fill in the required values before running the API.

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `3000` | HTTP port the server listens on |
| `NODE_ENV` | No | `development` | Affects Morgan log format (`dev` vs `combined`) |
| `GITHUB_TOKEN` | **Yes** | — | GitHub Personal Access Token with `repo` scope |
| `GITHUB_OWNER` | **Yes** | — | GitHub username or organisation that owns the schedule repo |
| `GITHUB_REPO` | **Yes** | — | Name of the repository containing `schedule.json` |
| `MEMGRAPH_URI` | No | `bolt://localhost:7687` | Bolt URI for Memgraph |
| `MEMGRAPH_USERNAME` | No | `""` | Memgraph username (empty = no auth) |
| `MEMGRAPH_PASSWORD` | No | `""` | Memgraph password (empty = no auth) |
| `SESSION_TTL_MS` | No | `300000` (5 min) | How long an inactive simulation session lives before GC |
| `GC_INTERVAL_MS` | No | `60000` (1 min) | How often the garbage collector sweeps for expired sessions |

---

## 16. Frontend Plans

> **Status: Not yet built.** This section describes the planned architecture so contributors can understand the full vision.

### Stack

| Technology | Role |
|---|---|
| React + TypeScript | UI framework |
| MUI (Material UI) | Component library |
| Redux Toolkit | Global state management |
| React Testing Library + Vitest | Frontend tests |

### Folder Structure (Atomic Design)

```
frontend/src/
├── atoms/          # Stateless, single-responsibility: Button, Input, Badge, Spinner
├── molecules/      # 2–3 atoms with minimal local state: SearchBar, ClassCard, StatusBadge
├── organisms/      # Complex sections with global state: ClassTable, ConflictPanel, ProposalForm
├── templates/      # Page layouts — accept children/slots, no data fetching
├── pages/          # Route components — data orchestration via Redux thunks
├── hooks/          # Custom React hooks (e.g., useSimulation, useConflicts)
├── services/       # API call functions (axios wrappers)
├── store/
│   └── reducers/   # Redux slices (one per feature: simulationReducer, proposalReducer)
├── types/          # Shared TypeScript interfaces
├── utils/          # Pure utility functions
└── styles/         # MUI theme + global CSS
```

### State Management Pattern

```typescript
// Always use typed hooks
const dispatch = useAppDispatch();
const simulation = useAppSelector((state) => state.simulation.current);

// Async operations in createAsyncThunk
export const createSimulation = createAsyncThunk(
  'simulation/create',
  async (userId: string) => {
    const response = await api.post('/simulations', { userId });
    return response.data;
  },
);
```

### Styling

- Use the MUI `sx` prop for component-level styling.
- Never hardcode colours — always reference `theme.palette.*`.

---

## 17. Known Gaps / Not Yet Implemented

This section documents the delta between design intent and current code. These are not bugs — they are planned work.

### 1. Rules CRUD (`RulesService`)

**All 6 methods in `RulesService.ts` throw `ApiError.notImplemented()`.** The routes are wired, the controller delegates correctly, but the service body is a stub:

```typescript
async listMetrics(): Promise<readonly MetricRule[]> {
  throw ApiError.notImplemented();  // ← not yet built
}
```

**What needs to be done:** Implement reading/writing `rules.json` on the `main` branch via `GitHubService.readFile` / `writeFile`. The JSON shape is already defined in `types/rulesJson.ts`.

**Affected endpoints:** `GET/POST/DELETE /rules/metrics` and `GET/POST/DELETE /rules/constraints`.

---

### 2. CI Pipeline: No "Dry-Run Merge"

**Design intent (per `docs/sequence-diagram.md`):** The CI pipeline fetches the JSON state that would result from merging the simulation branch into `main` — catching conflicts introduced by interaction between the proposal and changes on `main` since the simulation was forked.

**Actual implementation (`CiPipelineService.ts`):** The CI reads the simulation branch JSON directly and checks it in isolation. It does not compute the merged state.

**Impact:** The CI may report "READY" even if the simulation's changes conflict with recent commits to `main` that happened after the simulation was created.

**What needs to be done:** Use the GitHub API to fetch the merge base or compute a merged JSON state before running conflict queries.

---

### 3. No Frontend

The React frontend has not been started. The backend API is fully usable via HTTP clients (curl, Postman, etc.) while the frontend is built.

---

### 4. No User Authentication

User roles are hardcoded:
- The GitHub PAT owner = Admin (can merge proposals into `main`).
- Any caller with the API's URL = User (can create simulations and submit proposals).

There is no login, no JWT, no session auth. This is a scoped demo decision — authentication is intentionally out of scope.

---

### 5. `MetricRuleTranslator` Has Only 4 Conditions

The translator supports only `Class:count`, `Professor:avg_classes_per_day`, `Professor:max_classes_per_day`, and `Room:utilization`. Any other `target:condition` pair returns `400 BAD_REQUEST`. New metric types require adding a Cypher template and registering it in `TRANSLATION_MAP` in `utils/MetricRuleTranslator.ts`.

---

*Last updated: June 2026 — reflects backend implementation as of the initial backend milestone.*
