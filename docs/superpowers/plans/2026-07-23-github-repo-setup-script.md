# GitHub Repo Setup Script + Large Mock Dataset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A generator that produces a realistically large (~1500-class), conflict-free university schedule matching the real `ScheduleJson`/`RulesJson` schema, and a script that creates (or reuses) a real GitHub repository, pushes that data to it, and wires `backend/.env` to point at it — so a developer can exercise the real GitHub-backed code path (`GITHUB_PROVIDER=github`) end-to-end, not just the bundled mock mode.

**Architecture:** A pure, deterministic TypeScript data generator (importing the project's real schema types so it can't drift), invoked by a bash orchestration script that owns all the external, stateful actions (GitHub CLI, git, `.env` mutation).

**Tech Stack:** TypeScript (Node, `tsx`), bash, GitHub CLI (`gh`), git.

## Global Constraints

- The generator (`backend/src/scripts/generate-large-schedule.ts`) must be **fully deterministic** — no `Math.random()`, no `Date.now()`, no argless `new Date()`. Every value is derived from fixed constants and array indices, so calling it twice produces byte-identical output (this is directly tested).
- Capacity math must hold: with 25 time slots, the generator MUST have `rooms >= ceil(TARGET_CLASSES / 25)` AND `studentGroups >= ceil(TARGET_CLASSES / 25)` — otherwise a conflict-free placement is mathematically impossible and the generator will throw. At `TARGET_CLASSES = 1500` and `25` time slots, that's a hard minimum of 60 rooms and 60 groups; this plan uses 80 of each for a realistic 75% target utilization with margin.
- Backend compiles to CommonJS (confirmed: `backend/dist/*.js` starts with `"use strict"; ... require(...)`, no `"type": "module"` in `backend/package.json`). The generator's CLI-entry-point guard must use `require.main === module`, not `import.meta.url`.
- **Never execute `scripts/setup-github-repo.sh` for real (against a live GitHub account) during implementation or review.** It creates a real repository and rewrites `backend/.env` — a real, externally-visible, hard-to-fully-reverse action. Verify it via `bash -n scripts/setup-github-repo.sh` (syntax check) and careful reading only. Actually running it happens later, with the user's separate, explicit go-ahead, outside this plan's automated task loop.
- `scripts/setup-github-repo.sh` must never `--force` push, never delete a repository, and must back up `backend/.env` to `backend/.env.bak` before modifying it, preserving every line it doesn't explicitly need to change (`PORT`, `MEMGRAPH_*`, `SESSION_TTL_MS`, `GC_INTERVAL_MS`, etc.).
- The generator's output must satisfy the same structural checks `backend/src/fixtures/mockFixtures.test.ts` already applies to the small bundled fixture (every class's foreign keys resolve; metric rules use target/condition pairs supported by `MetricRuleTranslator`) — reuse that file's exact verification technique, don't invent a different one.

---

## File Map

| File | Status | Responsibility |
|---|---|---|
| `backend/src/scripts/generate-large-schedule.ts` | New | Deterministic large-scale schedule/rules generator (importable function + CLI entry point) |
| `backend/src/scripts/generate-large-schedule.test.ts` | New | Scale, referential-integrity, zero-conflict, and determinism checks |
| `backend/package.json` | Modify | Add `generate:mock-data` script |
| `scripts/setup-github-repo.sh` | New | Create/reuse a real GitHub repo, push generated data, wire `backend/.env` |
| `Makefile` | Modify | Add `setup-github` convenience target |

---

### Task 1: Large Mock Data Generator

**Files:**
- Create: `backend/src/scripts/generate-large-schedule.ts`
- Test: `backend/src/scripts/generate-large-schedule.test.ts`
- Modify: `backend/package.json`

**Interfaces:**
- Consumes: `ScheduleJson`, `RawRoom`, `RawProfessor`, `RawStudentGroup`, `RawCourse`, `RawTimeSlot`, `RawClass` from `backend/src/types/scheduleJson.ts` (unchanged); `RulesJson` from `backend/src/types/rulesJson.ts` (unchanged).
- Produces: `export function generateLargeSchedule(): { schedule: ScheduleJson; rules: RulesJson }` — Task 2's bash script invokes this indirectly via the CLI entry point (`pnpm generate:mock-data -- <outDir>`), writing `schedule.json`/`rules.json` to the given directory.

- [ ] **Step 1: Write the failing tests**

Create `backend/src/scripts/generate-large-schedule.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { generateLargeSchedule } from './generate-large-schedule.js';

describe('generateLargeSchedule', () => {
  const { schedule, rules } = generateLargeSchedule();

  it('generates the target scale', () => {
    expect(schedule.rooms.length).toBe(80);
    expect(schedule.professors.length).toBe(80);
    expect(schedule.studentGroups.length).toBe(80);
    expect(schedule.courses.length).toBe(160);
    expect(schedule.timeSlots.length).toBe(25);
    expect(schedule.classes.length).toBe(1500);
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

  it('has zero room, professor, or student-group double-bookings', () => {
    const byRoomSlot = new Map<string, string[]>();
    const byProfSlot = new Map<string, string[]>();
    const byGroupSlot = new Map<string, string[]>();

    for (const cls of schedule.classes) {
      for (const slotId of cls.timeSlotIds) {
        const roomKey = `${cls.roomId}::${slotId}`;
        const profKey = `${cls.professorId}::${slotId}`;
        const groupKey = `${cls.studentGroupId}::${slotId}`;
        byRoomSlot.set(roomKey, [...(byRoomSlot.get(roomKey) ?? []), cls.id]);
        byProfSlot.set(profKey, [...(byProfSlot.get(profKey) ?? []), cls.id]);
        byGroupSlot.set(groupKey, [...(byGroupSlot.get(groupKey) ?? []), cls.id]);
      }
    }

    expect([...byRoomSlot.values()].every((ids) => ids.length === 1)).toBe(true);
    expect([...byProfSlot.values()].every((ids) => ids.length === 1)).toBe(true);
    expect([...byGroupSlot.values()].every((ids) => ids.length === 1)).toBe(true);
  });

  it('rules.json metric rules use target/condition combinations supported by MetricRuleTranslator', () => {
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

  it('is deterministic — generating twice produces identical output', () => {
    const second = generateLargeSchedule();
    expect(second.schedule).toEqual(schedule);
    expect(second.rules).toEqual(rules);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && pnpm vitest run src/scripts/generate-large-schedule.test.ts`
Expected: FAIL — `Cannot find module './generate-large-schedule.js'`

- [ ] **Step 3: Implement the generator**

Create `backend/src/scripts/generate-large-schedule.ts`:

```ts
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import type {
  ScheduleJson,
  RawRoom,
  RawProfessor,
  RawStudentGroup,
  RawCourse,
  RawTimeSlot,
  RawClass,
} from '../types/scheduleJson.js';
import type { RulesJson } from '../types/rulesJson.js';

// ── Scale constants ──────────────────────────────────────────────────────────
// Capacity math: 25 time slots require rooms >= 60 and studentGroups >= 60 to
// place 1500 classes without a ROOM_DOUBLE_BOOK or GROUP_OVERLAP conflict.
// 80 of each gives a realistic ~75% target utilization with margin.

const DEPARTMENTS = [
  { name: 'Biology', code: 'BIO' },
  { name: 'Chemistry', code: 'CHE' },
  { name: 'History', code: 'HIS' },
  { name: 'Mathematics', code: 'MAT' },
  { name: 'Physics', code: 'PHY' },
  { name: 'Computer Science', code: 'COM' },
  { name: 'English', code: 'ENG' },
  { name: 'Economics', code: 'ECO' },
  { name: 'Psychology', code: 'PSY' },
  { name: 'Art', code: 'ART' },
  { name: 'Sociology', code: 'SOC' },
  { name: 'Philosophy', code: 'PHI' },
  { name: 'Geology', code: 'GEO' },
  { name: 'Statistics', code: 'STA' },
  { name: 'Political Science', code: 'POL' },
  { name: 'Music', code: 'MUS' },
  { name: 'Anthropology', code: 'ANT' },
  { name: 'Linguistics', code: 'LIN' },
  { name: 'Environmental Science', code: 'ENV' },
  { name: 'Astronomy', code: 'AST' },
] as const;

const PROFESSORS_PER_DEPT = 4;
const GROUPS_PER_DEPT = 4;
const COURSES_PER_DEPT = 8;
const NUM_ROOMS = 80;
const TARGET_CLASSES = 1500;

const FIRST_NAMES = [
  'Jane', 'Alan', 'Bob', 'Maria', 'Wei', 'Fatima', 'John', 'Priya', 'Carlos', 'Aisha',
  'David', 'Elena', 'Kenji', 'Sofia', 'Omar', 'Grace', 'Liam', 'Noor', 'Ivan', 'Mei',
];
const LAST_NAMES = ['Smith', 'Jones', 'Chen', 'Garcia', 'Khan', 'Muller', 'Kim', 'Patel', 'Silva', 'Nguyen'];
const COURSE_TEMPLATES = [
  'Introduction to', 'Advanced', 'Foundations of', 'Topics in',
  'Principles of', 'Seminar in', 'Applied', 'History of',
];
const ROOM_BUILDINGS = ['Science Hall', 'Arts Block', 'Main Hall', 'Engineering Building', 'Library Annex'];
const ROOM_CAPACITIES = [30, 40, 50, 60, 80, 100];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const DAY_CODES: Record<string, string> = {
  Monday: 'MON', Tuesday: 'TUE', Wednesday: 'WED', Thursday: 'THU', Friday: 'FRI',
};
const PERIODS = [
  { name: 'Period 1', startTime: '08:30', endTime: '10:00' },
  { name: 'Period 2', startTime: '10:15', endTime: '11:45' },
  { name: 'Period 3', startTime: '12:00', endTime: '13:30' },
  { name: 'Period 4', startTime: '13:45', endTime: '15:15' },
  { name: 'Period 5', startTime: '15:30', endTime: '17:00' },
];

// ── Master data generation ───────────────────────────────────────────────────

function buildRooms(): RawRoom[] {
  return Array.from({ length: NUM_ROOMS }, (_, i) => ({
    id: `RM_${String(101 + i).padStart(3, '0')}`,
    name: `Room ${101 + i}`,
    capacity: ROOM_CAPACITIES[i % ROOM_CAPACITIES.length]!,
    building: ROOM_BUILDINGS[i % ROOM_BUILDINGS.length]!,
  }));
}

function buildTimeSlots(): RawTimeSlot[] {
  const slots: RawTimeSlot[] = [];
  for (const day of DAYS) {
    PERIODS.forEach((period, i) => {
      slots.push({
        id: `TS_${DAY_CODES[day]}_P${i + 1}`,
        day,
        name: period.name,
        startTime: period.startTime,
        endTime: period.endTime,
      });
    });
  }
  return slots;
}

interface DeptEntities {
  readonly professors: readonly RawProfessor[];
  readonly studentGroups: readonly RawStudentGroup[];
  readonly courses: readonly RawCourse[];
}

function buildDepartmentEntities(): DeptEntities[] {
  return DEPARTMENTS.map((dept, deptIndex) => {
    const professors: RawProfessor[] = Array.from({ length: PROFESSORS_PER_DEPT }, (_, i) => {
      const globalIndex = deptIndex * PROFESSORS_PER_DEPT + i;
      const firstName = FIRST_NAMES[globalIndex % FIRST_NAMES.length]!;
      const lastName = LAST_NAMES[globalIndex % LAST_NAMES.length]!;
      const title = i % 2 === 0 ? 'Dr.' : 'Prof.';
      return {
        id: `PRF_${dept.code}_${i + 1}`,
        name: `${title} ${firstName} ${lastName}`,
        department: dept.name,
      };
    });

    const studentGroups: RawStudentGroup[] = Array.from({ length: GROUPS_PER_DEPT }, (_, i) => ({
      id: `GRP_${dept.code}_Y${i + 1}`,
      name: `${dept.name} Year ${i + 1}`,
      size: 20 + (i % 4) * 10,
    }));

    const courses: RawCourse[] = Array.from({ length: COURSES_PER_DEPT }, (_, i) => ({
      id: `CRS_${dept.code}_${101 + i}`,
      code: `${dept.code}${101 + i}`,
      name: `${COURSE_TEMPLATES[i % COURSE_TEMPLATES.length]} ${dept.name}`,
      department: dept.name,
    }));

    return { professors, studentGroups, courses };
  });
}

// ── Class placement ──────────────────────────────────────────────────────────

function buildClasses(
  deptEntities: readonly DeptEntities[],
  rooms: readonly RawRoom[],
  timeSlots: readonly RawTimeSlot[],
): RawClass[] {
  const allCourses = deptEntities.flatMap((d, deptIndex) =>
    d.courses.map((course) => ({ course, deptIndex })),
  );

  const roomSlotPairs: Array<{ roomId: string; timeSlotId: string }> = [];
  for (const room of rooms) {
    for (const slot of timeSlots) {
      roomSlotPairs.push({ roomId: room.id, timeSlotId: slot.id });
    }
  }

  const occupiedRoomSlot = new Set<string>();
  const occupiedProfSlot = new Set<string>();
  const occupiedGroupSlot = new Set<string>();
  const deptSectionCounter: number[] = new Array(deptEntities.length).fill(0);

  const classes: RawClass[] = [];

  for (let i = 0; i < TARGET_CLASSES; i++) {
    const { course, deptIndex } = allCourses[i % allCourses.length]!;
    const dept = deptEntities[deptIndex]!;

    const sectionIndex = deptSectionCounter[deptIndex]!;
    deptSectionCounter[deptIndex] = sectionIndex + 1;

    const professor = dept.professors[sectionIndex % dept.professors.length]!;
    const group = dept.studentGroups[sectionIndex % dept.studentGroups.length]!;
    const sectionLetter = String.fromCharCode(65 + (sectionIndex % 26));

    let placed: { roomId: string; timeSlotId: string } | null = null;
    for (let attempt = 0; attempt < roomSlotPairs.length; attempt++) {
      const candidate = roomSlotPairs[(i + attempt) % roomSlotPairs.length]!;
      const roomKey = `${candidate.roomId}::${candidate.timeSlotId}`;
      const profKey = `${professor.id}::${candidate.timeSlotId}`;
      const groupKey = `${group.id}::${candidate.timeSlotId}`;

      if (
        !occupiedRoomSlot.has(roomKey) &&
        !occupiedProfSlot.has(profKey) &&
        !occupiedGroupSlot.has(groupKey)
      ) {
        occupiedRoomSlot.add(roomKey);
        occupiedProfSlot.add(profKey);
        occupiedGroupSlot.add(groupKey);
        placed = candidate;
        break;
      }
    }

    if (!placed) {
      throw new Error(
        `Could not find a conflict-free (room, timeSlot) for class ${i + 1} of '${course.name}' — ` +
        'increase NUM_ROOMS/GROUPS_PER_DEPT or reduce TARGET_CLASSES.',
      );
    }

    classes.push({
      id: `CLS_${String(i + 1).padStart(5, '0')}`,
      courseId: course.id,
      title: `${course.name} - Section ${sectionLetter}`,
      professorId: professor.id,
      studentGroupId: group.id,
      roomId: placed.roomId,
      timeSlotIds: [placed.timeSlotId],
    });
  }

  return classes;
}

// ── Rules ─────────────────────────────────────────────────────────────────────

function buildRules(): RulesJson {
  return {
    metrics: [
      {
        id: 'metric-room-utilization', name: 'Room Utilization',
        target: 'Room', condition: 'utilization', threshold: 80,
      },
      {
        id: 'metric-avg-classes-per-professor', name: 'Average Classes per Professor per Day',
        target: 'Professor', condition: 'avg_classes_per_day', threshold: 4,
      },
    ],
    constraints: [
      {
        id: 'constraint-no-room-double-booking', name: 'No Room Double Booking',
        target: 'Room', violationCondition: 'double_booking',
      },
    ],
  };
}

// ── Public entry point ───────────────────────────────────────────────────────

export function generateLargeSchedule(): { schedule: ScheduleJson; rules: RulesJson } {
  const rooms = buildRooms();
  const timeSlots = buildTimeSlots();
  const deptEntities = buildDepartmentEntities();
  const classes = buildClasses(deptEntities, rooms, timeSlots);

  const schedule: ScheduleJson = {
    metadata: {
      semesterId: 'FALL_2026',
      semesterName: 'Fall Semester 2026',
      academicYear: '2026-2027',
      versioning: {
        lastModifiedBy: 'generate-large-schedule@iter-scheduling.local',
        lastModifiedAt: '2026-07-23T00:00:00.000Z',
        schemaVersion: '1.0.0',
      },
    },
    timeSlots,
    rooms,
    professors: deptEntities.flatMap((d) => d.professors),
    studentGroups: deptEntities.flatMap((d) => d.studentGroups),
    courses: deptEntities.flatMap((d) => d.courses),
    classes,
  };

  return { schedule, rules: buildRules() };
}

// ── CLI entry point ──────────────────────────────────────────────────────────

function main(): void {
  const outDir = process.argv[2];
  if (!outDir) {
    console.error('Usage: tsx generate-large-schedule.ts <outDir>');
    process.exit(1);
  }

  const { schedule, rules } = generateLargeSchedule();

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'schedule.json'), JSON.stringify(schedule, null, 2));
  writeFileSync(join(outDir, 'rules.json'), JSON.stringify(rules, null, 2));

  console.log(
    `Generated ${schedule.classes.length} classes across ${schedule.rooms.length} rooms, ` +
    `${schedule.professors.length} professors, ${schedule.studentGroups.length} student groups, ` +
    `${schedule.courses.length} courses, into ${outDir}`,
  );
}

if (require.main === module) {
  main();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && pnpm vitest run src/scripts/generate-large-schedule.test.ts`
Expected: PASS — 5 tests passing

- [ ] **Step 5: Add the `generate:mock-data` script**

Edit `backend/package.json` — add to `"scripts"` (alongside `test:e2e`):

```json
    "generate:mock-data": "tsx src/scripts/generate-large-schedule.ts",
```

- [ ] **Step 6: Manually verify the CLI entry point**

Run: `cd backend && pnpm generate:mock-data -- /tmp/mock-data-check && ls /tmp/mock-data-check && rm -rf /tmp/mock-data-check`
Expected: prints the "Generated 1500 classes..." summary line, and `ls` shows `schedule.json` and `rules.json` before cleanup

- [ ] **Step 7: Run the full backend suite**

Run: `cd backend && pnpm lint && pnpm vitest run`
Expected: zero lint errors, all tests pass (same count as before plus the 5 new ones)

- [ ] **Step 8: Commit**

```bash
git add backend/src/scripts/ backend/package.json
git commit -m "feat(scripts): add deterministic large-scale mock schedule generator"
```

---

### Task 2: GitHub Repo Setup Script

**Files:**
- Create: `scripts/setup-github-repo.sh`
- Modify: `Makefile`

**Interfaces:**
- Consumes: `backend`'s `generate:mock-data` script (Task 1) via `pnpm generate:mock-data -- <dir>`; the `gh` CLI; `backend/.env.example` (unchanged, read-only fallback source).
- Produces: nothing consumed elsewhere in this plan — this is the final, user-facing deliverable.

**Reminder: do NOT execute this script for real in this task.** Verify only via syntax checking and code reading, per the Global Constraints above.

- [ ] **Step 1: Create the script**

Create `scripts/setup-github-repo.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

REPO_NAME="iter-scheduling-data"
OWNER=""
VISIBILITY="--private"

for arg in "$@"; do
  case "$arg" in
    --owner=*) OWNER="${arg#*=}" ;;
    --public) VISIBILITY="--public" ;;
    --*) echo "Unknown flag: $arg" >&2; exit 1 ;;
    *) REPO_NAME="$arg" ;;
  esac
done

if ! command -v gh >/dev/null 2>&1; then
  echo "Error: the GitHub CLI ('gh') is required but not installed. See https://cli.github.com/" >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "Error: not logged in to GitHub CLI. Run 'gh auth login' first." >&2
  exit 1
fi

if [ -z "$OWNER" ]; then
  OWNER=$(gh api user --jq .login)
fi

REPO_SLUG="$OWNER/$REPO_NAME"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$REPO_ROOT/backend"

echo "Target repository: $REPO_SLUG"

if gh repo view "$REPO_SLUG" >/dev/null 2>&1; then
  echo "Repository already exists — reusing it."
else
  echo "Creating repository..."
  gh repo create "$REPO_SLUG" $VISIBILITY --description "Mock schedule data for iter-scheduling (generated)" >/dev/null
fi

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

echo "Cloning $REPO_SLUG..."
gh repo clone "$REPO_SLUG" "$TMPDIR/repo" -- -q

cd "$TMPDIR/repo"
git checkout -B main -q

echo "Generating mock schedule data..."
(cd "$BACKEND_DIR" && pnpm generate:mock-data -- "$TMPDIR/repo")

git add schedule.json rules.json
if git diff --cached --quiet; then
  echo "No changes to schedule.json/rules.json — nothing to push."
else
  git -c user.name="iter-scheduling-setup" -c user.email="setup@iter-scheduling.local" \
    commit -q -m "chore(data): regenerate mock schedule and rules data"
  git push -q -u origin main
  echo "Pushed updated data to $REPO_SLUG (main)."
fi

REPO_URL="https://github.com/$REPO_SLUG"

echo "Fetching GitHub token from gh CLI..."
TOKEN=$(gh auth token)

ENV_FILE="$BACKEND_DIR/.env"
ENV_EXAMPLE="$BACKEND_DIR/.env.example"

if [ ! -f "$ENV_FILE" ]; then
  echo "No backend/.env found — creating one from .env.example"
  cp "$ENV_EXAMPLE" "$ENV_FILE"
fi

cp "$ENV_FILE" "$ENV_FILE.bak"
echo "Backed up existing backend/.env to backend/.env.bak"

set_env_var() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i.tmp "s|^${key}=.*|${key}=${value}|" "$ENV_FILE" && rm -f "$ENV_FILE.tmp"
  else
    echo "${key}=${value}" >> "$ENV_FILE"
  fi
}

set_env_var "GITHUB_PROVIDER" "github"
set_env_var "GITHUB_TOKEN" "$TOKEN"
set_env_var "GITHUB_OWNER" "$OWNER"
set_env_var "GITHUB_REPO" "$REPO_NAME"

echo ""
echo "Done! Repository: $REPO_URL"
echo "backend/.env updated (GITHUB_PROVIDER=github, GITHUB_OWNER=$OWNER, GITHUB_REPO=$REPO_NAME)."
echo "Restart the backend (or run 'make dev') to pick up the new settings."
```

- [ ] **Step 2: Make it executable**

Run: `chmod +x scripts/setup-github-repo.sh`

- [ ] **Step 3: Syntax-check it (do NOT run it for real)**

Run: `bash -n scripts/setup-github-repo.sh`
Expected: no output, exit code `0` (confirms valid bash syntax with no execution)

If `shellcheck` is available, also run: `shellcheck scripts/setup-github-repo.sh` and address any warnings it raises (informational only — don't block on style-only suggestions unrelated to correctness).

- [ ] **Step 4: Add the Makefile target**

Edit `Makefile` — add after the `install` target:

```makefile
setup-github: ## Create/reuse a real GitHub repo with large mock data, link backend/.env to it
	./scripts/setup-github-repo.sh
```

Update the `.PHONY` line at the top of the file to include it:

```makefile
.PHONY: install setup-github dev test test-e2e lint build clean help
```

- [ ] **Step 5: Verify the rest of the repo is unaffected**

Run: `make lint && cd backend && pnpm vitest run`
Expected: PASS — this task touched no application code, so this just confirms nothing was accidentally broken

- [ ] **Step 6: Commit**

```bash
git add scripts/setup-github-repo.sh Makefile
git commit -m "feat(scripts): add GitHub repo setup script for the real GitHub-backed dev path"
```

---

## Self-Review Notes

- **Spec coverage:** Generator (§1 of the spec) → Task 1. Setup script (§2) → Task 2. Both new-files lists match the spec's "Summary of new files" exactly.
- **Capacity math verified, not assumed:** 80 rooms × 25 slots = 2000 ≥ 1500 target classes; 80 student groups × 25 slots = 2000 ≥ 1500; 80 professors × 25 slots = 2000 ≥ 1500. All three conflict dimensions (`ROOM_DOUBLE_BOOK`, `PROFESSOR_OVERLAP`, `GROUP_OVERLAP`) have headroom, so the greedy placement in Task 1 Step 3 cannot fail to find a slot for any of the 1500 classes.
- **Type consistency:** `generateLargeSchedule(): { schedule: ScheduleJson; rules: RulesJson }` is the only public export, and its return shape is used identically by the test (Task 1 Step 1) and the CLI entry point (Task 1 Step 3) — no other file in this plan imports it directly (Task 2's script calls the compiled CLI via `pnpm generate:mock-data`, not the TS function).
- **Safety constraint honored throughout:** every step in Task 2 that could touch a real GitHub account or a real `.env` file is written but explicitly marked as verify-by-reading/syntax-check-only, never execute — consistent with the Global Constraints section and the design spec's safety note.
