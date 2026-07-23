# Close Backend Gaps + Published Schedule View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the four backend gaps documented in `DESIGN.md §11` (RulesService, blocked-proposals filter, reject proposal, delete simulation) and replace the frontend's "View Schedule" stub — so every screen the frontend already built works end-to-end against real backend behavior, in both mock (`LocalGitHubService`) and real (`GitHubService`) modes.

**Architecture:** Straightforward CRUD/composition additions to existing services, following each service's established constructor-injection pattern. One new `IGitHubService` method (`closePullRequest`) ripples through both implementations and three existing test files. No new services, no new architecture.

**Tech Stack:** TypeScript (strict, CommonJS output), Express 5, Vitest, React + Redux Toolkit + MUI (frontend).

## Global Constraints

- All new/changed backend types use `readonly` properties, matching every existing type in `backend/src/types/domain.ts` and `backend/src/interfaces/*.ts`.
- Constructor-based dependency injection only — no module-level singletons. This applies to `RulesService` (already takes `IGitHubService`, currently unused).
- Any test file that constructs an inline `IGitHubService` mock object literal (not just `LocalGitHubService`/`GitHubService`'s own tests) must be updated wherever the interface changes, or `pnpm lint` breaks. Confirmed inline-literal mock sites: `backend/src/services/SimulationService.test.ts`, `backend/src/services/CiPipelineService.test.ts`, `backend/src/services/ProposalService.test.ts` (all three end their `makeGitHub()` factory with `setPullRequestLabels: vi.fn().mockResolvedValue(undefined),`).
- The frontend's `ProposalStatus` type (`frontend/src/types/domain.ts:42`) already includes `'REJECTED'` — the backend `Proposal['status']` union must match it exactly, not invent different wording.
- The frontend's `proposalService.ts`/`simulationService.ts`/`rulesService.ts` (already built, do not change) define the exact contract the backend must satisfy: `GET /proposals` (no params) → ready only; `GET /proposals?status=blocked` → blocked only; `POST /proposals/:id/reject` → `200` with the updated proposal, or a `404`/`405` the frontend already tolerates; `DELETE /simulations/:id` → `204`, or a `404`/`405` the frontend already tolerates; `rules.json` CRUD matches `CreateMetricRuleRequest { name, target, condition, threshold }` / `CreateConstraintRequest { name, target, violationCondition }` exactly (already-correct backend types, no changes needed there).
- Delete simulation must be idempotent from the caller's perspective: a `404`/`422` from the real `GitHubService.deleteBranch` (branch already gone) must be swallowed, not surfaced as a 500; any other error must propagate.
- Follow each file's existing test conventions exactly (inline `makeGitHub()`/`makeGraph()`/`makeRegistry()` factories per test file, `describe` blocks scoped per method with their own local `beforeEach`/`SIM_ID` consts — confirmed by reading the actual current files, not assumed).

---

## File Map

| File | Status | Responsibility |
|---|---|---|
| `backend/src/interfaces/IGitHubService.ts` | Modify | Add `closePullRequest` |
| `backend/src/services/GitHubService.ts` / `.test.ts` | Modify | Implement + test `closePullRequest` (real Octokit) |
| `backend/src/services/LocalGitHubService.ts` / `.test.ts` | Modify | Implement + test `closePullRequest` (mock), extend PR state union |
| `backend/src/services/SimulationService.test.ts` | Modify | Add `closePullRequest` to inline mock; add `delete()` tests |
| `backend/src/services/CiPipelineService.test.ts` | Modify | Add `closePullRequest` to inline mock |
| `backend/src/services/RulesService.ts` | Rewrite | Real `rules.json` CRUD via `IGitHubService` |
| `backend/src/services/RulesService.test.ts` | New | Unit tests for the above |
| `backend/src/types/domain.ts` | Modify | Add `'REJECTED'` to `Proposal['status']` |
| `backend/src/interfaces/IProposalService.ts` | Modify | `list(status?)`, add `reject` |
| `backend/src/services/ProposalService.ts` / `.test.ts` | Modify | Status filter, `reject()` |
| `backend/src/controllers/ProposalController.ts` | Modify | Pass `status` query param, add `reject` handler |
| `backend/src/routes/proposals.ts` | Modify | New `POST /:id/reject` route |
| `backend/src/interfaces/ISimulationService.ts` | Modify | Add `delete` |
| `backend/src/services/SimulationService.ts` | Modify | `delete()` |
| `backend/src/controllers/SimulationController.ts` | Modify | Add `deleteSimulation` handler |
| `backend/src/routes/simulations.ts` | Modify | New `DELETE /:id` route |
| `frontend/src/organisms/PublishedScheduleCard.tsx` / new `.test.tsx` | Modify | Reuse simulation-creation flow instead of the `/simulations/main` stub |
| `docs/frontend-implementation-plan.md` | Modify | Fix stale header |

---

### Task 1: `closePullRequest` on `IGitHubService`

**Files:**
- Modify: `backend/src/interfaces/IGitHubService.ts`
- Modify: `backend/src/services/GitHubService.ts`, `backend/src/services/GitHubService.test.ts`
- Modify: `backend/src/services/LocalGitHubService.ts`, `backend/src/services/LocalGitHubService.test.ts`
- Modify: `backend/src/services/SimulationService.test.ts`, `backend/src/services/CiPipelineService.test.ts` (mechanical mock-literal fix only)

**Interfaces:**
- Produces: `IGitHubService.closePullRequest(pullRequestId: string): Promise<void>` — Task 3's `ProposalService.reject()` calls this.

- [ ] **Step 1: Add the method to the interface**

Edit `backend/src/interfaces/IGitHubService.ts` — insert immediately after the `mergePullRequest` line:

```ts
  mergePullRequest(pullRequestId: string): Promise<void>;
  closePullRequest(pullRequestId: string): Promise<void>;
```

- [ ] **Step 2: Write the failing test for `GitHubService.closePullRequest`**

Edit `backend/src/services/GitHubService.test.ts` — the `MockOctokit` type's `pulls` block currently reads:

```ts
    pulls: {
      create: ReturnType<typeof vi.fn>;
      merge: ReturnType<typeof vi.fn>;
      list: ReturnType<typeof vi.fn>;
      get: ReturnType<typeof vi.fn>;
    };
```

Add an `update` entry:

```ts
    pulls: {
      create: ReturnType<typeof vi.fn>;
      merge: ReturnType<typeof vi.fn>;
      list: ReturnType<typeof vi.fn>;
      get: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
```

In `buildMockOctokit()`, the `pulls` object currently reads:

```ts
      pulls: {
        create: vi.fn(),
        merge: vi.fn(),
        list: vi.fn(),
        get: vi.fn(),
      },
```

Add `update: vi.fn(),`:

```ts
      pulls: {
        create: vi.fn(),
        merge: vi.fn(),
        list: vi.fn(),
        get: vi.fn(),
        update: vi.fn(),
      },
```

Add a new test, placed after the `// ── mergePullRequest ──` block:

```ts
  // ── closePullRequest ────────────────────────────────────────────────────────

  it('closePullRequest calls pulls.update with state closed and the numeric PR number', async () => {
    mock.rest.pulls.update.mockResolvedValue({});

    await service.closePullRequest('42');

    expect(mock.rest.pulls.update).toHaveBeenCalledWith({
      owner: OWNER, repo: REPO, pull_number: 42, state: 'closed',
    });
  });
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && pnpm vitest run src/services/GitHubService.test.ts -t "closePullRequest"`
Expected: FAIL — `service.closePullRequest is not a function`

- [ ] **Step 4: Implement `GitHubService.closePullRequest`**

Edit `backend/src/services/GitHubService.ts` — insert immediately after the `mergePullRequest` method:

```ts
  async closePullRequest(pullRequestId: string): Promise<void> {
    await this.octokit.rest.pulls.update({
      owner: this.owner,
      repo: this.repo,
      pull_number: parseInt(pullRequestId, 10),
      state: 'closed',
    });
  }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && pnpm vitest run src/services/GitHubService.test.ts -t "closePullRequest"`
Expected: PASS

- [ ] **Step 6: Write the failing test for `LocalGitHubService.closePullRequest`**

Edit `backend/src/services/LocalGitHubService.test.ts` — add after the `// ── addPullRequestComment ──` block:

```ts
  // ── closePullRequest ────────────────────────────────────────────────────────

  it('closePullRequest removes the pull request from listOpenPullRequests', async () => {
    await service.createBranch('sim-1', 'main');
    const id = await service.createPullRequest('sim-1', 'main', 'My PR', 'description');

    await service.closePullRequest(id);

    expect(await service.listOpenPullRequests()).toEqual([]);
  });

  it('closePullRequest throws notFound for an unknown id', async () => {
    await expect(service.closePullRequest('999')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('closePullRequest does not copy the head branch onto the base branch (unlike merge)', async () => {
    await service.createBranch('sim-1', 'main');
    await service.writeFile('sim-1', 'schedule.json', '{"updated":true}', 'edit');
    const id = await service.createPullRequest('sim-1', 'main', 'My PR', 'description');

    await service.closePullRequest(id);

    const mainContent = await service.readFile('main', 'schedule.json');
    expect(mainContent).toBe(JSON.stringify({ value: 'main-schedule' }));
  });
```

- [ ] **Step 7: Run tests to verify they fail**

Run: `cd backend && pnpm vitest run src/services/LocalGitHubService.test.ts -t "closePullRequest"`
Expected: FAIL — `service.closePullRequest is not a function`

- [ ] **Step 8: Implement `LocalGitHubService.closePullRequest`**

Edit `backend/src/services/LocalGitHubService.ts`. Change the `PullRequestRecord` interface's `state` field:

```ts
  state: 'open' | 'merged';
```
to:
```ts
  state: 'open' | 'merged' | 'closed';
```

Insert a new method immediately after `mergePullRequest`:

```ts
  async closePullRequest(pullRequestId: string): Promise<void> {
    const pr = this.getPullRequestRecord(pullRequestId);
    pr.state = 'closed';
  }
```

(No change needed to `listOpenPullRequests()` — its existing `filter(([, pr]) => pr.state === 'open')` already excludes `'closed'`.)

- [ ] **Step 9: Run tests to verify they pass**

Run: `cd backend && pnpm vitest run src/services/LocalGitHubService.test.ts`
Expected: PASS — all tests in the file, including the 3 new ones

- [ ] **Step 10: Fix the two other inline `IGitHubService` mock literals**

Edit `backend/src/services/SimulationService.test.ts` — in the `makeGitHub` factory, the line `setPullRequestLabels: vi.fn().mockResolvedValue(undefined),` is currently the last property before the closing `});`. Add immediately after it:

```ts
  closePullRequest: vi.fn().mockResolvedValue(undefined),
```

Edit `backend/src/services/CiPipelineService.test.ts` — same change, same factory shape, same insertion point.

- [ ] **Step 11: Run the full backend suite to confirm nothing broke**

Run: `cd backend && pnpm lint && pnpm vitest run`
Expected: PASS — `pnpm lint` zero errors (this is what proves the two mechanical mock-literal fixes were necessary and sufficient); all tests pass, count increased by the 4 new tests from Steps 2 and 6

- [ ] **Step 12: Commit**

```bash
git add backend/src/interfaces/IGitHubService.ts backend/src/services/GitHubService.ts backend/src/services/GitHubService.test.ts backend/src/services/LocalGitHubService.ts backend/src/services/LocalGitHubService.test.ts backend/src/services/SimulationService.test.ts backend/src/services/CiPipelineService.test.ts
git commit -m "feat(github): add closePullRequest to IGitHubService and both implementations"
```

---

### Task 2: `RulesService` real implementation

**Files:**
- Rewrite: `backend/src/services/RulesService.ts`
- Test: `backend/src/services/RulesService.test.ts`

**Interfaces:**
- Consumes: `IGitHubService.readFile`/`writeFile` (unchanged, already used this way by `SimulationService.commit`); `IRulesService`, `MetricRule`, `Constraint`, `CreateMetricRuleParams`, `CreateConstraintParams`, `RulesJson` (all unchanged, already correct).
- Produces: nothing consumed by other tasks — this task is self-contained.

- [ ] **Step 1: Write the failing tests**

Create `backend/src/services/RulesService.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RulesService } from './RulesService.js';
import type { IGitHubService } from '../interfaces/IGitHubService.js';

const EMPTY_RULES = JSON.stringify({ metrics: [], constraints: [] });

function makeGitHub(initialRulesJson: string = EMPTY_RULES): IGitHubService {
  let stored = initialRulesJson;
  return {
    createBranch: vi.fn().mockResolvedValue(undefined),
    deleteBranch: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockImplementation(async () => stored),
    writeFile: vi.fn().mockImplementation(async (_branch: string, _path: string, content: string) => {
      stored = content;
    }),
    createPullRequest: vi.fn().mockResolvedValue('1'),
    mergePullRequest: vi.fn().mockResolvedValue(undefined),
    closePullRequest: vi.fn().mockResolvedValue(undefined),
    getPullRequestDiff: vi.fn().mockResolvedValue(''),
    listOpenPullRequests: vi.fn().mockResolvedValue([]),
    addPullRequestComment: vi.fn().mockResolvedValue(undefined),
    getPullRequest: vi.fn().mockResolvedValue({ title: '', head: '', labels: [], createdAt: '' }),
    setPullRequestLabels: vi.fn().mockResolvedValue(undefined),
  };
}

describe('RulesService', () => {
  let github: IGitHubService;
  let service: RulesService;

  beforeEach(() => {
    github = makeGitHub();
    service = new RulesService(github);
  });

  describe('metrics', () => {
    it('listMetrics returns an empty array when rules.json has none', async () => {
      expect(await service.listMetrics()).toEqual([]);
    });

    it('createMetric appends a new metric rule and persists it via writeFile', async () => {
      const metric = await service.createMetric({
        name: 'Room Utilization', target: 'Room', condition: 'utilization', threshold: 80,
      });

      expect(metric).toMatchObject({
        name: 'Room Utilization', target: 'Room', condition: 'utilization', threshold: 80,
      });
      expect(metric.id).toBe('metric-room-utilization');
      expect(github.writeFile).toHaveBeenCalledWith(
        'main', 'rules.json', expect.stringContaining('Room Utilization'), expect.any(String),
      );

      expect(await service.listMetrics()).toEqual([metric]);
    });

    it('createMetric generates a unique id when the slug already exists', async () => {
      github = makeGitHub(JSON.stringify({
        metrics: [{ id: 'metric-room-utilization', name: 'Room Utilization', target: 'Room', condition: 'utilization', threshold: 80 }],
        constraints: [],
      }));
      service = new RulesService(github);

      const metric = await service.createMetric({
        name: 'Room Utilization', target: 'Room', condition: 'utilization', threshold: 90,
      });

      expect(metric.id).not.toBe('metric-room-utilization');
      expect(metric.id.startsWith('metric-room-utilization-')).toBe(true);
    });

    it('deleteMetric removes the matching rule', async () => {
      github = makeGitHub(JSON.stringify({
        metrics: [{ id: 'metric-x', name: 'X', target: 'Room', condition: 'utilization', threshold: 1 }],
        constraints: [],
      }));
      service = new RulesService(github);

      await service.deleteMetric('metric-x');

      expect(await service.listMetrics()).toEqual([]);
    });

    it('deleteMetric throws notFound for an unknown id', async () => {
      await expect(service.deleteMetric('does-not-exist')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  describe('constraints', () => {
    it('listConstraints returns an empty array when rules.json has none', async () => {
      expect(await service.listConstraints()).toEqual([]);
    });

    it('createConstraint appends a new constraint and persists it via writeFile', async () => {
      const constraint = await service.createConstraint({
        name: 'No Double Booking', target: 'Room', violationCondition: 'double_booking',
      });

      expect(constraint).toMatchObject({
        name: 'No Double Booking', target: 'Room', violationCondition: 'double_booking',
      });
      expect(constraint.id).toBe('constraint-no-double-booking');

      expect(await service.listConstraints()).toEqual([constraint]);
    });

    it('deleteConstraint removes the matching constraint', async () => {
      github = makeGitHub(JSON.stringify({
        metrics: [],
        constraints: [{ id: 'constraint-x', name: 'X', target: 'Room', violationCondition: 'y' }],
      }));
      service = new RulesService(github);

      await service.deleteConstraint('constraint-x');

      expect(await service.listConstraints()).toEqual([]);
    });

    it('deleteConstraint throws notFound for an unknown id', async () => {
      await expect(service.deleteConstraint('does-not-exist')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && pnpm vitest run src/services/RulesService.test.ts`
Expected: FAIL — every test rejects with `NOT_IMPLEMENTED` (the current stub) instead of the expected value

- [ ] **Step 3: Implement `RulesService.ts`**

Replace the full contents of `backend/src/services/RulesService.ts`:

```ts
import { randomUUID } from 'crypto';
import { ApiError } from '../types/ApiError.js';
import type { IGitHubService } from '../interfaces/IGitHubService.js';
import type { IRulesService } from '../interfaces/IRulesService.js';
import type {
  MetricRule,
  CreateMetricRuleParams,
  Constraint,
  CreateConstraintParams,
} from '../types/domain.js';
import type { RulesJson } from '../types/rulesJson.js';

const SOURCE_BRANCH = 'main';
const RULES_JSON_PATH = 'rules.json';

export class RulesService implements IRulesService {
  constructor(private readonly github: IGitHubService) {}

  async listMetrics(): Promise<readonly MetricRule[]> {
    const rules = await this.readRules();
    return rules.metrics;
  }

  async createMetric(params: CreateMetricRuleParams): Promise<MetricRule> {
    const rules = await this.readRules();
    const metric: MetricRule = { id: generateId('metric', params.name, rules.metrics), ...params };
    await this.writeRules(
      { ...rules, metrics: [...rules.metrics, metric] },
      `chore(rules): add metric rule '${params.name}'`,
    );
    return metric;
  }

  async deleteMetric(metricId: string): Promise<void> {
    const rules = await this.readRules();
    if (!rules.metrics.some((m) => m.id === metricId)) {
      throw ApiError.notFound(`Metric rule '${metricId}' not found`);
    }
    const metrics = rules.metrics.filter((m) => m.id !== metricId);
    await this.writeRules({ ...rules, metrics }, `chore(rules): delete metric rule '${metricId}'`);
  }

  async listConstraints(): Promise<readonly Constraint[]> {
    const rules = await this.readRules();
    return rules.constraints;
  }

  async createConstraint(params: CreateConstraintParams): Promise<Constraint> {
    const rules = await this.readRules();
    const constraint: Constraint = { id: generateId('constraint', params.name, rules.constraints), ...params };
    await this.writeRules(
      { ...rules, constraints: [...rules.constraints, constraint] },
      `chore(rules): add constraint '${params.name}'`,
    );
    return constraint;
  }

  async deleteConstraint(constraintId: string): Promise<void> {
    const rules = await this.readRules();
    if (!rules.constraints.some((c) => c.id === constraintId)) {
      throw ApiError.notFound(`Constraint '${constraintId}' not found`);
    }
    const constraints = rules.constraints.filter((c) => c.id !== constraintId);
    await this.writeRules({ ...rules, constraints }, `chore(rules): delete constraint '${constraintId}'`);
  }

  private async readRules(): Promise<RulesJson> {
    const raw = await this.github.readFile(SOURCE_BRANCH, RULES_JSON_PATH);
    return JSON.parse(raw) as RulesJson;
  }

  private async writeRules(rules: RulesJson, message: string): Promise<void> {
    await this.github.writeFile(SOURCE_BRANCH, RULES_JSON_PATH, JSON.stringify(rules, null, 2), message);
  }
}

function generateId(prefix: string, name: string, existing: readonly { readonly id: string }[]): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const base = `${prefix}-${slug}`;
  const existingIds = new Set(existing.map((e) => e.id));
  if (!existingIds.has(base)) return base;
  return `${base}-${randomUUID().slice(0, 8)}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && pnpm vitest run src/services/RulesService.test.ts`
Expected: PASS — 8 tests passing

- [ ] **Step 5: Type-check**

Run: `cd backend && pnpm lint`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/RulesService.ts backend/src/services/RulesService.test.ts
git commit -m "feat(rules): implement RulesService against rules.json on main"
```

---

### Task 3: Proposal gaps — blocked filter + reject

**Files:**
- Modify: `backend/src/types/domain.ts`
- Modify: `backend/src/interfaces/IProposalService.ts`
- Modify: `backend/src/services/ProposalService.ts`, `backend/src/services/ProposalService.test.ts`
- Modify: `backend/src/controllers/ProposalController.ts`
- Modify: `backend/src/routes/proposals.ts`

**Interfaces:**
- Consumes: `IGitHubService.closePullRequest` (Task 1).
- Produces: `IProposalService.list(status?: 'ready' | 'blocked' | 'all'): Promise<readonly Proposal[]>`, `IProposalService.reject(proposalId: string): Promise<Proposal>` — not consumed by later tasks in this plan, but this is the contract the already-built frontend expects.

- [ ] **Step 1: Add `'REJECTED'` to the `Proposal` status union**

Edit `backend/src/types/domain.ts` — find:

```ts
export interface Proposal {
  readonly id: string;
  readonly simulationId: string;
  readonly status: 'PENDING' | 'READY' | 'BLOCKED' | 'MERGED';
  readonly createdAt: string;
}
```

Change the `status` line to:

```ts
  readonly status: 'PENDING' | 'READY' | 'BLOCKED' | 'MERGED' | 'REJECTED';
```

- [ ] **Step 2: Update the interface**

Replace `backend/src/interfaces/IProposalService.ts` in full:

```ts
import type { Proposal, ProposalDetail, CreateProposalParams } from '../types/domain.js';

export interface IProposalService {
  submit(params: CreateProposalParams): Promise<Proposal>;
  list(status?: 'ready' | 'blocked' | 'all'): Promise<readonly Proposal[]>;
  get(proposalId: string): Promise<ProposalDetail>;
  merge(proposalId: string): Promise<Proposal>;
  reject(proposalId: string): Promise<Proposal>;
}
```

- [ ] **Step 3: Write the failing tests**

Edit `backend/src/services/ProposalService.test.ts`. The file already has a `describe('ProposalService.list()', ...)` block (using `makeGitHub()`/`makeGraph()`/`makeCi()` factories already defined at the top of the file) whose default `beforeEach` does `github = makeGitHub(); service = new ProposalService(github, makeGraph(), makeCi());` — add these two new `it(...)` cases inside that existing block (after its last existing test, `'maps simulationId from the PR head branch'`):

```ts
  it("returns only BLOCKED proposals when called with 'blocked'", async () => {
    (github.listOpenPullRequests as ReturnType<typeof vi.fn>).mockResolvedValue(['1', '2']);
    (github.getPullRequest as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ title: 'P1', head: 'sim-a', labels: ['ci:ready'], createdAt: '2026-01-01T00:00:00.000Z' })
      .mockResolvedValueOnce({ title: 'P2', head: 'sim-b', labels: ['ci:blocked'], createdAt: '2026-01-02T00:00:00.000Z' });

    const result = await service.list('blocked');

    expect(result).toHaveLength(1);
    expect(result[0]?.simulationId).toBe('sim-b');
  });

  it("returns every open proposal regardless of label when called with 'all'", async () => {
    (github.listOpenPullRequests as ReturnType<typeof vi.fn>).mockResolvedValue(['1', '2']);
    (github.getPullRequest as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ title: 'P1', head: 'sim-a', labels: ['ci:ready'], createdAt: '2026-01-01T00:00:00.000Z' })
      .mockResolvedValueOnce({ title: 'P2', head: 'sim-b', labels: ['ci:blocked'], createdAt: '2026-01-02T00:00:00.000Z' });

    const result = await service.list('all');

    expect(result).toHaveLength(2);
  });
```

Then add a new top-level `describe` block after the existing `describe('ProposalService.merge()', ...)` block, mirroring its exact structure:

```ts
describe('ProposalService.reject()', () => {
  let github: IGitHubService;
  let service: ProposalService;

  beforeEach(() => {
    github = makeGitHub();
    service = new ProposalService(github, makeGraph(), makeCi());
  });

  it('closes the pull request and returns status REJECTED', async () => {
    (github.getPullRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
      title: 'Proposal: sim-alice', head: 'sim-alice', labels: ['ci:blocked'], createdAt: '2026-01-01T00:00:00.000Z',
    });

    const result = await service.reject('7');

    expect(github.closePullRequest).toHaveBeenCalledWith('7');
    expect(result).toEqual({
      id: '7', simulationId: 'sim-alice', status: 'REJECTED', createdAt: '2026-01-01T00:00:00.000Z',
    });
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd backend && pnpm vitest run src/services/ProposalService.test.ts -t "BLOCKED proposals"`
Run: `cd backend && pnpm vitest run src/services/ProposalService.test.ts -t "reject"`
Expected: FAIL — `service.list` doesn't accept/honor a status argument yet (both new `list()` cases fail); `service.reject is not a function`

- [ ] **Step 5: Implement the service changes**

Edit `backend/src/services/ProposalService.ts`. Replace the `list` method:

```ts
  async list(status: 'ready' | 'blocked' | 'all' = 'ready'): Promise<readonly Proposal[]> {
    const prIds = await this.github.listOpenPullRequests();
    const prs = await Promise.all(prIds.map((id) => this.github.getPullRequest(id)));

    return prIds
      .map((id, i) => ({ id, pr: prs[i]! }))
      .filter(({ pr }) => {
        if (status === 'all') return true;
        if (status === 'ready') return pr.labels.includes(CI_LABEL_READY);
        return pr.labels.includes(CI_LABEL_BLOCKED);
      })
      .map(({ id, pr }) => toProposal(id, pr.head, pr.labels, pr.createdAt));
  }
```

Add a new `reject` method immediately after `merge`:

```ts
  async reject(proposalId: string): Promise<Proposal> {
    const pr = await this.github.getPullRequest(proposalId);
    await this.github.closePullRequest(proposalId);

    return {
      id: proposalId,
      simulationId: pr.head,
      status: 'REJECTED',
      createdAt: pr.createdAt,
    };
  }
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd backend && pnpm vitest run src/services/ProposalService.test.ts`
Expected: PASS — all tests in the file, including the new ones

- [ ] **Step 7: Wire the controller**

Edit `backend/src/controllers/ProposalController.ts`. Replace the `list` method:

```ts
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const statusParam = req.query['status'];
      const status = statusParam === 'blocked' || statusParam === 'all' ? statusParam : 'ready';
      const proposals = await this.service.list(status);
      res.status(200).json(proposals);
    } catch (err) {
      next(err);
    }
  }
```

Add a new `reject` method after `merge`:

```ts
  async reject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const proposal = await this.service.reject(req.params['id'] as string);
      res.status(200).json(proposal);
    } catch (err) {
      next(err);
    }
  }
```

- [ ] **Step 8: Wire the route**

Edit `backend/src/routes/proposals.ts` — add after the merge route:

```ts
  // POST /proposals/:id/reject — close the PR without merging
  router.post('/:id/reject', (req, res, next) => controller.reject(req, res, next));
```

- [ ] **Step 9: Run the full backend suite**

Run: `cd backend && pnpm lint && pnpm vitest run`
Expected: PASS — zero lint errors, all tests pass

- [ ] **Step 10: Commit**

```bash
git add backend/src/types/domain.ts backend/src/interfaces/IProposalService.ts backend/src/services/ProposalService.ts backend/src/services/ProposalService.test.ts backend/src/controllers/ProposalController.ts backend/src/routes/proposals.ts
git commit -m "feat(proposals): add blocked-status filter and reject endpoint"
```

---

### Task 4: Delete simulation

**Files:**
- Modify: `backend/src/interfaces/ISimulationService.ts`
- Modify: `backend/src/services/SimulationService.ts`, `backend/src/services/SimulationService.test.ts`
- Modify: `backend/src/controllers/SimulationController.ts`
- Modify: `backend/src/routes/simulations.ts`

**Interfaces:**
- Consumes: `IGraphService.flush` (unchanged, already used elsewhere), `IGitHubService.deleteBranch` (unchanged, already used elsewhere), `ISessionRegistry.remove` (unchanged, already used by `SessionGarbageCollector`).
- Produces: `ISimulationService.delete(simulationId: string): Promise<void>` — the contract the already-built frontend's `simulationService.deleteSimulation()` expects (`DELETE /simulations/:id` → `204`).

- [ ] **Step 1: Update the interface**

Edit `backend/src/interfaces/ISimulationService.ts` — add after `getMetrics`:

```ts
  delete(simulationId: string): Promise<void>;
```

- [ ] **Step 2: Write the failing tests**

Edit `backend/src/services/SimulationService.test.ts` — add this new top-level `describe` block at the end of the file, matching the file's established per-describe local-const pattern (each existing describe block redeclares its own `const SIM_ID = 'sim-alice-abc123';`):

```ts
describe('SimulationService.delete()', () => {
  const SIM_ID = 'sim-alice-abc123';

  let github: IGitHubService;
  let graph: IGraphService;
  let registry: ISessionRegistry;
  let service: SimulationService;

  beforeEach(() => {
    github = makeGitHub();
    graph = makeGraph();
    registry = makeRegistry();
    service = new SimulationService(github, graph, registry);
  });

  it('flushes the graph session for the simulation', async () => {
    await service.delete(SIM_ID);

    expect(graph.flush).toHaveBeenCalledWith(SIM_ID);
  });

  it('deletes the GitHub branch for the simulation', async () => {
    await service.delete(SIM_ID);

    expect(github.deleteBranch).toHaveBeenCalledWith(SIM_ID);
  });

  it('removes the simulation from the session registry', async () => {
    await service.delete(SIM_ID);

    expect(registry.remove).toHaveBeenCalledWith(SIM_ID);
  });

  it('swallows a 404 from github.deleteBranch (already-deleted branch is not an error)', async () => {
    (github.deleteBranch as ReturnType<typeof vi.fn>).mockRejectedValue({ status: 404 });

    await expect(service.delete(SIM_ID)).resolves.toBeUndefined();
    expect(registry.remove).toHaveBeenCalledWith(SIM_ID);
  });

  it('swallows a 422 from github.deleteBranch (missing ref)', async () => {
    (github.deleteBranch as ReturnType<typeof vi.fn>).mockRejectedValue({ status: 422 });

    await expect(service.delete(SIM_ID)).resolves.toBeUndefined();
  });

  it('propagates an unexpected error from github.deleteBranch', async () => {
    (github.deleteBranch as ReturnType<typeof vi.fn>).mockRejectedValue({ status: 500 });

    await expect(service.delete(SIM_ID)).rejects.toMatchObject({ status: 500 });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd backend && pnpm vitest run src/services/SimulationService.test.ts -t "SimulationService.delete()"`
Expected: FAIL — `service.delete is not a function`

- [ ] **Step 4: Implement `SimulationService.delete`**

Edit `backend/src/services/SimulationService.ts` — add a new method at the end of the class (after `getMetrics`):

```ts
  async delete(simulationId: string): Promise<void> {
    await this.graph.flush(simulationId);
    try {
      await this.github.deleteBranch(simulationId);
    } catch (err) {
      if (!isMissingBranchError(err)) throw err;
    }
    this.registry.remove(simulationId);
  }
```

Add this helper function after the class, before the file ends:

```ts
function isMissingBranchError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null || !('status' in err)) return false;
  const status = (err as { status: unknown }).status;
  return status === 404 || status === 422;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && pnpm vitest run src/services/SimulationService.test.ts`
Expected: PASS — all tests in the file, including the 6 new ones

- [ ] **Step 6: Wire the controller**

Edit `backend/src/controllers/SimulationController.ts` — add a new method at the end of the class:

```ts
  async deleteSimulation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.service.delete(req.params['id'] as string);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
```

- [ ] **Step 7: Wire the route**

Edit `backend/src/routes/simulations.ts` — add after the last existing route (before `return router;`):

```ts
  // DELETE /simulations/:id — flush graph session, delete branch, remove from registry
  router.delete('/:id', (req, res, next) => controller.deleteSimulation(req, res, next));
```

- [ ] **Step 8: Run the full backend suite**

Run: `cd backend && pnpm lint && pnpm vitest run`
Expected: PASS — zero lint errors, all tests pass

- [ ] **Step 9: Commit**

```bash
git add backend/src/interfaces/ISimulationService.ts backend/src/services/SimulationService.ts backend/src/services/SimulationService.test.ts backend/src/controllers/SimulationController.ts backend/src/routes/simulations.ts
git commit -m "feat(simulations): add DELETE /simulations/:id"
```

---

### Task 5: Frontend "View Schedule"

**Files:**
- Modify: `frontend/src/organisms/PublishedScheduleCard.tsx`
- Create: `frontend/src/organisms/PublishedScheduleCard.test.tsx`

**Interfaces:**
- Consumes: `createSimulationThunk` from `frontend/src/store/reducers/simulationSlice.ts` (unchanged, already used by `CreateSimulationDialog.tsx` — same dispatch/fulfilled-match pattern).
- Produces: nothing consumed elsewhere — UI-only change.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/organisms/PublishedScheduleCard.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import userEvent from '@testing-library/user-event';
import PublishedScheduleCard from './PublishedScheduleCard';
import simulationReducer from '@/store/reducers/simulationSlice';
import { simulationService } from '@/services/simulationService';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/services/simulationService', () => ({
  simulationService: {
    createSimulation: vi.fn(),
  },
}));

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

const makeStore = () => configureStore({ reducer: { simulation: simulationReducer } });

const renderCard = () =>
  render(
    <Provider store={makeStore()}>
      <MemoryRouter>
        <PublishedScheduleCard />
      </MemoryRouter>
    </Provider>,
  );

describe('PublishedScheduleCard', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('renders the published schedule summary', () => {
    renderCard();
    expect(screen.getByText('Official Published Schedule')).toBeInTheDocument();
  });

  it('creates a simulation from main and navigates to it when "View Schedule" is clicked', async () => {
    vi.mocked(simulationService.createSimulation).mockResolvedValue({
      id: 'sim-viewer-abc123',
      branchId: 'sim-viewer-abc123',
      createdAt: new Date().toISOString(),
    });

    renderCard();
    await userEvent.click(screen.getByRole('button', { name: /view schedule/i }));

    await waitFor(() =>
      expect(simulationService.createSimulation).toHaveBeenCalledWith('viewer'),
    );
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/simulations/sim-viewer-abc123'));
  });

  it('does not navigate if simulation creation fails', async () => {
    vi.mocked(simulationService.createSimulation).mockRejectedValue({
      statusCode: 500, code: 'INTERNAL_SERVER_ERROR', message: 'boom',
    });

    renderCard();
    await userEvent.click(screen.getByRole('button', { name: /view schedule/i }));

    await waitFor(() => expect(simulationService.createSimulation).toHaveBeenCalled());
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('never navigates to the old /simulations/main stub route', async () => {
    vi.mocked(simulationService.createSimulation).mockResolvedValue({
      id: 'sim-viewer-abc123',
      branchId: 'sim-viewer-abc123',
      createdAt: new Date().toISOString(),
    });

    renderCard();
    await userEvent.click(screen.getByRole('button', { name: /view schedule/i }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
    expect(mockNavigate).not.toHaveBeenCalledWith('/simulations/main');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && pnpm vitest run src/organisms/PublishedScheduleCard.test.tsx`
Expected: FAIL — clicking "View Schedule" still navigates to `/simulations/main` directly with no service call, so the mock/navigation assertions don't match

- [ ] **Step 3: Implement the component change**

Replace the full contents of `frontend/src/organisms/PublishedScheduleCard.tsx`:

```tsx
import { useState } from 'react';
import { Box, Button, Card, CardContent, CardActions, Typography, Tooltip, CircularProgress } from '@mui/material';
import { EventNote } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '@/store/hooks';
import { createSimulationThunk } from '@/store/reducers/simulationSlice';

const PUBLISHED_SCHEDULE_VIEWER_ID = 'viewer';

/**
 * Static card representing the official published schedule on main.
 * "View Schedule" opens it by starting a simulation from `main`, the same
 * way "Create New Simulation" does — there is no separate read-only view.
 */
export default function PublishedScheduleCard(): React.ReactElement {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleViewSchedule = async (): Promise<void> => {
    setLoading(true);
    const result = await dispatch(createSimulationThunk(PUBLISHED_SCHEDULE_VIEWER_ID));
    setLoading(false);

    if (createSimulationThunk.fulfilled.match(result)) {
      navigate(`/simulations/${result.payload.id}`);
    }
  };

  return (
    <Box sx={{ mb: 4 }}>
      <Typography
        variant="overline"
        color="text.secondary"
        component="h2"
        sx={{ display: 'block', mb: 1 }}
      >
        Published Schedule
      </Typography>
      <Card variant="outlined" sx={{ borderColor: 'primary.light' }}>
        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, pb: 0 }}>
          <EventNote color="primary" sx={{ fontSize: 40 }} aria-hidden />
          <Box>
            <Typography variant="h4" component="h3">
              Official Published Schedule
            </Typography>
            <Typography variant="body2" color="text.secondary">
              The current timetable published for students and staff. Start a simulation to
              propose changes.
            </Typography>
          </Box>
        </CardContent>
        <CardActions sx={{ px: 2, pb: 2 }}>
          <Tooltip title="Opens the current published timetable in a new simulation">
            <Box component="span">
              <Button
                variant="outlined"
                onClick={() => void handleViewSchedule()}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={16} /> : undefined}
                aria-label="View the official published schedule"
              >
                {loading ? 'Opening…' : 'View Schedule'}
              </Button>
            </Box>
          </Tooltip>
        </CardActions>
      </Card>
    </Box>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && pnpm vitest run src/organisms/PublishedScheduleCard.test.tsx`
Expected: PASS — 4 tests passing

- [ ] **Step 5: Type-check and run the full frontend suite**

Run: `cd frontend && pnpm lint && pnpm vitest run`
Expected: no type errors; all tests pass (337+ existing plus the 4 new ones)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/organisms/PublishedScheduleCard.tsx frontend/src/organisms/PublishedScheduleCard.test.tsx
git commit -m "feat(frontend): View Schedule opens a real simulation instead of a dead stub route"
```

---

### Task 6: Fix stale documentation

**Files:**
- Modify: `docs/frontend-implementation-plan.md`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing — documentation-only, final task.

- [ ] **Step 1: Fix the stale header**

Edit `docs/frontend-implementation-plan.md` — the header currently reads:

```markdown
> **Status:** Scaffold complete (Task 01 done). Tasks 02–17 pending implementation.  
```

Replace with:

```markdown
> **Status:** All 17 tasks complete — all 8 screens from `DESIGN.md` are implemented and tested. Backend Gaps 1–4 (§11) were closed separately; see `docs/superpowers/specs/2026-07-23-close-backend-gaps-design.md`.  
```

- [ ] **Step 2: Verify**

Run: `grep -c "Tasks 02" docs/frontend-implementation-plan.md`
Expected: `0` (no remaining stale reference)

- [ ] **Step 3: Commit**

```bash
git add docs/frontend-implementation-plan.md
git commit -m "docs: fix stale frontend-implementation-plan.md status header"
```

---

## Self-Review Notes

- **Spec coverage:** Gap 1 (RulesService) → Task 2. Gap 2 (blocked filter) → Task 3. Gap 3 (reject) → Task 1 (interface) + Task 3 (service/controller/route). Gap 4 (delete) → Task 4. View Schedule stub → Task 5. Stale docs → Task 6. All spec sections covered.
- **Type consistency:** `IGitHubService.closePullRequest(pullRequestId: string): Promise<void>` signature is identical across Task 1's interface, both implementations, and Task 3's `ProposalService.reject()` call site. `IProposalService.list(status?: 'ready' | 'blocked' | 'all')` matches between the interface (Task 3 Step 2), the service implementation (Step 5), the controller (Step 7), and every test call site. `ISimulationService.delete(simulationId: string): Promise<void>` matches between interface, implementation, controller, and test.
- **Frontend contract match:** every backend response shape in this plan was checked against the already-built, unchanged frontend service files (`rulesService.ts`, `proposalService.ts`, `simulationService.ts`) rather than assumed — confirmed during design, not just planning.
- **Cross-task test fragility:** Task 1's interface change is the one change in this plan that ripples outside its own files (into `SimulationService.test.ts` and `CiPipelineService.test.ts`'s unrelated mock literals) — Task 1 explicitly fixes both before moving on, so Tasks 2-4 never see a broken `pnpm lint`.
