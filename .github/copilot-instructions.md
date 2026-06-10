# Copilot Instructions: University Scheduling System

## Project Overview

A "Git-flow" decision support system for university timetable management. Users branch off a main schedule to simulate changes, then submit proposals (Pull Requests) for review. A CI pipeline validates proposals for hard constraint violations before an Admin can merge them.

---

## Architecture: Three-Layer System

### 1. Storage Layer — GitHub (Source of Truth)
- The entire schedule is a flat JSON file (`schedule.json`) stored in a GitHub repo.
- `main` branch = official published schedule.
- Each user simulation = a separate Git branch (e.g., `sim-user-1`).
- Proposals = GitHub Pull Requests managed via `octokit`.
- Global Admin config (rules, constraints, metrics) lives in `rules.json` on `main` only.

### 2. Compute Layer — Memgraph (Ephemeral Graph DB)
- **Not a persistent database.** Used only during active sessions for Cypher calculations.
- The Express API hydrates `schedule.json` into Memgraph at session start, runs queries, then flushes the data.
- Communicates via `neo4j-driver` (Bolt protocol) — Memgraph is openCypher-compatible.
- A `/heartbeat` endpoint (pinged every 60s) prevents abandoned sessions from leaking memory.

### 3. Orchestrator Layer — Express.js API (Backend)
- Bridges the frontend, GitHub, and Memgraph.
- Uses `octokit` for all Git operations (branching, commits, PRs).
- Manages the CI pipeline: on proposal submission, performs a "dry-run" merge, hydrates the combined JSON into Memgraph, runs Hard Constraint Cypher queries, then updates the PR status (`Blocked` or `Ready`).
- The rule builder accepts structured JSON payloads from the frontend and **translates them into Cypher server-side** — the frontend never sends raw Cypher queries.

---

## Graph Data Model (Memgraph)

Nodes: `Class`, `Course`, `Professor`, `StudentGroup`, `Room`, `TimeSlot`

Key relationships:
- `(Class)-[:TAUGHT_BY]->(Professor)` — 1:1
- `(Class)-[:ATTENDED_BY]->(StudentGroup)` — 1:1
- `(Class)-[:HELD_IN]->(Room)` — 1:1
- `(Class)-[:SCHEDULED_AT]->(TimeSlot)` — 1:N (one edge per slot if class spans multiple periods)
- `(TimeSlot)-[:NEXT]->(TimeSlot)` — chronological chain used for consecutive/gap metric queries

The `Class` node is the central hub. Conflict detection works by finding two `Class` nodes sharing the same `Professor`/`Room`/`Group` and `TimeSlot`.

---

## Schedule JSON Schema (`schedule.json`)

Top-level flat arrays: `metadata`, `timeSlots`, `rooms`, `professors`, `studentGroups`, `courses`, `classes`.

Each `class` entry:
```json
{
  "id": "CLS_00001",
  "courseId": "CRS_BIO101",
  "title": "...",
  "professorId": "PRF_SMITH",
  "studentGroupId": "GRP_BIO_Y1",
  "roomId": "RM_101",
  "timeSlotIds": ["TS_MON_P1", "TS_MON_P2"]
}
```

The schema is intentionally flat (no nesting) to produce clean Git diffs and enable a single-pass Memgraph hydration.

---

## API Structure (`/api/v1`)

| Endpoint | Purpose |
|---|---|
| `POST /simulations` | Branch `main`, hydrate graph |
| `POST /simulations/{id}/heartbeat` | Reset GC timer on Memgraph session |
| `POST /simulations/{id}/commit` | Flush graph → write JSON back to Git branch |
| `GET /simulations/{id}/classes` | Paginated class list (required: `page`, `limit`) |
| `PATCH /simulations/{id}/classes/{id}` | Micro-edit a class assignment |
| `GET /simulations/{id}/classes/{id}/suggestions` | Pathfind valid conflict-free slots |
| `GET /simulations/{id}/conflicts` | Run all hard constraint checks |
| `GET /simulations/{id}/metrics` | Evaluate all active metric rules |
| `POST /proposals` | Submit simulation → trigger CI pipeline |
| `POST /proposals/{id}/merge` | Admin merges passing PR into `main` |
| `GET/POST /rules/metrics` | Manage Admin-defined metric rules |
| `GET/POST /rules/constraints` | Manage Admin-defined hard constraints |

---

## Tech Stack

- **Backend:** Node.js + Express.js, TypeScript strict mode
- **Graph DB:** Memgraph via `neo4j-driver` (Bolt)
- **Git integration:** `octokit`
- **Frontend:** React + MUI, Redux Toolkit, TypeScript strict mode
- **Testing:** Vitest + React Testing Library
- **Package manager:** `pnpm`

---

## Commands

```bash
pnpm test                          # Run all tests
pnpm test --watch                  # Watch mode
pnpm test --coverage               # Coverage report
pnpm vitest run -t "<test name>"   # Run a single test
pnpm lint && pnpm test             # Pre-commit check
```

---

## Code Conventions

**TypeScript:**
- `strict` mode; never use `any`
- 2-space indentation, single quotes, semicolons
- Max line length: 100 characters
- Explicit return types on all functions
- Prefer `interface` over `type` for objects

**Naming:**
| Kind | Convention | Example |
|---|---|---|
| Interfaces/Types | PascalCase | `ScheduleClass`, `SimulationState` |
| Functions/Variables | camelCase | `hydrateGraph`, `isLoading` |
| Constants | UPPER_SNAKE_CASE | `BASE_API_URL` |
| React Components | PascalCase.tsx | `ClassCard.tsx` |
| Redux slices | camelCaseReducer.ts | `simulationReducer.ts` |

**Backend handler pattern:**
```typescript
// Route handler — thin; delegates immediately to the controller
router.post('/', (req, res, next) => simulationController.create(req, res, next));

// Controller — receives all dependencies via constructor (never instantiates them internally)
export class SimulationController {
  constructor(
    private readonly githubService: IGitHubService,
    private readonly graphService: IGraphService,
  ) {}

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const branch = await this.githubService.createBranch(req.body);
      await this.graphService.hydrate(branch.id);
      res.status(201).json(branch);
    } catch (err) {
      next(err);
    }
  }
}
```

**Frontend state:**
```typescript
// Always use typed hooks
const dispatch = useAppDispatch();
const simulation = useAppSelector((state) => state.simulation.current);
```

---

## Design Principles

### 1. Dependency Injection
- Every class that interacts with an external system (Memgraph, GitHub, filesystem) **receives its dependencies via the constructor**, typed as interfaces.
- Never call `new ConcreteService()` inside a class body — inject it from outside.
- This makes every class independently testable: swap real implementations with mocks in tests without patching module imports.

```typescript
// Define the contract
interface IGitHubService {
  createBranch(params: CreateBranchParams): Promise<Branch>;
}

// Inject via constructor — never instantiate internally
export class SimulationService {
  constructor(private readonly github: IGitHubService) {}

  async startSimulation(params: CreateBranchParams): Promise<Branch> {
    return this.github.createBranch(params);
  }
}

// In tests — pass a mock that satisfies the interface
const mockGitHub: IGitHubService = { createBranch: vi.fn().mockResolvedValue(fakeBranch) };
const service = new SimulationService(mockGitHub);
```

### 2. OOP Structure + Functional Method Style
- Use **classes** for grouping related behaviour and encapsulating configuration/state (OOP).
- Write **methods** in a functional style:
  - Prefer `map`, `filter`, `reduce`, `flatMap` over `for`/`while` loops.
  - Keep methods focused and pure where possible (same input → same output, no hidden side effects).
  - Extract complex logic into small, named private helper functions and compose them.

```typescript
export class ConflictAnalyser {
  constructor(private readonly graph: IGraphService) {}

  async findConflicts(simId: string): Promise<Conflict[]> {
    const raw = await this.graph.queryConflicts(simId);
    return raw
      .filter(isHardConflict)
      .map(toConflictDto)
      .sort(byseverity);
  }
}

// Small, named, pure helpers — easy to unit-test in isolation
const isHardConflict = (r: RawConflict): boolean => r.type === 'HARD';
const toConflictDto  = (r: RawConflict): Conflict => ({ id: r.id, type: r.type, message: r.msg });
const byseverity     = (a: Conflict, b: Conflict): number => b.severity - a.severity;
```

### 3. Immutability
- Mark all class fields and interface properties `readonly`.
- Never mutate function arguments — return new objects/arrays using spread or array methods.
- Use `as const` for fixed lookup objects and string-union maps.
- Avoid `push`, `splice`, `sort` (in-place), `delete` — use non-mutating equivalents.

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

// ✅ as const for fixed data
const CONFLICT_TYPES = ['ROOM_DOUBLE_BOOK', 'PROFESSOR_OVERLAP', 'GROUP_OVERLAP'] as const;
type ConflictType = typeof CONFLICT_TYPES[number];
```

---



```
src/
├── atoms/       # Single-responsibility, no business logic
├── molecules/   # Combine 2-3 atoms, minimal local state, no API calls
├── organisms/   # Complex sections, may use global state
├── templates/   # Layout only, no data fetching
├── pages/       # Route handlers, data orchestration
├── hooks/       # Custom React hooks
├── services/    # API calls
├── store/reducers/  # Redux slices (one per feature domain)
├── types/       # TypeScript interfaces
└── utils/       # Pure utility functions
```

- Use MUI `sx` prop for styling; never hardcode colors — reference `theme.palette.*`

---

## Git & PR Conventions

**Branch naming:** `<type>/<number>-<description>` (e.g., `feat/12-hydration-service`)

**Commit format:** `<type>(<scope>): <subject>` (e.g., `feat(api): add heartbeat endpoint`)

**PR description should include:** approach in 3–5 bullet points, testing notes, linked issue, potential side effects.

A PR that fails the Memgraph CI pipeline is marked **Blocked** (not closed) — the user fixes and pushes to the same branch to re-trigger the pipeline.
