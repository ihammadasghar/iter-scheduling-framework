# GitHub Repo Setup Script + Large Mock Dataset — Design

## Problem

Running the backend against a **real** GitHub repo (`GITHUB_PROVIDER=github`) requires a developer to manually create a repository, hand-craft `schedule.json`/`rules.json`, generate a PAT, and wire four env vars into `backend/.env`. There's no tooling for this, and no realistically large dataset to test the real Git-flow (branch → PR → CI → merge) against — the bundled `mock-schedule.json` (10 classes) is deliberately small, dev-only fixture data for `LocalGitHubService`.

## Goal

One command that: creates (or reuses) a real GitHub repo, seeds it with a realistically large, conflict-free university schedule, and wires the project's `.env` to point at it — so a developer can exercise the real GitHub-backed code path end-to-end.

## Non-goals

- Changing `LocalGitHubService` or the bundled dev fixtures (`backend/src/fixtures/mock-*.json`) — those stay small and untouched.
- A UI for this — command-line only.
- Managing the repo's lifecycle beyond create/reuse (no teardown/delete command in this pass).

## Design

### 1. Mock data generator — `backend/src/scripts/generate-large-schedule.ts`

Lives inside `backend/src/` (not a repo-root `scripts/` dir) specifically so it's automatically picked up by the backend's existing `vitest.config.ts` (`include: ['src/**/*.test.ts']`) and `tsconfig.json` (`include: ["src/**/*"]`) — no new test-runner config needed. Run via `cd backend && pnpm tsx src/scripts/generate-large-schedule.ts <outDir>` (a new `backend/package.json` script, `"generate:mock-data": "tsx src/scripts/generate-large-schedule.ts"`, wraps this). Imports `ScheduleJson`/`RulesJson` and their constituent types directly from `../types/scheduleJson.ts` / `../types/rulesJson.ts` so the generator can't silently drift from the real schema.

**Scale** (fixed constants in the script, per the chosen "Large" tier):
- 40 rooms, 80 professors, 40 student groups, 150 courses
- 25 time slots: 5 days (Monday–Friday) × 5 periods/day, contiguous non-overlapping times per day (e.g. period 1 08:30–10:00, period 2 10:15–11:45, ... period 5 16:45–18:15)
- ~1500 classes (roughly one section per course per relevant student-group/professor pairing, generated until the target count is reached)

**Placement algorithm:** for each class to place, iterate candidate `(room, timeSlot)` pairs in a deterministic order and pick the first one where:
- no other already-placed class occupies that room at that time slot (no `ROOM_DOUBLE_BOOK`)
- the assigned professor has no other class at that time slot (no `PROFESSOR_OVERLAP`)
- the assigned student group has no other class at that time slot (no `GROUP_OVERLAP`)

This mirrors exactly the three conflict types `GraphService.queryConflicts` checks, so the generated `main` schedule starts genuinely conflict-free — realistic for a "published, already-solved" timetable. (40 rooms × 25 slots = 1000 room-slot capacity; ~1500 classes means some classes will be single-period only to fit, which is fine and realistic.)

Professor/student-group assignment per class: round-robin-ish selection from the relevant department's professors/groups (courses get a department field, same as the existing small fixture), so the data reads as plausible rather than fully random.

**`rules.json`:** include the same handful of realistic metric rules as the existing `mock-rules.json` (Room Utilization, Avg Classes per Professor per Day) plus one hard constraint entry — scaled thresholds make sense at this size (e.g. utilization threshold still 80%).

Output: writes `schedule.json` and `rules.json` to the directory passed as the script's argument.

### 2. Setup script — `scripts/setup-github-repo.sh`

```bash
scripts/setup-github-repo.sh [repo-name] [--owner=<org-or-user>] [--public]
```
- Default `repo-name`: `iter-scheduling-data`. Default `--owner`: the currently-authenticated `gh` user (`gh api user --jq .login`). Default visibility: private (explicit `--public` flag to override).

Steps:
1. `gh auth status` — exit with a clear error message if not logged in (tell the user to run `gh auth login` first).
2. `gh repo view "$OWNER/$REPO"` — if it succeeds (repo exists), reuse it; if it fails (repo doesn't exist), `gh repo create "$OWNER/$REPO" --private|--public --description "..."`.
3. Run the generator into a temp directory: `(cd backend && pnpm generate:mock-data "$TMPDIR")`.
4. In the temp directory: `git init` (or `git clone` the existing repo if reusing, to preserve history), copy in the two generated JSON files, `git add`/`commit`/`push` to `main`.
5. `TOKEN=$(gh auth token)`.
6. Update `backend/.env`:
   - If `backend/.env` doesn't exist, `cp backend/.env.example backend/.env` first.
   - Back up the current `backend/.env` to `backend/.env.bak`.
   - Replace (or append, if missing) exactly these four lines: `GITHUB_PROVIDER=github`, `GITHUB_TOKEN=$TOKEN`, `GITHUB_OWNER=$OWNER`, `GITHUB_REPO=$REPO`. Every other line (`PORT`, `MEMGRAPH_*`, `SESSION_TTL_MS`, etc.) is left exactly as it was.
7. Print a summary: the repo URL, and a reminder to run `make dev` (or restart the backend if already running, since `container.ts` reads `GITHUB_PROVIDER` at process start).

**Safety:** the script never deletes a repo, never force-pushes, and never touches `backend/.env` without first backing it up. Running the actual script against a real GitHub account is a real, externally-visible action — this will be run only with the user's explicit go-ahead at execution time, separate from writing/committing the script itself.

## Testing

- The generator is deterministic given its fixed constants — a lightweight unit test (`backend/src/scripts/generate-large-schedule.test.ts`, picked up automatically by the default `pnpm test`) asserts the output is schema-valid (mirrors `mockFixtures.test.ts`'s existing checks) and, more importantly, that the placement algorithm produces **zero** conflicts (cross-check every class pairwise for room/professor/group overlap at the same time slot, same technique already used in `mockFixtures.test.ts`).
- The bash script itself is not unit-tested (shell orchestration around external `gh`/`git` commands) — it will be manually verified end-to-end with the user's explicit consent when actually run.

## Summary of new files

- `backend/src/scripts/generate-large-schedule.ts` (new)
- `backend/src/scripts/generate-large-schedule.test.ts` (new — schema + zero-conflict validation)
- `backend/package.json` (edit — add `generate:mock-data` script)
- `scripts/setup-github-repo.sh` (new, at repo root, alongside `Makefile`/`docker-compose.yml`)
- `Makefile` (edit — optional `setup-github` convenience target)
