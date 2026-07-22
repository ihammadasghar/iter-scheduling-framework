# Mock Development Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a developer run the backend (`make dev`) with zero external accounts — no GitHub PAT, no separate schedule repo — using bundled realistic mock data, and add a backend e2e test that proves the mock works end-to-end.

**Architecture:** A new `LocalGitHubService` implements the existing `IGitHubService` interface as a pure in-memory fake (branches = `Map<string, Map<path, content>>`, PRs = a numbered map), seeded from two new fixture JSON files. `container.ts` picks it over the real Octokit-backed `GitHubService` via a `GITHUB_PROVIDER` env var. Memgraph is *not* mocked — it already requires no credentials — so the new e2e test drives the real Express app through `supertest` against a real (dockerized) Memgraph plus the mock GitHub layer.

**Tech Stack:** TypeScript (strict, CommonJS output via `tsc`), Express 5, Vitest, `diff` (unified diff generation), `supertest` (HTTP-level e2e assertions).

## Global Constraints

- Backend compiles to **CommonJS** (`tsc`, no `"type": "module"` in `backend/package.json`), even though relative imports use `.js` extensions (NodeNext resolution). **Do not use `import.meta.url`** anywhere — use `__dirname` + `path.join` instead, matching how the compiled output actually behaves (verified: `backend/dist/*.js` starts with `"use strict"; ... require(...)`).
- All new interfaces/types use `readonly` properties, matching every existing type in `backend/src/types/domain.ts` and `backend/src/interfaces/*.ts`.
- Dependency injection only — no module-level singletons. New services take their dependencies via constructor, matching `GitHubService`/`SimulationService`/etc.
- `GITHUB_PROVIDER` env var: `'mock'` | `'github'`. **Code-level default when unset stays `'github'`** (preserves current behavior for existing deployments). Only `backend/.env.example` sets it to `mock`.
- The default `pnpm test` / `pnpm test:coverage` (and CI) must keep working with **zero Docker dependency**. The new e2e test is Docker-dependent (needs a real Memgraph) and must live behind a separate `pnpm test:e2e` script, excluded from the default vitest run.
- `RulesService` stays untouched (still returns `501 Not Implemented` — tracked separately as Gap 1 in `DESIGN.md`). Do not implement it as part of this plan.
- No frontend changes — this plan is backend-only.
- Commit message style follows this repo's existing convention: `type(scope): summary` (see `git log`, e.g. `feat(sessions): added simulation sessions`).

---

## File Map

| File | Status | Responsibility |
|---|---|---|
| `backend/src/fixtures/mock-schedule.json` | New | Seed `schedule.json` content for the `main` branch |
| `backend/src/fixtures/mock-rules.json` | New | Seed `rules.json` content for the `main` branch |
| `backend/src/fixtures/mockFixtures.test.ts` | New | Validates fixture shape + the one deliberate seeded conflict |
| `backend/src/services/LocalGitHubService.ts` | New | In-memory `IGitHubService` implementation |
| `backend/src/services/LocalGitHubService.test.ts` | New | Unit tests mirroring `GitHubService.test.ts` coverage |
| `backend/src/container.ts` | Modify | `GITHUB_PROVIDER` switch + `Container.shutdown()` |
| `backend/src/app.ts` | Modify | Export `createAppWithContainer()` for the e2e test |
| `backend/.env.example` | Modify | `GITHUB_PROVIDER=mock` default, comment GitHub vars as optional |
| `backend/vitest.config.ts` | Modify | Exclude `src/e2e/**` from the default test run |
| `backend/vitest.e2e.config.ts` | New | Separate config that only includes `src/e2e/**/*.test.ts` |
| `backend/package.json` | Modify | Add `diff`, `supertest`, `@types/supertest`; add `test:e2e` script; fixture-copy in `build` |
| `backend/src/e2e/simulationFlow.e2e.test.ts` | New | Full HTTP-level flow: create → resolve conflict → commit → propose → merge |
| `Makefile` | Modify | Add `test-e2e` target |
| `README.md`, `ONBOARDING.md` | Modify | Document zero-account local dev + the mock GitHub layer |

---

### Task 1: Mock Schedule & Rules Fixture Data

**Files:**
- Create: `backend/src/fixtures/mock-schedule.json`
- Create: `backend/src/fixtures/mock-rules.json`
- Test: `backend/src/fixtures/mockFixtures.test.ts`

**Interfaces:**
- Consumes: `ScheduleJson` from `backend/src/types/scheduleJson.ts`, `RulesJson` from `backend/src/types/rulesJson.ts` (both already exist, unchanged).
- Produces: two fixture files that Task 2's `LocalGitHubService` will read via `readFileSync(join(__dirname, '../fixtures/mock-schedule.json'))` / `mock-rules.json`. **Exact deliberate conflict pair the e2e test (Task 5) depends on:** classes `CLS_00001` and `CLS_00004` both use room `RM_101` at time slot `TS_MON_P1` — this is the only collision in the whole fixture set.

- [ ] **Step 1: Write the fixture validation test (it will fail — the fixture files don't exist yet)**

Create `backend/src/fixtures/mockFixtures.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { ScheduleJson } from '../types/scheduleJson.js';
import type { RulesJson } from '../types/rulesJson.js';

function loadFixture<T>(filename: string): T {
  const raw = readFileSync(join(__dirname, filename), 'utf-8');
  return JSON.parse(raw) as T;
}

describe('mock fixtures', () => {
  const schedule = loadFixture<ScheduleJson>('mock-schedule.json');
  const rules = loadFixture<RulesJson>('mock-rules.json');

  it('mock-schedule.json has at least one entry in every master array', () => {
    expect(schedule.rooms.length).toBeGreaterThan(0);
    expect(schedule.professors.length).toBeGreaterThan(0);
    expect(schedule.studentGroups.length).toBeGreaterThan(0);
    expect(schedule.courses.length).toBeGreaterThan(0);
    expect(schedule.timeSlots.length).toBeGreaterThan(0);
    expect(schedule.classes.length).toBeGreaterThan(0);
  });

  it('every class references ids that exist in the master arrays', () => {
    const roomIds = new Set(schedule.rooms.map((r) => r.id));
    const professorIds = new Set(schedule.professors.map((p) => p.id));
    const groupIds = new Set(schedule.studentGroups.map((g) => g.id));
    const courseIds = new Set(schedule.courses.map((c) => c.id));
    const timeSlotIds = new Set(schedule.timeSlots.map((t) => t.id));

    for (const cls of schedule.classes) {
      expect(roomIds.has(cls.roomId)).toBe(true);
      expect(professorIds.has(cls.professorId)).toBe(true);
      expect(groupIds.has(cls.studentGroupId)).toBe(true);
      expect(courseIds.has(cls.courseId)).toBe(true);
      cls.timeSlotIds.forEach((id) => expect(timeSlotIds.has(id)).toBe(true));
    }
  });

  it('contains exactly one deliberate room-double-booking conflict: CLS_00001 vs CLS_00004 in RM_101', () => {
    const byRoomAndSlot = new Map<string, string[]>();
    for (const cls of schedule.classes) {
      for (const slotId of cls.timeSlotIds) {
        const key = `${cls.roomId}::${slotId}`;
        const existing = byRoomAndSlot.get(key) ?? [];
        existing.push(cls.id);
        byRoomAndSlot.set(key, existing);
      }
    }
    const collisions = [...byRoomAndSlot.entries()].filter(([, ids]) => ids.length > 1);
    expect(collisions).toEqual([['RM_101::TS_MON_P1', ['CLS_00001', 'CLS_00004']]]);
  });

  it('mock-schedule.json has no accidental professor or student-group double-bookings', () => {
    const byProfAndSlot = new Map<string, string[]>();
    const byGroupAndSlot = new Map<string, string[]>();
    for (const cls of schedule.classes) {
      for (const slotId of cls.timeSlotIds) {
        const profKey = `${cls.professorId}::${slotId}`;
        const groupKey = `${cls.studentGroupId}::${slotId}`;
        byProfAndSlot.set(profKey, [...(byProfAndSlot.get(profKey) ?? []), cls.id]);
        byGroupAndSlot.set(groupKey, [...(byGroupAndSlot.get(groupKey) ?? []), cls.id]);
      }
    }
    expect([...byProfAndSlot.values()].every((ids) => ids.length === 1)).toBe(true);
    expect([...byGroupAndSlot.values()].every((ids) => ids.length === 1)).toBe(true);
  });

  it('mock-rules.json metric rules use target/condition combinations supported by MetricRuleTranslator', () => {
    const supported = new Set([
      'Class:count',
      'Professor:avg_classes_per_day',
      'Professor:max_classes_per_day',
      'Room:utilization',
    ]);
    rules.metrics.forEach((rule) => {
      expect(supported.has(`${rule.target}:${rule.condition}`)).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && pnpm vitest run src/fixtures/mockFixtures.test.ts`
Expected: FAIL — `ENOENT: no such file or directory, open '.../mock-schedule.json'`

- [ ] **Step 3: Create `backend/src/fixtures/mock-schedule.json`**

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
      "lastModifiedBy": "mock-data@iter-scheduling.local",
      "lastModifiedAt": "2026-07-22T00:00:00.000Z",
      "schemaVersion": "1.0.0"
    }
  },
  "timeSlots": [
    { "id": "TS_MON_P1", "day": "Monday", "name": "Period 1", "startTime": "08:30", "endTime": "10:15" },
    { "id": "TS_MON_P2", "day": "Monday", "name": "Period 2", "startTime": "10:30", "endTime": "12:15" },
    { "id": "TS_TUE_P1", "day": "Tuesday", "name": "Period 1", "startTime": "09:00", "endTime": "11:30" },
    { "id": "TS_WED_P1", "day": "Wednesday", "name": "Period 1", "startTime": "08:30", "endTime": "10:15" },
    { "id": "TS_WED_P2", "day": "Wednesday", "name": "Period 2", "startTime": "10:30", "endTime": "12:15" }
  ],
  "rooms": [
    { "id": "RM_101", "name": "Room 101", "capacity": 50, "building": "Science Hall" },
    { "id": "RM_102", "name": "Room 102", "capacity": 30, "building": "Arts Block" },
    { "id": "RM_103", "name": "Room 103", "capacity": 40, "building": "Science Hall" },
    { "id": "RM_104", "name": "Room 104", "capacity": 60, "building": "Main Hall" }
  ],
  "professors": [
    { "id": "PRF_SMITH", "name": "Dr. Jane Smith", "department": "Biology" },
    { "id": "PRF_JONES", "name": "Prof. Alan Jones", "department": "History" },
    { "id": "PRF_CHEN", "name": "Dr. Bob Chen", "department": "Chemistry" }
  ],
  "studentGroups": [
    { "id": "GRP_BIO_Y1", "name": "Biology Year 1", "size": 45 },
    { "id": "GRP_HIS_Y1", "name": "History Year 1", "size": 25 },
    { "id": "GRP_CHEM_Y1", "name": "Chemistry Year 1", "size": 30 }
  ],
  "courses": [
    { "id": "CRS_BIO101", "code": "BIO101", "name": "Intro to Biology", "department": "Biology" },
    { "id": "CRS_HIS201", "code": "HIS201", "name": "Modern History", "department": "History" },
    { "id": "CRS_CHEM301", "code": "CHEM301", "name": "Organic Chemistry", "department": "Chemistry" },
    { "id": "CRS_BIO102", "code": "BIO102", "name": "Cell Biology", "department": "Biology" },
    { "id": "CRS_HIS202", "code": "HIS202", "name": "World War II", "department": "History" }
  ],
  "classes": [
    { "id": "CLS_00001", "courseId": "CRS_BIO101", "title": "Intro to Biology Lecture - Section A", "professorId": "PRF_SMITH", "studentGroupId": "GRP_BIO_Y1", "roomId": "RM_101", "timeSlotIds": ["TS_MON_P1"] },
    { "id": "CLS_00002", "courseId": "CRS_HIS201", "title": "Modern History Lecture - Section A", "professorId": "PRF_JONES", "studentGroupId": "GRP_HIS_Y1", "roomId": "RM_102", "timeSlotIds": ["TS_MON_P2"] },
    { "id": "CLS_00003", "courseId": "CRS_CHEM301", "title": "Organic Chemistry Lab - Section A", "professorId": "PRF_CHEN", "studentGroupId": "GRP_CHEM_Y1", "roomId": "RM_103", "timeSlotIds": ["TS_TUE_P1"] },
    { "id": "CLS_00004", "courseId": "CRS_HIS202", "title": "World War II Lecture - Section A", "professorId": "PRF_JONES", "studentGroupId": "GRP_HIS_Y1", "roomId": "RM_101", "timeSlotIds": ["TS_MON_P1"] },
    { "id": "CLS_00005", "courseId": "CRS_CHEM301", "title": "Organic Chemistry Lecture - Section B", "professorId": "PRF_CHEN", "studentGroupId": "GRP_CHEM_Y1", "roomId": "RM_104", "timeSlotIds": ["TS_WED_P1"] },
    { "id": "CLS_00006", "courseId": "CRS_BIO101", "title": "Intro to Biology Lab - Section A", "professorId": "PRF_SMITH", "studentGroupId": "GRP_BIO_Y1", "roomId": "RM_103", "timeSlotIds": ["TS_WED_P2"] },
    { "id": "CLS_00007", "courseId": "CRS_HIS201", "title": "Modern History Seminar - Section A", "professorId": "PRF_JONES", "studentGroupId": "GRP_HIS_Y1", "roomId": "RM_102", "timeSlotIds": ["TS_TUE_P1"] },
    { "id": "CLS_00008", "courseId": "CRS_BIO102", "title": "Cell Biology Lab - Section A", "professorId": "PRF_SMITH", "studentGroupId": "GRP_BIO_Y1", "roomId": "RM_101", "timeSlotIds": ["TS_WED_P1"] },
    { "id": "CLS_00009", "courseId": "CRS_CHEM301", "title": "Organic Chemistry Tutorial - Section A", "professorId": "PRF_CHEN", "studentGroupId": "GRP_CHEM_Y1", "roomId": "RM_103", "timeSlotIds": ["TS_MON_P2"] },
    { "id": "CLS_00010", "courseId": "CRS_CHEM301", "title": "Organic Chemistry Tutorial - Section B", "professorId": "PRF_CHEN", "studentGroupId": "GRP_CHEM_Y1", "roomId": "RM_101", "timeSlotIds": ["TS_WED_P2"] }
  ]
}
```

- [ ] **Step 4: Create `backend/src/fixtures/mock-rules.json`**

```json
{
  "metrics": [
    { "id": "metric-room-utilization", "name": "Room Utilization", "target": "Room", "condition": "utilization", "threshold": 80 },
    { "id": "metric-avg-classes-per-professor", "name": "Average Classes per Professor per Day", "target": "Professor", "condition": "avg_classes_per_day", "threshold": 4 }
  ],
  "constraints": [
    { "id": "constraint-no-room-double-booking", "name": "No Room Double Booking", "target": "Room", "violationCondition": "double_booking" }
  ]
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && pnpm vitest run src/fixtures/mockFixtures.test.ts`
Expected: PASS — 5 tests passing

- [ ] **Step 6: Commit**

```bash
git add backend/src/fixtures/
git commit -m "feat(mock-data): add mock schedule and rules fixture data"
```

---

### Task 2: `LocalGitHubService`

**Files:**
- Create: `backend/src/services/LocalGitHubService.ts`
- Test: `backend/src/services/LocalGitHubService.test.ts`
- Modify: `backend/package.json` (add `diff` dependency)

**Interfaces:**
- Consumes: `IGitHubService`, `PullRequestInfo` from `backend/src/interfaces/IGitHubService.ts` (unchanged); `ApiError` from `backend/src/types/ApiError.ts` (unchanged); the two fixture files from Task 1.
- Produces: `export class LocalGitHubService implements IGitHubService` with a constructor `constructor(seedFiles?: Readonly<Record<string, string>>)` (defaults to the bundled fixtures) — this is what Task 3's `container.ts` instantiates with no arguments.

- [ ] **Step 1: Add the `diff` dependency**

Edit `backend/package.json` — add to `"dependencies"`:

```json
    "diff": "^9.0.0",
```

(Keep the list alphabetically ordered — insert between `"dotenv"` and `"express"`.)

Run: `cd backend && pnpm install`
Expected: lockfile updates, `diff` appears in `node_modules`.

- [ ] **Step 2: Write the failing unit tests**

Create `backend/src/services/LocalGitHubService.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { LocalGitHubService } from './LocalGitHubService.js';

function buildSeed(): Record<string, string> {
  return {
    'schedule.json': JSON.stringify({ value: 'main-schedule' }),
    'rules.json': JSON.stringify({ metrics: [], constraints: [] }),
  };
}

describe('LocalGitHubService', () => {
  let service: LocalGitHubService;

  beforeEach(() => {
    service = new LocalGitHubService(buildSeed());
  });

  // ── createBranch / deleteBranch ─────────────────────────────────────────────

  it('createBranch copies the source branch\'s files into a new branch', async () => {
    await service.createBranch('sim-1', 'main');
    const content = await service.readFile('sim-1', 'schedule.json');
    expect(content).toBe(JSON.stringify({ value: 'main-schedule' }));
  });

  it('createBranch throws notFound when the source branch does not exist', async () => {
    await expect(service.createBranch('sim-1', 'does-not-exist')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('deleteBranch removes a previously created branch', async () => {
    await service.createBranch('sim-1', 'main');
    await service.deleteBranch('sim-1');
    await expect(service.readFile('sim-1', 'schedule.json')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  // ── readFile / writeFile ─────────────────────────────────────────────────────

  it('readFile throws notFound for a missing branch', async () => {
    await expect(service.readFile('does-not-exist', 'schedule.json')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('readFile throws notFound for a missing file on an existing branch', async () => {
    await expect(service.readFile('main', 'missing.json')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('writeFile updates the content read back by readFile on the same branch', async () => {
    await service.writeFile('main', 'schedule.json', '{"updated":true}', 'test commit');
    const content = await service.readFile('main', 'schedule.json');
    expect(content).toBe('{"updated":true}');
  });

  it('writeFile changes on a branch do not affect other branches', async () => {
    await service.createBranch('sim-1', 'main');
    await service.writeFile('sim-1', 'schedule.json', '{"updated":true}', 'test commit');
    const mainContent = await service.readFile('main', 'schedule.json');
    expect(mainContent).toBe(JSON.stringify({ value: 'main-schedule' }));
  });

  // ── createPullRequest / getPullRequest / setPullRequestLabels ────────────────

  it('createPullRequest returns incrementing numeric ids and getPullRequest reflects them', async () => {
    await service.createBranch('sim-1', 'main');
    const id = await service.createPullRequest('sim-1', 'main', 'My PR', 'description');

    expect(id).toBe('1');
    const pr = await service.getPullRequest(id);
    expect(pr).toMatchObject({ title: 'My PR', head: 'sim-1', labels: [] });
  });

  it('getPullRequest throws notFound for an unknown id', async () => {
    await expect(service.getPullRequest('999')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('setPullRequestLabels replaces the labels returned by getPullRequest', async () => {
    await service.createBranch('sim-1', 'main');
    const id = await service.createPullRequest('sim-1', 'main', 'My PR', 'description');

    await service.setPullRequestLabels(id, ['ci:ready']);

    const pr = await service.getPullRequest(id);
    expect(pr.labels).toEqual(['ci:ready']);
  });

  it('listOpenPullRequests only returns pull requests that have not been merged', async () => {
    await service.createBranch('sim-1', 'main');
    await service.createBranch('sim-2', 'main');
    const id1 = await service.createPullRequest('sim-1', 'main', 'PR 1', 'd1');
    const id2 = await service.createPullRequest('sim-2', 'main', 'PR 2', 'd2');

    await service.mergePullRequest(id1);

    expect(await service.listOpenPullRequests()).toEqual([id2]);
  });

  // ── mergePullRequest ──────────────────────────────────────────────────────────

  it('mergePullRequest copies the head branch\'s files onto the base branch', async () => {
    await service.createBranch('sim-1', 'main');
    await service.writeFile('sim-1', 'schedule.json', '{"updated":true}', 'edit');
    const id = await service.createPullRequest('sim-1', 'main', 'My PR', 'description');

    await service.mergePullRequest(id);

    const mainContent = await service.readFile('main', 'schedule.json');
    expect(mainContent).toBe('{"updated":true}');
  });

  it('mergePullRequest throws notFound for an unknown id', async () => {
    await expect(service.mergePullRequest('999')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  // ── getPullRequestDiff ────────────────────────────────────────────────────────

  it('getPullRequestDiff returns a unified diff between the base and head schedule.json', async () => {
    await service.createBranch('sim-1', 'main');
    await service.writeFile('sim-1', 'schedule.json', '{"value":"changed"}', 'edit');
    const id = await service.createPullRequest('sim-1', 'main', 'My PR', 'description');

    const result = await service.getPullRequestDiff(id);

    expect(result).toContain('-{"value":"main-schedule"}');
    expect(result).toContain('+{"value":"changed"}');
  });

  // ── addPullRequestComment ────────────────────────────────────────────────────

  it('addPullRequestComment resolves for an existing pull request and throws notFound otherwise', async () => {
    await service.createBranch('sim-1', 'main');
    const id = await service.createPullRequest('sim-1', 'main', 'My PR', 'description');

    await expect(service.addPullRequestComment(id, 'a comment')).resolves.toBeUndefined();
    await expect(service.addPullRequestComment('999', 'a comment')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  // ── default fixtures ──────────────────────────────────────────────────────────

  it('defaults to seeding "main" from the bundled mock fixture files when no seed is provided', async () => {
    const defaultService = new LocalGitHubService();
    const scheduleJson = await defaultService.readFile('main', 'schedule.json');
    const parsed = JSON.parse(scheduleJson) as { classes: unknown[] };
    expect(Array.isArray(parsed.classes)).toBe(true);
    expect(parsed.classes.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd backend && pnpm vitest run src/services/LocalGitHubService.test.ts`
Expected: FAIL — `Cannot find module './LocalGitHubService.js'`

- [ ] **Step 4: Implement `LocalGitHubService.ts`**

Create `backend/src/services/LocalGitHubService.ts`:

```ts
import { readFileSync } from 'fs';
import { join } from 'path';
import { createTwoFilesPatch } from 'diff';
import { ApiError } from '../types/ApiError.js';
import type { IGitHubService, PullRequestInfo } from '../interfaces/IGitHubService.js';

const SCHEDULE_JSON_PATH = 'schedule.json';

interface PullRequestRecord {
  readonly head: string;
  readonly base: string;
  readonly title: string;
  readonly body: string;
  labels: string[];
  readonly createdAt: string;
  state: 'open' | 'merged';
}

/**
 * In-memory stand-in for GitHubService, used when GITHUB_PROVIDER=mock.
 * Models branches as file maps and pull requests as a numbered record —
 * enough fidelity for the full simulation -> proposal -> merge flow to run
 * with no real GitHub account, repo, or network access.
 */
export class LocalGitHubService implements IGitHubService {
  private readonly branches = new Map<string, Map<string, string>>();
  private readonly pullRequests = new Map<string, PullRequestRecord>();
  private nextPullRequestNumber = 1;

  constructor(seedFiles: Readonly<Record<string, string>> = loadDefaultFixtures()) {
    this.branches.set('main', new Map(Object.entries(seedFiles)));
  }

  async createBranch(branchName: string, sourceBranch: string): Promise<void> {
    const source = this.branches.get(sourceBranch);
    if (!source) {
      throw ApiError.notFound(`Branch '${sourceBranch}' not found`);
    }
    this.branches.set(branchName, new Map(source));
  }

  async deleteBranch(branchName: string): Promise<void> {
    this.branches.delete(branchName);
  }

  async readFile(branch: string, path: string): Promise<string> {
    const files = this.getBranchFiles(branch);
    const content = files.get(path);
    if (content === undefined) {
      throw ApiError.notFound(`File '${path}' not found on branch '${branch}'`);
    }
    return content;
  }

  async writeFile(branch: string, path: string, content: string, _message: string): Promise<void> {
    const files = this.getBranchFiles(branch);
    files.set(path, content);
  }

  async createPullRequest(head: string, base: string, title: string, body: string): Promise<string> {
    const id = String(this.nextPullRequestNumber++);
    this.pullRequests.set(id, {
      head,
      base,
      title,
      body,
      labels: [],
      createdAt: new Date().toISOString(),
      state: 'open',
    });
    return id;
  }

  async mergePullRequest(pullRequestId: string): Promise<void> {
    const pr = this.getPullRequestRecord(pullRequestId);
    const headFiles = this.getBranchFiles(pr.head);
    const baseFiles = this.getBranchFiles(pr.base);
    for (const [path, content] of headFiles) {
      baseFiles.set(path, content);
    }
    pr.state = 'merged';
  }

  async getPullRequestDiff(pullRequestId: string): Promise<string> {
    const pr = this.getPullRequestRecord(pullRequestId);
    const baseContent = this.branches.get(pr.base)?.get(SCHEDULE_JSON_PATH) ?? '';
    const headContent = this.branches.get(pr.head)?.get(SCHEDULE_JSON_PATH) ?? '';
    return createTwoFilesPatch(SCHEDULE_JSON_PATH, SCHEDULE_JSON_PATH, baseContent, headContent);
  }

  async listOpenPullRequests(): Promise<readonly string[]> {
    return [...this.pullRequests.entries()]
      .filter(([, pr]) => pr.state === 'open')
      .map(([id]) => id);
  }

  async addPullRequestComment(pullRequestId: string, _body: string): Promise<void> {
    this.getPullRequestRecord(pullRequestId);
  }

  async getPullRequest(pullRequestId: string): Promise<PullRequestInfo> {
    const pr = this.getPullRequestRecord(pullRequestId);
    return {
      title: pr.title,
      head: pr.head,
      labels: pr.labels,
      createdAt: pr.createdAt,
    };
  }

  async setPullRequestLabels(pullRequestId: string, labels: readonly string[]): Promise<void> {
    const pr = this.getPullRequestRecord(pullRequestId);
    pr.labels = [...labels];
  }

  private getBranchFiles(branch: string): Map<string, string> {
    const files = this.branches.get(branch);
    if (!files) {
      throw ApiError.notFound(`Branch '${branch}' not found`);
    }
    return files;
  }

  private getPullRequestRecord(pullRequestId: string): PullRequestRecord {
    const pr = this.pullRequests.get(pullRequestId);
    if (!pr) {
      throw ApiError.notFound(`Pull request '${pullRequestId}' not found`);
    }
    return pr;
  }
}

export function loadDefaultFixtures(): Readonly<Record<string, string>> {
  const scheduleJson = readFileSync(join(__dirname, '../fixtures/mock-schedule.json'), 'utf-8');
  const rulesJson = readFileSync(join(__dirname, '../fixtures/mock-rules.json'), 'utf-8');
  return {
    'schedule.json': scheduleJson,
    'rules.json': rulesJson,
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && pnpm vitest run src/services/LocalGitHubService.test.ts`
Expected: PASS — 13 tests passing

- [ ] **Step 6: Type-check**

Run: `cd backend && pnpm lint`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add backend/package.json backend/pnpm-lock.yaml backend/src/services/LocalGitHubService.ts backend/src/services/LocalGitHubService.test.ts
git commit -m "feat(mock-data): add LocalGitHubService in-memory GitHub fake"
```

---

### Task 3: Container & App Wiring

**Files:**
- Modify: `backend/src/container.ts`
- Modify: `backend/src/app.ts`
- Modify: `backend/.env.example`

**Interfaces:**
- Consumes: `LocalGitHubService` from Task 2 (`new LocalGitHubService()`, no args).
- Produces: `buildContainer(): Container` where `Container` now also has `shutdown(): Promise<void>`; `createAppWithContainer(): { app: Express; container: Container }` from `app.ts` (Task 5's e2e test imports this). `createApp(): Express` keeps its exact current signature and behavior (delegates to `createAppWithContainer().app`), so `server.ts` needs no changes.

- [ ] **Step 1: Edit `backend/src/container.ts`**

Replace the top of the file (imports) — add `LocalGitHubService` and `IGitHubService` imports:

```ts
import neo4j from 'neo4j-driver';
import { Octokit } from '@octokit/rest';
import { MemgraphClient } from './clients/MemgraphClient.js';
import { GitHubService } from './services/GitHubService.js';
import { LocalGitHubService } from './services/LocalGitHubService.js';
import { GraphService } from './services/GraphService.js';
import { SimulationService } from './services/SimulationService.js';
import { ProposalService } from './services/ProposalService.js';
import { CiPipelineService } from './services/CiPipelineService.js';
import { RulesService } from './services/RulesService.js';
import { SessionRegistry } from './sessions/SessionRegistry.js';
import { SessionGarbageCollector } from './sessions/SessionGarbageCollector.js';
import { SimulationController } from './controllers/SimulationController.js';
import { ProposalController } from './controllers/ProposalController.js';
import { RulesController } from './controllers/RulesController.js';
import type { IGitHubService } from './interfaces/IGitHubService.js';
```

Replace the `Container` interface:

```ts
export interface Container {
  readonly simulationController: SimulationController;
  readonly proposalController: ProposalController;
  readonly rulesController: RulesController;
  shutdown(): Promise<void>;
}
```

Replace the body of `buildContainer()` — swap the GitHub client construction and add `shutdown` to the returned object:

```ts
export function buildContainer(): Container {
  // GitHub client — real Octokit-backed service, or an in-memory fake for
  // local development / tests. Set GITHUB_PROVIDER=mock (see .env.example)
  // to skip needing a GitHub PAT and schedule repo entirely.
  const githubService: IGitHubService =
    process.env['GITHUB_PROVIDER'] === 'mock'
      ? new LocalGitHubService()
      : new GitHubService(
          new Octokit({ auth: process.env['GITHUB_TOKEN'] }),
          process.env['GITHUB_OWNER'] ?? '',
          process.env['GITHUB_REPO'] ?? '',
        );

  // Memgraph client
  const driver = neo4j.driver(
    process.env['MEMGRAPH_URI'] ?? 'bolt://localhost:7687',
    neo4j.auth.basic(
      process.env['MEMGRAPH_USERNAME'] ?? '',
      process.env['MEMGRAPH_PASSWORD'] ?? '',
    ),
  );
  const graphClient = new MemgraphClient(driver);
  const graphService = new GraphService(graphClient);

  // Session registry + GC sweeper
  const sessionRegistry = new SessionRegistry();
  const ttlMs = parseInt(process.env['SESSION_TTL_MS'] ?? String(DEFAULT_SESSION_TTL_MS), 10);
  const intervalMs = parseInt(process.env['GC_INTERVAL_MS'] ?? String(DEFAULT_GC_INTERVAL_MS), 10);
  const gc = new SessionGarbageCollector(sessionRegistry, graphService, ttlMs, intervalMs);
  gc.start();

  // Domain services
  const simulationService = new SimulationService(githubService, graphService, sessionRegistry);
  const ciPipelineService = new CiPipelineService(githubService, graphService);
  const proposalService = new ProposalService(githubService, graphService, ciPipelineService);
  const rulesService = new RulesService(githubService);

  return {
    simulationController: new SimulationController(simulationService),
    proposalController: new ProposalController(proposalService),
    rulesController: new RulesController(rulesService),
    async shutdown(): Promise<void> {
      gc.stop();
      await driver.close();
    },
  };
}
```

(`DEFAULT_SESSION_TTL_MS` / `DEFAULT_GC_INTERVAL_MS` constants and the `rulesService`/`simulationService`/etc. local variables are unchanged from the current file — only the GitHub client construction, the `Container` interface, and the returned object's `shutdown` method are new.)

- [ ] **Step 2: Edit `backend/src/app.ts`**

Replace the whole file:

```ts
import express from 'express';
import type { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { buildContainer } from './container.js';
import type { Container } from './container.js';
import { createApiRouter } from './routes/index.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp(): Express {
  return createAppWithContainer().app;
}

export function createAppWithContainer(): { app: Express; container: Container } {
  const app = express();

  // Security headers
  app.use(helmet());

  // CORS — permissive for development; tighten via env config for production
  app.use(cors());

  // Request logging
  const logFormat = process.env['NODE_ENV'] === 'production' ? 'combined' : 'dev';
  app.use(morgan(logFormat));

  // Body parsers
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Build DI container and mount API routes
  const container = buildContainer();
  app.use('/api/v1', createApiRouter(container));

  // 404 catch-all (must come after routes)
  app.use(notFound);

  // Centralised error handler (must be last)
  app.use(errorHandler);

  return { app, container };
}
```

- [ ] **Step 3: Edit `backend/.env.example`**

Replace its contents:

```
PORT=3000
NODE_ENV=development

# GitHub API — set GITHUB_PROVIDER=mock to skip all of this and run fully
# locally with bundled mock schedule/rules data (see backend/src/fixtures/).
# Only required when GITHUB_PROVIDER=github.
GITHUB_PROVIDER=mock
GITHUB_TOKEN=your_personal_access_token_here
GITHUB_OWNER=your_github_username_or_org
GITHUB_REPO=your_schedule_repository_name

# Memgraph (neo4j-driver via Bolt)
MEMGRAPH_URI=bolt://localhost:7687
MEMGRAPH_USERNAME=
MEMGRAPH_PASSWORD=

# Session garbage collection
SESSION_TTL_MS=300000
GC_INTERVAL_MS=60000
```

- [ ] **Step 4: Type-check**

Run: `cd backend && pnpm lint`
Expected: no errors

- [ ] **Step 5: Run the full existing test suite to confirm nothing broke**

Run: `cd backend && pnpm vitest run`
Expected: PASS — same test count as before this task, plus Task 1/2's new tests

- [ ] **Step 6: Commit**

```bash
git add backend/src/container.ts backend/src/app.ts backend/.env.example
git commit -m "feat(mock-data): wire GITHUB_PROVIDER mock switch and container shutdown"
```

---

### Task 4: Test & Build Tooling

**Files:**
- Modify: `backend/package.json`
- Modify: `backend/vitest.config.ts`
- Create: `backend/vitest.e2e.config.ts`
- Modify: `Makefile`

**Interfaces:**
- Consumes: nothing new — pure tooling/config.
- Produces: `pnpm test:e2e` script and `backend/vitest.e2e.config.ts` that Task 5's e2e test file will run under; `pnpm build` now also copies `src/fixtures/**` into `dist/fixtures/`, which is what `LocalGitHubService`'s `loadDefaultFixtures()` (Task 2) relies on at runtime from compiled output.

- [ ] **Step 1: Edit `backend/package.json` scripts and devDependencies**

Replace the `"scripts"` block:

```json
  "scripts": {
    "dev": "nodemon",
    "build": "tsc && cp -r src/fixtures dist/fixtures",
    "start": "node dist/server.js",
    "test": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "vitest run --config vitest.e2e.config.ts",
    "lint": "tsc --noEmit"
  },
```

Add to `"devDependencies"` (alphabetically, after `"@vitest/coverage-v8"`):

```json
    "@types/supertest": "^7.2.1",
```

and after `"nodemon"`:

```json
    "supertest": "^7.2.2",
```

Run: `cd backend && pnpm install`
Expected: lockfile updates, `supertest` and `@types/supertest` appear in `node_modules`.

- [ ] **Step 2: Edit `backend/vitest.config.ts` to exclude the e2e directory**

```ts
import { defineConfig } from 'vitest/config';
import AllureReporter from 'allure-vitest/reporter';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['dist/**', 'node_modules/**', 'src/e2e/**'],
    reporters: [
      'default',
      new AllureReporter({ resultsDir: 'allure-results' }),
    ],
  },
});
```

- [ ] **Step 3: Create `backend/vitest.e2e.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/e2e/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Add a `test-e2e` Makefile target**

Edit `Makefile` — add after the `test-coverage` target:

```makefile
test-e2e: ## Run backend e2e tests against a real Memgraph (requires Docker)
	@echo "Starting Memgraph..."
	@docker compose up -d memgraph
	cd backend && $(PNPM) test:e2e
```

Also update the `.PHONY` line at the top of the file to include it:

```makefile
.PHONY: install dev test test-e2e lint build clean help
```

- [ ] **Step 5: Verify the build copies fixtures and the default test run is unaffected**

Run: `cd backend && pnpm build && ls dist/fixtures`
Expected: `mock-rules.json` and `mock-schedule.json` listed

Run: `cd backend && pnpm vitest run`
Expected: PASS — same tests as after Task 3 (the `src/e2e/**` exclude has nothing to exclude yet, which is fine — Task 5 adds the file)

- [ ] **Step 6: Commit**

```bash
git add backend/package.json backend/pnpm-lock.yaml backend/vitest.config.ts backend/vitest.e2e.config.ts Makefile
git commit -m "chore(mock-data): add test:e2e tooling and fixture build step"
```

---

### Task 5: End-to-End Test

**Files:**
- Create: `backend/src/e2e/simulationFlow.e2e.test.ts`

**Interfaces:**
- Consumes: `createAppWithContainer` and `Container` from `backend/src/app.ts` / `backend/src/container.ts` (Task 3); the deliberate conflict fixture data from Task 1 (`CLS_00001` / `CLS_00004` / `RM_101` / `TS_MON_P1`); `supertest` (Task 4).
- Produces: nothing consumed elsewhere — this is the final proof that the mock mode works end-to-end.

**Prerequisite for this task only:** a real Memgraph must be running locally:

```bash
docker compose up -d memgraph
```

- [ ] **Step 1: Write the e2e test**

Create `backend/src/e2e/simulationFlow.e2e.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createAppWithContainer } from '../app.js';
import type { Container } from '../container.js';

describe('simulation flow (e2e, mock GitHub + real Memgraph)', () => {
  let app: Express;
  let container: Container;

  beforeAll(() => {
    process.env['GITHUB_PROVIDER'] = 'mock';
    ({ app, container } = createAppWithContainer());
  });

  afterAll(async () => {
    await container.shutdown();
  });

  it('creates a simulation, resolves the seeded conflict, commits, and merges a ready proposal', async () => {
    // 1. Create a simulation — hydrates the mock schedule.json into Memgraph
    const createRes = await request(app)
      .post('/api/v1/simulations')
      .send({ userId: 'e2e-test' })
      .expect(201);

    const simulationId = createRes.body.id as string;
    expect(simulationId).toMatch(/^sim-e2e-test-/);

    // 2. Confirm the seeded classes are visible
    const classesRes = await request(app)
      .get(`/api/v1/simulations/${simulationId}/classes`)
      .expect(200);
    expect(classesRes.body.total).toBe(10);

    // 3. Confirm the deliberate seeded conflict (CLS_00001 vs CLS_00004 in RM_101) is detected
    const conflictsBeforeRes = await request(app)
      .get(`/api/v1/simulations/${simulationId}/conflicts`)
      .expect(200);
    expect(conflictsBeforeRes.body).toHaveLength(1);
    expect(conflictsBeforeRes.body[0]).toMatchObject({
      type: 'ROOM_DOUBLE_BOOK',
      classIds: ['CLS_00001', 'CLS_00004'],
    });

    // 4. Move CLS_00004 to a free room (RM_104 is unused at TS_MON_P1) to resolve the conflict
    await request(app)
      .patch(`/api/v1/simulations/${simulationId}/classes/CLS_00004`)
      .send({ roomId: 'RM_104' })
      .expect(200);

    // 5. Confirm the conflict is gone
    const conflictsAfterRes = await request(app)
      .get(`/api/v1/simulations/${simulationId}/conflicts`)
      .expect(200);
    expect(conflictsAfterRes.body).toHaveLength(0);

    // 6. Commit the change back to the simulation's mock branch
    await request(app)
      .post(`/api/v1/simulations/${simulationId}/commit`)
      .expect(200);

    // 7. Submit as a proposal — runs the CI pipeline against the mock GitHub branch
    const proposalRes = await request(app)
      .post('/api/v1/proposals')
      .send({ simulationId, description: 'Resolved the Room 101 double-booking' })
      .expect(201);
    expect(proposalRes.body.status).toBe('READY');
    const proposalId = proposalRes.body.id as string;

    // 8. Merge the ready proposal
    const mergeRes = await request(app)
      .post(`/api/v1/proposals/${proposalId}/merge`)
      .expect(200);
    expect(mergeRes.body.status).toBe('MERGED');
  });
});
```

- [ ] **Step 2: Run the e2e test**

Prerequisite: `docker compose up -d memgraph` (from the repo root), and wait for it to report healthy: `docker compose ps` should show `memgraph` as `healthy`.

Run: `cd backend && pnpm test:e2e`
Expected: PASS — 1 test passing. If it fails with a connection error, confirm Memgraph is running and reachable at `bolt://localhost:7687`.

- [ ] **Step 3: Confirm the default test run still excludes it**

Run: `cd backend && pnpm test`
Expected: PASS, and the output does not mention `simulationFlow.e2e.test.ts` at all (confirms the `vitest.config.ts` exclude from Task 4 is working)

- [ ] **Step 4: Commit**

```bash
git add backend/src/e2e/
git commit -m "test(mock-data): add e2e test covering the full simulation-to-merge flow"
```

---

### Task 6: Documentation

**Files:**
- Modify: `README.md`
- Modify: `ONBOARDING.md`

**Interfaces:**
- Consumes: everything from Tasks 1–5 (describes the finished feature).
- Produces: nothing consumed by other tasks — this is the last task.

- [ ] **Step 1: Edit `README.md` Quick Start section**

Find the `## Quick Start` section (currently starts with the `make install` / `.env` / `make dev` code block). Replace the block and the note beneath it:

```markdown
## Quick Start

```bash
# 1. Install all dependencies (backend + frontend)
make install

# 2. Configure the backend environment
cp backend/.env.example backend/.env
# The default .env.example needs no GitHub account — GITHUB_PROVIDER=mock
# runs the backend against bundled mock schedule/rules data (see
# backend/src/fixtures/). See "Using a real GitHub repo" below to switch.

# 3. Start everything (Memgraph + backend + frontend)
make dev
```

| Service | URL |
|---|---|
| Backend API | http://localhost:3000 |
| Frontend | http://localhost:5173 |

### Using a real GitHub repo

By default (`GITHUB_PROVIDER=mock` in `.env.example`), the backend never talks to GitHub — it keeps `schedule.json`/`rules.json` in memory, seeded from `backend/src/fixtures/mock-schedule.json` and `mock-rules.json`. To run against a real Git-flow (real branches, real PRs) instead:

1. Create a GitHub repository containing `schedule.json` and `rules.json` on `main` — see [ONBOARDING.md §2 — Schedule Repository Setup](./ONBOARDING.md) for the schema.
2. In `backend/.env`, set `GITHUB_PROVIDER=github` and fill in `GITHUB_TOKEN` (a PAT with `repo` scope), `GITHUB_OWNER`, and `GITHUB_REPO`.
```

(Keep the existing "Prerequisite" callout below this section as-is — it becomes conditional context for the real-GitHub path, not the default path.)

- [ ] **Step 2: Edit `ONBOARDING.md`**

Find `### Layer A: Storage (GitHub)` (around line 82). Add a subsection immediately after it:

```markdown
#### Local mock mode (`LocalGitHubService`)

For local development and tests, `GITHUB_PROVIDER=mock` (the `.env.example` default) swaps the real Octokit-backed `GitHubService` for `backend/src/services/LocalGitHubService.ts` — an in-memory fake that implements the same `IGitHubService` interface. It models branches as in-memory file maps and pull requests as a simple numbered record, seeded on startup from `backend/src/fixtures/mock-schedule.json` and `mock-rules.json`.

What it fakes: branch create/delete, file read/write, PR create/get/list/label/merge, and unified diff generation between branches — everything the simulation → proposal → merge flow needs.

What it does **not** do: nothing is ever pushed to real GitHub, there's no commit history, and state resets every time the backend process restarts (it's reseeded from the fixture files each time). Switch to `GITHUB_PROVIDER=github` (see README "Using a real GitHub repo") for the real workflow.
```

- [ ] **Step 3: Run the full check to confirm the whole plan's changes are consistent**

Run: `cd backend && pnpm lint && pnpm test`
Expected: PASS

Run (requires Docker, optional but recommended): `docker compose up -d memgraph && cd backend && pnpm test:e2e`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add README.md ONBOARDING.md
git commit -m "docs(mock-data): document zero-account local dev and LocalGitHubService"
```

---

## Self-Review Notes

- **Spec coverage:** Architecture (§1) → Task 2/3. Mock data content (§2) → Task 1. Docs (§3) → Task 6. Testing (§4, unit + e2e) → Task 2 (unit) + Task 5 (e2e) + Task 4 (tooling). All spec sections have a corresponding task.
- **Type consistency:** `LocalGitHubService` constructor signature (`seedFiles?: Readonly<Record<string, string>>`) is identical between Task 2's implementation and every test call site (`new LocalGitHubService(buildSeed())` and `new LocalGitHubService()`). `Container.shutdown(): Promise<void>` is identical between Task 3's interface, implementation, and Task 5's `afterAll` usage. Route paths in Task 5 (`/api/v1/simulations`, `/api/v1/proposals`) match `backend/src/app.ts`'s existing mount point and `backend/src/routes/*.ts`'s existing route definitions — unchanged by this plan.
- **Fixture-to-test coupling:** The deliberate conflict (`CLS_00001`/`CLS_00004`/`RM_101`/`TS_MON_P1`) is asserted structurally in Task 1's `mockFixtures.test.ts` and functionally (against real Memgraph conflict detection) in Task 5's e2e test — if either fixture file is edited later, both tests catch a broken assumption.
