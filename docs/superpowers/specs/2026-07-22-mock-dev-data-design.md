# Mock Development Data — Design

## Problem

Running the backend today requires a real GitHub repository containing `schedule.json` and `rules.json`, plus a GitHub PAT with `repo` scope (see `ONBOARDING.md` §2 / `README.md` prerequisites). This is the main barrier for a new contributor to get `make dev` working, and there is no fixture data usable by automated end-to-end tests either.

## Goal

Let a developer clone the repo, `cp backend/.env.example backend/.env`, and run `make dev` with a fully working backend — no GitHub account, no PAT, no separate schedule repo — using bundled realistic mock data. Reuse the same mock data as the seed for a new backend e2e test.

## Non-goals

- Mocking Memgraph/Docker. Memgraph requires no credentials and is already a listed prerequisite (`docker-compose.yml` provisions it locally); it stays real everywhere, including in the new e2e test.
- Fixing `RulesService`'s `501 Not Implemented` stub (tracked separately as Gap 1 in `DESIGN.md`).
- Frontend-side API mocking (e.g. MSW) — out of scope; this work is backend-only.
- Persisting local mock GitHub state across server restarts — the mock is reseeded from the fixture files on every process start.

## Architecture

### `LocalGitHubService`

New file `backend/src/services/LocalGitHubService.ts`, implementing the existing `IGitHubService` interface as a pure in-memory fake:

- **Branches:** `Map<branchName, Map<path, content>>`. Seeded with a `main` branch built from the two fixture files below.
- **Pull requests:** `Map<prId, { head, base, title, body, labels, createdAt, state }>` — `prId` is a simple incrementing counter, stringified (matching the real service's numeric PR IDs).
- `createBranch(name, source)` — copies the source branch's file map into a new entry; throws `ApiError.notFound` if the source doesn't exist.
- `deleteBranch(name)` — removes the map entry.
- `readFile(branch, path)` / `writeFile(branch, path, content, message)` — read/write the branch's file map; `readFile` throws `ApiError.notFound` if branch or path is missing. `message` is accepted but not persisted (no commit history is modeled).
- `createPullRequest(head, base, title, body)` — allocates the next PR id, stores the record with `state: 'open'`, `labels: []`.
- `mergePullRequest(id)` — copies every file from the PR's head branch onto its base branch; marks `state: 'merged'`.
- `getPullRequestDiff(id)` — reads `schedule.json` from base and head branches and produces a unified diff via the `diff` package (`createTwoFilesPatch`), so the frontend's existing `diffParser.ts` (which expects unified-diff `-`/`+` lines) keeps working unchanged.
- `listOpenPullRequests()`, `getPullRequest()`, `setPullRequestLabels()`, `addPullRequestComment()` — straightforward map operations mirroring the real service's semantics.

New dependency: `diff` (backend `dependencies`).

### Wiring

`container.ts` chooses between `GitHubService` (real Octokit) and `LocalGitHubService` based on a new env var:

```
GITHUB_PROVIDER = 'github' | 'mock'
```

- **Code-level default when unset: `github`** — preserves current behavior for any existing deployment/CI config that doesn't know about this var.
- **`.env.example` ships with `GITHUB_PROVIDER=mock`** — so a fresh `cp .env.example .env` gives a zero-account dev setup. `GITHUB_TOKEN`/`GITHUB_OWNER`/`GITHUB_REPO` remain in the file, commented as "only required when `GITHUB_PROVIDER=github`".

## Mock Data Content

Two new fixture files, checked into git:

- `backend/src/fixtures/mock-schedule.json` — matches the `ScheduleJson` schema (`docs/schedule-schema.md`): ~4 rooms, 3 professors, 3 student groups, 5 courses, ~10 classes spread across Monday–Wednesday.
  - **One intentional conflict** (two classes double-booked in the same room + time slot) so a fresh `make dev` immediately shows a real conflict in the HUD, and the e2e test has something concrete to resolve.
- `backend/src/fixtures/mock-rules.json` — matches `RulesJson`: 1–2 metric rules (e.g. Room Utilization) + 1 hard constraint, so the HUD and Rule Builder aren't empty out of the box.

`LocalGitHubService` loads these via `fs.readFileSync(new URL('../fixtures/...', import.meta.url))` so it works identically under `tsx` (dev, reads from `src/`) and compiled output. The backend build script is updated to copy `src/fixtures/**` into `dist/fixtures/` so `pnpm build`/`pnpm start` keep working.

## Documentation Updates

- `backend/.env.example` — add `GITHUB_PROVIDER=mock`; comment the GitHub vars as optional.
- `README.md` — note in Quick Start that the default `.env.example` needs no GitHub account; add a short "Using a real GitHub repo" subsection describing how to switch `GITHUB_PROVIDER=github` and fill in the GitHub vars.
- `ONBOARDING.md` — new subsection near §2/§3 explaining `LocalGitHubService`: what it fakes, what it doesn't (no real branches/PRs on GitHub, no commit history), and where the fixture files live.

## Testing

### Unit tests

`backend/src/services/LocalGitHubService.test.ts`, mirroring the coverage of `GitHubService.test.ts`: branch create/delete (including missing-source error), read/write (including missing-file error), PR create/get/list/labels/comment, merge (verifying base branch files are updated), and diff generation (verifying the output contains recognizable `-`/`+` lines for a changed class).

### E2E test

New `backend/src/e2e/simulationFlow.e2e.test.ts` using `supertest` (new devDependency) against the real `createApp()`:

- Forces `process.env['GITHUB_PROVIDER'] = 'mock'` before importing the app, regardless of the developer's real `.env`.
- Requires a real Memgraph reachable at `MEMGRAPH_URI` (default `bolt://localhost:7687`) — start via `docker compose up -d memgraph`.
- Flow: `POST /simulations` → `GET /simulations/:id/classes` (confirm seeded data) → `GET /simulations/:id/conflicts` (confirm the seeded conflict is present) → `PATCH` the conflicting class to resolve it → `GET /conflicts` again (confirm 0) → `POST /simulations/:id/commit` → `POST /proposals` (expect `status: 'READY'`) → `POST /proposals/:id/merge` (expect success).
- New `backend/package.json` script: `"test:e2e": "vitest run -t e2e"` (or a dedicated e2e vitest project/include pattern), **excluded from the default `pnpm test`/`pnpm test:coverage`** so CI and the regular test suite stay dependency-free. Documented in README as an opt-in command requiring Docker.

## Summary of new/changed files

- `backend/src/services/LocalGitHubService.ts` (new)
- `backend/src/services/LocalGitHubService.test.ts` (new)
- `backend/src/fixtures/mock-schedule.json` (new)
- `backend/src/fixtures/mock-rules.json` (new)
- `backend/src/e2e/simulationFlow.e2e.test.ts` (new)
- `backend/src/container.ts` (edit — provider switch)
- `backend/.env.example` (edit)
- `backend/package.json` (edit — `diff`, `supertest`, `test:e2e` script, build script fixture copy)
- `README.md`, `ONBOARDING.md` (edit)
