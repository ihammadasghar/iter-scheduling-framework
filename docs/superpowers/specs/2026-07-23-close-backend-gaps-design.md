# Close Backend Gaps + Published Schedule View — Design

## Problem

The frontend (all 8 screens from `DESIGN.md`) is fully built and already anticipates four backend gaps documented in `DESIGN.md §11` / `ONBOARDING.md §9` — it degrades gracefully around each, but the underlying features don't exist server-side:

- **Gap 1:** `RulesService` (`backend/src/services/RulesService.ts`) returns `501 Not Implemented` for all 6 endpoints — blocks the Rule Builder screen (S8) from functioning.
- **Gap 2:** `GET /proposals` has no `?status=` filter — the Admin Proposal Dashboard's "blocked" section is always empty.
- **Gap 3:** `POST /proposals/:id/reject` doesn't exist — the "Close This Proposal" button on the Diff Review screen silently no-ops.
- **Gap 4:** `DELETE /simulations/:id` doesn't exist — "Delete Draft" on the Simulation Dashboard silently no-ops.

Additionally, the "View Schedule" button on the Simulation Dashboard's Published Schedule card navigates to a non-existent `/simulations/main` route and 404s (`PublishedScheduleCard.tsx`'s own comment: *"soft stub until the read-only simulation view is implemented"*).

## Goal

Implement all four backend gaps and replace the View Schedule stub, so every screen the frontend already built works end-to-end against real backend behavior (mock or real GitHub — both code paths must support all four gaps identically, since `LocalGitHubService` implements the same `IGitHubService` interface).

## Non-goals

- Playwright/browser-based e2e test infrastructure — explicitly deferred to a separate follow-up project per user's chosen sequencing.
- A genuinely read-only "published schedule" view distinct from a simulation — user chose the simpler option: reuse the existing simulation-creation flow.
- Any change to the CI pipeline, conflict detection, or metric evaluation logic.

## Design

### Gap 1 — `RulesService`

`backend/src/services/RulesService.ts` currently throws `ApiError.notImplemented()` from all 6 methods. Replace with real implementations reading/writing `rules.json` on `main`, following the exact read-parse-mutate-write pattern `SimulationService.commit()` already uses via `IGitHubService`:

```
listMetrics()      → readFile('main', 'rules.json') → parse → return .metrics
createMetric(p)    → read → parse → append { id: generateId('metric', p.name), ...p } → writeFile('main', 'rules.json', ..., 'chore(rules): add metric rule')
                     → return the created MetricRule
deleteMetric(id)   → read → parse → filter out id (404 if not present) → writeFile(...)
listConstraints()/createConstraint(p)/deleteConstraint(id) → same pattern for the constraints array
```

`generateId(prefix, name)`: slugify `name` (lowercase, spaces/non-alphanumerics → `-`) prefixed with `prefix-`, plus a short random suffix if the slug collides with an existing id — mirrors the fixture's `metric-room-utilization` naming style. No interface changes — `IRulesService`, `MetricRule`, `Constraint`, `CreateMetricRuleParams`, `CreateConstraintParams` are already correct and already match the frontend's `rulesService.ts` exactly.

`RulesService` already takes `IGitHubService` in its constructor (unused today) — no wiring changes in `container.ts` needed.

### Gap 2 — Blocked proposals filter

`GET /proposals` gains an optional `status` query param: `ready` (default) | `blocked` | `all`.

- `IProposalService.list()` signature changes to `list(status?: 'ready' | 'blocked' | 'all'): Promise<readonly Proposal[]>`.
- `ProposalService.list(status = 'ready')`: fetch all open PRs (unchanged), map to `Proposal` via the existing `labelsToStatus`, then filter: `ready` → status `READY`, `blocked` → status `BLOCKED`, `all` → no filter.
- `ProposalController.list` reads `req.query['status']` and passes it through (default `'ready'` if absent/invalid, matching current behavior for the frontend's plain `GET /proposals` call).

This exactly matches what `frontend/src/services/proposalService.ts` already calls: `listProposals()` → `GET /proposals` (no params, gets `ready`), `listBlockedProposals()` → `GET /proposals?status=blocked`.

### Gap 3 — Reject proposal

New interface method on `IGitHubService`:
```ts
closePullRequest(pullRequestId: string): Promise<void>;
```
- `GitHubService.closePullRequest`: `octokit.rest.pulls.update({ owner, repo, pull_number, state: 'closed' })`.
- `LocalGitHubService.closePullRequest`: sets the PR record's `state` to `'closed'` (extends the existing `'open' | 'merged'` union to `'open' | 'merged' | 'closed'`) and removes it from `listOpenPullRequests()`'s results (same filter as merged).

`IProposalService` gains `reject(proposalId: string): Promise<Proposal>`. `ProposalService.reject`: fetch the PR (404 if missing), call `github.closePullRequest(id)`, return `{ id, simulationId: pr.head, status: 'REJECTED', createdAt: pr.createdAt }`.

**Type change:** backend `Proposal['status']` in `domain.ts` gains `'REJECTED'` (currently `'PENDING' | 'READY' | 'BLOCKED' | 'MERGED'`) — the frontend's `ProposalStatus` already has it (`frontend/src/types/domain.ts:42`), confirming this is the expected contract, not a new invention.

New route: `POST /proposals/:id/reject` → `ProposalController.reject` → `res.status(200).json(proposal)`.

### Gap 4 — Delete simulation

`ISimulationService` gains `delete(simulationId: string): Promise<void>`. `SimulationService.delete`: `graph.flush(id)`, `github.deleteBranch(id)`, `registry.remove(id)` — all three already exist and are already used elsewhere (the same flush/deleteBranch pair runs in `SessionGarbageCollector` and in `SimulationService.create`'s rollback path).

Idempotency: confirmed `GraphService.flush` (a `DETACH DELETE` scoped by `branchId` — matches zero nodes harmlessly if already flushed) and `LocalGitHubService.deleteBranch` (`Map.delete`, never throws on a missing key) both already tolerate a missing/already-gone target. The real `GitHubService.deleteBranch` (`octokit.rest.git.deleteRef`) can 422/404 if the ref is already gone — `SimulationService.delete` must catch and swallow that specific error (delete is meant to be idempotent from the caller's perspective; a simulation that's already gone is a success, not a failure) while still propagating any other unexpected error.

New route: `DELETE /simulations/:id` → `SimulationController.deleteSimulation` → `res.status(204).send()`.

### Frontend — "View Schedule"

`PublishedScheduleCard.tsx`: remove the `navigate('/simulations/main')` stub. Replace the button's `onClick` with the same dispatch `CreateSimulationDialog` already performs (`createSimulationThunk({ userId: 'viewer' })` or similar fixed label) followed by navigation to the resulting `/simulations/:id`. No new component, no new route, no new backend endpoint — this is a UI-only change reusing the existing, already-working simulation-creation flow.

## Testing

- **Unit tests** (mocked `IGitHubService`, following existing patterns in `ProposalService.test.ts` / `SimulationService.test.ts`): `RulesService.test.ts` (new — all 6 methods, including the "not found" delete case and id-collision handling), `ProposalService.test.ts` additions (status filter variants, reject happy-path + not-found), `SimulationService.test.ts` addition (delete happy path).
- **`LocalGitHubService.test.ts`** additions: `closePullRequest` removes the PR from `listOpenPullRequests()` and sets its state; a rejected/closed PR is distinguishable from a merged one.
- **`GitHubService.test.ts`** addition: `closePullRequest` calls `octokit.rest.pulls.update` with `state: 'closed'`.
- **Existing e2e test** (`simulationFlow.e2e.test.ts`) is unaffected — no changes required, but a follow-up could extend it to cover reject/delete once this lands (left for the e2e-infrastructure follow-up project).
- **Frontend**: `PublishedScheduleCard.test.tsx` (existing, if present) updated to assert the new dispatch+navigate behavior instead of the old stub navigation.

## Summary of new/changed files

- `backend/src/services/RulesService.ts` (rewrite — real implementation)
- `backend/src/services/RulesService.test.ts` (new)
- `backend/src/interfaces/IGitHubService.ts` (edit — add `closePullRequest`)
- `backend/src/services/GitHubService.ts` / `.test.ts` (edit — implement + test `closePullRequest`)
- `backend/src/services/LocalGitHubService.ts` / `.test.ts` (edit — implement + test `closePullRequest`, extend PR state union)
- `backend/src/interfaces/IProposalService.ts` (edit — `list(status?)`, add `reject`)
- `backend/src/services/ProposalService.ts` / `.test.ts` (edit — status filter, `reject`)
- `backend/src/controllers/ProposalController.ts` (edit — pass `status` query param, add `reject` handler)
- `backend/src/routes/proposals.ts` (edit — new `POST /:id/reject` route)
- `backend/src/interfaces/ISimulationService.ts` (edit — add `delete`)
- `backend/src/services/SimulationService.ts` / `.test.ts` (edit — `delete`)
- `backend/src/controllers/SimulationController.ts` (edit — add `deleteSimulation` handler)
- `backend/src/routes/simulations.ts` (edit — new `DELETE /:id` route)
- `backend/src/types/domain.ts` (edit — add `'REJECTED'` to `Proposal['status']`)
- `frontend/src/organisms/PublishedScheduleCard.tsx` / test (edit — reuse simulation-creation flow)
- `docs/frontend-implementation-plan.md` (edit — fix stale header)
