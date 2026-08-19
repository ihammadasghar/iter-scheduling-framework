# Simulation Overview: Gantt Enhancements, Density Heatmap & Diagnostics — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Overview" tab to the Timetable workspace (room-utilisation density heatmap, conflict breakdown chart, health summary, metric tiles) plus targeted polish to the existing Gantt grid (persistent conflict highlighting, building grouping, density/zoom control), so users can understand a draft schedule's overall health without scanning every cell.

**Architecture:** A new read-only `GET /simulations/:id/schedule` endpoint reuses the backend's existing `GraphService.exportScheduleJson()` to expose room/student-group master data (capacity/size) that the frontend never had access to. The frontend adds one new Redux slice (`scheduleSlice`) to hold that data, two pure aggregation utilities (`aggregateOccupancy`, `groupConflictsByType`), several new presentational components, and a tab switch in `TimetablePage` — all reading data the workspace already fetches, no new interaction model.

**Tech Stack:** React 19 + MUI v9 + Redux Toolkit + Vitest/RTL (unchanged), plus one new dependency: `@mui/x-charts` (bar chart for conflict breakdown).

## Global Constraints

- Test runner is Vitest exclusively (`describe/it/expect/vi` from `'vitest'`), never Jest — both frontend and backend.
- Frontend components always import `useAppDispatch`/`useAppSelector` from `@/store/hooks`, never raw `react-redux` hooks.
- Frontend imports use the `@/` path alias (e.g. `@/types`, `@/utils/...`) matching existing convention.
- User-facing copy never surfaces raw technical terms (conflict type codes, IDs) — always the plain-language equivalents already established in the copy glossary (`docs/stitch-prompt.md`): "Room double-booked," "Lecturer double-booked," "Student group overlap."
- Every interactive element keeps a minimum 44×44px touch target (existing `theme.ts` `MuiButton`/`MuiIconButton` overrides already enforce this for standard components).
- No drag-and-drop, no new backend business logic beyond the one read-only schedule endpoint, no dark-mode theme work (the app has no dark-mode toggle today).
- Commit after every task using the repo's existing commit style (no enforced prefix format observed — plain, descriptive, present-tense messages matching recent `git log`).

---

## Task 1: Backend — `SimulationService.getSchedule`

**Files:**
- Modify: `backend/src/interfaces/ISimulationService.ts`
- Modify: `backend/src/services/SimulationService.ts`
- Test: `backend/src/services/SimulationService.test.ts`

**Interfaces:**
- Produces: `ISimulationService.getSchedule(simulationId: string): Promise<ScheduleJson>` — a new method other backend tasks (Task 2) depend on.

- [ ] **Step 1: Write the failing tests**

Append to `backend/src/services/SimulationService.test.ts` (after the existing `getMetrics()` describe block, using the same `makeGitHub`/`makeGraph`/`makeRegistry` factories already defined at the top of the file):

```ts
describe('SimulationService.getSchedule()', () => {
  const SIM_ID = 'sim-alice-abc123';
  const FAKE_SCHEDULE_JSON = JSON.stringify({
    metadata: {},
    courses: [{ id: 'CRS_BIO101', code: 'BIO101', name: 'Intro to Biology', department: 'Biology' }],
    professors: [{ id: 'PRF_SMITH', name: 'Dr. Smith', department: 'Biology' }],
    studentGroups: [{ id: 'GRP_BIO_Y1', name: 'Bio Year 1', size: 32 }],
    rooms: [{ id: 'RM_101', name: 'Room 101', capacity: 40, building: 'Building A' }],
    timeSlots: [{ id: 'TS_MON_P1', day: 'MON', name: 'Period 1', startTime: '09:00', endTime: '10:00' }],
    classes: [],
  });

  let github: IGitHubService;
  let graph: IGraphService;
  let registry: ISessionRegistry;
  let service: SimulationService;

  beforeEach(() => {
    github = makeGitHub();
    graph = makeGraph();
    registry = makeRegistry(true);
    (graph.exportScheduleJson as ReturnType<typeof vi.fn>).mockResolvedValue(FAKE_SCHEDULE_JSON);
    service = new SimulationService(github, graph, registry);
  });

  it('throws 404 when the simulation session is not found', async () => {
    const expiredRegistry = makeRegistry(false);
    const svc = new SimulationService(github, graph, expiredRegistry);

    await expect(svc.getSchedule(SIM_ID)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Simulation not found or expired',
    });
  });

  it('delegates to graph.exportScheduleJson with the simulationId', async () => {
    await service.getSchedule(SIM_ID);

    expect(graph.exportScheduleJson).toHaveBeenCalledOnce();
    expect(graph.exportScheduleJson).toHaveBeenCalledWith(SIM_ID);
  });

  it('parses and returns the ScheduleJson from graph.exportScheduleJson', async () => {
    const result = await service.getSchedule(SIM_ID);

    expect(result.rooms).toEqual([{ id: 'RM_101', name: 'Room 101', capacity: 40, building: 'Building A' }]);
    expect(result.studentGroups).toEqual([{ id: 'GRP_BIO_Y1', name: 'Bio Year 1', size: 32 }]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx vitest run src/services/SimulationService.test.ts -t "getSchedule"`
Expected: FAIL — `service.getSchedule is not a function` (or a TypeScript error that `getSchedule` does not exist on `SimulationService`).

- [ ] **Step 3: Implement**

In `backend/src/interfaces/ISimulationService.ts`, add `ScheduleJson` to the existing multi-line import from `'../types/domain.js'`... actually `ScheduleJson` lives in `'../types/scheduleJson.js'`, a separate import line — add:

```ts
import type { ScheduleJson } from '../types/scheduleJson.js';
```

and add the new method to the interface, after `getMetrics` and before `delete`:

```ts
  getSchedule(simulationId: string): Promise<ScheduleJson>;
```

In `backend/src/services/SimulationService.ts`, add the same import:

```ts
import type { ScheduleJson } from '../types/scheduleJson.js';
```

and add the method, after the existing `getMetrics` method and before `delete`:

```ts
  async getSchedule(simulationId: string): Promise<ScheduleJson> {
    const touched = this.registry.touch(simulationId);
    if (!touched) {
      throw ApiError.notFound('Simulation not found or expired');
    }

    const exportedJson = await this.graph.exportScheduleJson(simulationId);
    return JSON.parse(exportedJson) as ScheduleJson;
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx vitest run src/services/SimulationService.test.ts`
Expected: PASS (all `getSchedule` tests, plus every pre-existing test in the file still green).

- [ ] **Step 5: Commit**

```bash
git add backend/src/interfaces/ISimulationService.ts backend/src/services/SimulationService.ts backend/src/services/SimulationService.test.ts
git commit -m "feat(backend): add SimulationService.getSchedule"
```

---

## Task 2: Backend — controller + route for `GET /simulations/:id/schedule`

**Files:**
- Modify: `backend/src/controllers/SimulationController.ts`
- Modify: `backend/src/routes/simulations.ts`
- Test: `backend/src/controllers/SimulationController.test.ts` (create this file if it does not already exist; if it exists, add the describe block below to it)

**Interfaces:**
- Consumes: `ISimulationService.getSchedule(simulationId: string): Promise<ScheduleJson>` (Task 1)
- Produces: `GET /simulations/:id/schedule` HTTP route returning `ScheduleJson` as JSON, status 200.

- [ ] **Step 1: Write the failing tests**

Create/append to `backend/src/controllers/SimulationController.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { SimulationController } from './SimulationController.js';
import type { ISimulationService } from '../interfaces/ISimulationService.js';

const makeService = (): ISimulationService => ({
  create: vi.fn(),
  heartbeat: vi.fn(),
  commit: vi.fn(),
  listClasses: vi.fn(),
  updateClass: vi.fn(),
  getSuggestions: vi.fn(),
  getConflicts: vi.fn(),
  getMetrics: vi.fn(),
  getSchedule: vi.fn(),
  delete: vi.fn(),
});

const makeRes = (): Response => {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res;
};

describe('SimulationController.getSchedule()', () => {
  it('returns 200 with the schedule from the service', async () => {
    const service = makeService();
    const schedule = {
      metadata: {}, courses: [], professors: [], studentGroups: [], rooms: [], timeSlots: [], classes: [],
    };
    (service.getSchedule as ReturnType<typeof vi.fn>).mockResolvedValue(schedule);
    const controller = new SimulationController(service);
    const req = { params: { id: 'sim-1' } } as unknown as Request;
    const res = makeRes();
    const next: NextFunction = vi.fn();

    await controller.getSchedule(req, res, next);

    expect(service.getSchedule).toHaveBeenCalledWith('sim-1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(schedule);
    expect(next).not.toHaveBeenCalled();
  });

  it('passes errors to next()', async () => {
    const service = makeService();
    const error = new Error('boom');
    (service.getSchedule as ReturnType<typeof vi.fn>).mockRejectedValue(error);
    const controller = new SimulationController(service);
    const req = { params: { id: 'sim-1' } } as unknown as Request;
    const res = makeRes();
    const next: NextFunction = vi.fn();

    await controller.getSchedule(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx vitest run src/controllers/SimulationController.test.ts -t "getSchedule"`
Expected: FAIL — `controller.getSchedule is not a function`.

- [ ] **Step 3: Implement**

In `backend/src/controllers/SimulationController.ts`, add a new method after `getMetrics` and before `deleteSimulation`:

```ts
  async getSchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schedule = await this.service.getSchedule(req.params['id'] as string);
      res.status(200).json(schedule);
    } catch (err) {
      next(err);
    }
  }
```

In `backend/src/routes/simulations.ts`, add a new route after the `/metrics` route and before the `DELETE /:id` route:

```ts
  // GET /simulations/:id/schedule — room/professor/student-group master data for the Overview tab
  router.get('/:id/schedule', (req, res, next) => controller.getSchedule(req, res, next));
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx vitest run src/controllers/SimulationController.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/SimulationController.ts backend/src/routes/simulations.ts backend/src/controllers/SimulationController.test.ts
git commit -m "feat(backend): expose GET /simulations/:id/schedule"
```

---

## Task 3: Frontend — `simulationService.getSchedule`

**Files:**
- Modify: `frontend/src/services/simulationService.ts`
- Test: `frontend/src/services/simulationService.test.ts` (create if it does not already exist)

**Interfaces:**
- Consumes: `GET /simulations/:id/schedule` (Task 2)
- Produces: `simulationService.getSchedule(simId: string): Promise<ScheduleJson>` — used by Task 4's `scheduleSlice`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from 'vitest';
import apiClient from './apiClient';
import { simulationService } from './simulationService';

vi.mock('./apiClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('simulationService.getSchedule', () => {
  it('GETs /simulations/:id/schedule and returns the response data', async () => {
    const schedule = {
      metadata: {}, courses: [], professors: [], studentGroups: [], rooms: [], timeSlots: [], classes: [],
    };
    vi.mocked(apiClient.get).mockResolvedValue({ data: schedule });

    const result = await simulationService.getSchedule('sim-1');

    expect(apiClient.get).toHaveBeenCalledWith('/simulations/sim-1/schedule');
    expect(result).toEqual(schedule);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/services/simulationService.test.ts`
Expected: FAIL — `simulationService.getSchedule is not a function`.

- [ ] **Step 3: Implement**

In `frontend/src/services/simulationService.ts`, add `ScheduleJson` to the existing `import type {...} from '@/types'` block, and add a new method next to `getConflicts`/`getMetrics`:

```ts
  getSchedule(simId: string): Promise<ScheduleJson> {
    return apiClient
      .get<ScheduleJson>(`/simulations/${simId}/schedule`)
      .then((r) => r.data);
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/services/simulationService.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/simulationService.ts frontend/src/services/simulationService.test.ts
git commit -m "feat(frontend): add simulationService.getSchedule"
```

---

## Task 4: Frontend — `scheduleSlice` (Redux)

**Files:**
- Create: `frontend/src/store/reducers/scheduleSlice.ts`
- Create: `frontend/src/store/reducers/scheduleSlice.test.ts`
- Modify: `frontend/src/store/store.ts`

**Interfaces:**
- Consumes: `simulationService.getSchedule(simId: string): Promise<ScheduleJson>` (Task 3)
- Produces: `fetchScheduleThunk(simId: string)`, Redux state shape `state.schedule: { rooms: RawRoom[], studentGroups: RawStudentGroup[], loading: boolean, error: string | null }` — consumed by Tasks 10–13.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import scheduleReducer, { fetchScheduleThunk } from './scheduleSlice';
import { simulationService } from '@/services/simulationService';
import type { RawRoom, RawStudentGroup } from '@/types';

vi.mock('@/services/simulationService', () => ({
  simulationService: {
    getSchedule: vi.fn(),
  },
}));

const ROOM: RawRoom = { id: 'RM_101', name: 'Room 101', capacity: 40, building: 'Building A' };
const GROUP: RawStudentGroup = { id: 'GRP_BIO_Y1', name: 'Bio Year 1', size: 32 };

const makeStore = () => configureStore({ reducer: { schedule: scheduleReducer } });

describe('scheduleSlice', () => {
  beforeEach(() => vi.clearAllMocks());

  it('starts with empty rooms/studentGroups and loading=false', () => {
    const store = makeStore();
    expect(store.getState().schedule).toEqual({
      rooms: [], studentGroups: [], loading: false, error: null,
    });
  });

  it('sets loading=true while fetchScheduleThunk is pending', () => {
    vi.mocked(simulationService.getSchedule).mockReturnValue(new Promise(() => {}));
    const store = makeStore();
    void store.dispatch(fetchScheduleThunk('sim-1'));
    expect(store.getState().schedule.loading).toBe(true);
  });

  it('stores rooms and studentGroups on fulfilled', async () => {
    vi.mocked(simulationService.getSchedule).mockResolvedValue({
      metadata: {}, courses: [], professors: [], timeSlots: [], classes: [],
      rooms: [ROOM], studentGroups: [GROUP],
    });
    const store = makeStore();
    await store.dispatch(fetchScheduleThunk('sim-1'));

    expect(store.getState().schedule).toEqual({
      rooms: [ROOM], studentGroups: [GROUP], loading: false, error: null,
    });
  });

  it('sets an error message on rejected', async () => {
    vi.mocked(simulationService.getSchedule).mockRejectedValue({ message: 'Failed to load schedule' });
    const store = makeStore();
    await store.dispatch(fetchScheduleThunk('sim-1'));

    expect(store.getState().schedule.loading).toBe(false);
    expect(store.getState().schedule.error).toBe('Failed to load schedule');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/store/reducers/scheduleSlice.test.ts`
Expected: FAIL — cannot find module `./scheduleSlice`.

- [ ] **Step 3: Implement**

Create `frontend/src/store/reducers/scheduleSlice.ts`:

```ts
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { simulationService } from '@/services/simulationService';
import type { RawRoom, RawStudentGroup, ApiError } from '@/types';

interface ScheduleState {
  readonly rooms: RawRoom[];
  readonly studentGroups: RawStudentGroup[];
  readonly loading: boolean;
  readonly error: string | null;
}

const initialState: ScheduleState = {
  rooms: [],
  studentGroups: [],
  loading: false,
  error: null,
};

export const fetchScheduleThunk = createAsyncThunk<
  { rooms: RawRoom[]; studentGroups: RawStudentGroup[] },
  string,
  { rejectValue: ApiError }
>('schedule/fetch', async (simId, { rejectWithValue }) => {
  try {
    const result = await simulationService.getSchedule(simId);
    return { rooms: [...result.rooms], studentGroups: [...result.studentGroups] };
  } catch (err) {
    return rejectWithValue(err as ApiError);
  }
});

const scheduleSlice = createSlice({
  name: 'schedule',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchScheduleThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchScheduleThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.rooms = action.payload.rooms;
        state.studentGroups = action.payload.studentGroups;
      })
      .addCase(fetchScheduleThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message ?? 'Failed to load schedule data';
      });
  },
});

export default scheduleSlice.reducer;
```

In `frontend/src/store/store.ts`, add the import and register the reducer:

```ts
import scheduleReducer from './reducers/scheduleSlice';
```

and add `schedule: scheduleReducer,` to the `reducer: { ... }` map (alongside `simulation`, `class`, `conflict`, `metric`, `proposal`, `rules`, `session`, `ui`).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/store/reducers/scheduleSlice.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/store/reducers/scheduleSlice.ts frontend/src/store/reducers/scheduleSlice.test.ts frontend/src/store/store.ts
git commit -m "feat(frontend): add scheduleSlice for room/student-group master data"
```

---

## Task 5: Frontend — `aggregateOccupancy` pure utility

**Files:**
- Create: `frontend/src/utils/aggregateOccupancy.ts`
- Create: `frontend/src/utils/aggregateOccupancy.test.ts`

**Interfaces:**
- Consumes: `ScheduleClass[]` (from `classSlice`), `RawRoom[]`/`RawStudentGroup[]` (from `scheduleSlice`, Task 4).
- Produces: `aggregateOccupancy(classes, rooms, studentGroups): OccupancyLookup`, `OccupancyCell { seatFillRatio: number; classIds: readonly string[]; hasConflict: boolean }`, `OccupancyLookup = ReadonlyMap<string, ReadonlyMap<string, OccupancyCell>>` (keyed `roomId → timeSlotId → cell`) — consumed by Task 9 (`RoomUtilisationHeatmap`) and Task 11 (`SimulationOverview`).

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { aggregateOccupancy } from './aggregateOccupancy';
import type { ScheduleClass, RawRoom, RawStudentGroup } from '@/types';

const ROOM: RawRoom = { id: 'RM_101', name: 'Room 101', capacity: 40, building: 'Building A' };
const GROUP: RawStudentGroup = { id: 'GRP_BIO_Y1', name: 'Bio Year 1', size: 32 };

const makeClass = (overrides: Partial<ScheduleClass> = {}): ScheduleClass => ({
  id: 'CLS_001',
  courseId: 'CRS_BIO101',
  title: 'Biology 101',
  professorId: 'PRF_SMITH',
  studentGroupId: 'GRP_BIO_Y1',
  roomId: 'RM_101',
  timeSlotIds: ['TS_MON_P1'],
  ...overrides,
});

describe('aggregateOccupancy', () => {
  it('returns an empty map when there are no classes', () => {
    const result = aggregateOccupancy([], [ROOM], [GROUP]);
    expect(result.size).toBe(0);
  });

  it('computes seat-fill ratio as studentGroup.size / room.capacity', () => {
    const result = aggregateOccupancy([makeClass()], [ROOM], [GROUP]);
    const cell = result.get('RM_101')?.get('TS_MON_P1');
    expect(cell).toEqual({ seatFillRatio: 0.8, classIds: ['CLS_001'], hasConflict: false });
  });

  it('applies the same ratio to every time slot a multi-period class spans', () => {
    const cls = makeClass({ timeSlotIds: ['TS_MON_P1', 'TS_MON_P2'] });
    const result = aggregateOccupancy([cls], [ROOM], [GROUP]);
    expect(result.get('RM_101')?.get('TS_MON_P1')?.seatFillRatio).toBe(0.8);
    expect(result.get('RM_101')?.get('TS_MON_P2')?.seatFillRatio).toBe(0.8);
  });

  it('sums seat-fill and flags hasConflict when two classes share a room+slot', () => {
    const clsA = makeClass({ id: 'CLS_001' });
    const clsB = makeClass({ id: 'CLS_002', studentGroupId: 'GRP_BIO_Y1' });
    const result = aggregateOccupancy([clsA, clsB], [ROOM], [GROUP]);
    const cell = result.get('RM_101')?.get('TS_MON_P1');
    expect(cell).toEqual({ seatFillRatio: 1.6, classIds: ['CLS_001', 'CLS_002'], hasConflict: true });
  });

  it('skips a class whose room is missing from the rooms list', () => {
    const cls = makeClass({ roomId: 'RM_UNKNOWN' });
    const result = aggregateOccupancy([cls], [ROOM], [GROUP]);
    expect(result.size).toBe(0);
  });

  it('skips a class whose student group is missing from the groups list', () => {
    const cls = makeClass({ studentGroupId: 'GRP_UNKNOWN' });
    const result = aggregateOccupancy([cls], [ROOM], [GROUP]);
    expect(result.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/utils/aggregateOccupancy.test.ts`
Expected: FAIL — cannot find module `./aggregateOccupancy`.

- [ ] **Step 3: Implement**

Create `frontend/src/utils/aggregateOccupancy.ts`:

```ts
import type { ScheduleClass, RawRoom, RawStudentGroup } from '@/types';

export interface OccupancyCell {
  readonly seatFillRatio: number;
  readonly classIds: readonly string[];
  readonly hasConflict: boolean;
}

export type OccupancyLookup = ReadonlyMap<string, ReadonlyMap<string, OccupancyCell>>;

/**
 * Per-cell seat-fill density for the Room Utilisation Heatmap: for each
 * booked room+time-slot, studentGroup.size / room.capacity. A cell absent
 * from the returned map is unbooked (rendered as neutral, not zero).
 * Overlapping classes (a ROOM_DOUBLE_BOOK conflict) sum their ratios and
 * set hasConflict — the heatmap surfaces this with an icon, not a color blend.
 */
export const aggregateOccupancy = (
  classes: readonly ScheduleClass[],
  rooms: readonly RawRoom[],
  studentGroups: readonly RawStudentGroup[],
): OccupancyLookup => {
  const roomCapacity = new Map(rooms.map((r) => [r.id, r.capacity]));
  const groupSize = new Map(studentGroups.map((g) => [g.id, g.size]));

  const lookup = new Map<string, Map<string, OccupancyCell>>();

  classes.forEach((cls) => {
    const capacity = roomCapacity.get(cls.roomId);
    const size = groupSize.get(cls.studentGroupId);
    if (capacity === undefined || size === undefined || capacity <= 0) return;
    const ratio = size / capacity;

    cls.timeSlotIds.forEach((tsId) => {
      if (!lookup.has(cls.roomId)) lookup.set(cls.roomId, new Map());
      const roomMap = lookup.get(cls.roomId)!;
      const existing = roomMap.get(tsId);
      if (existing === undefined) {
        roomMap.set(tsId, { seatFillRatio: ratio, classIds: [cls.id], hasConflict: false });
      } else {
        roomMap.set(tsId, {
          seatFillRatio: existing.seatFillRatio + ratio,
          classIds: [...existing.classIds, cls.id],
          hasConflict: true,
        });
      }
    });
  });

  return lookup;
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/utils/aggregateOccupancy.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/aggregateOccupancy.ts frontend/src/utils/aggregateOccupancy.test.ts
git commit -m "feat(frontend): add aggregateOccupancy for the room utilisation heatmap"
```

---

## Task 6: Frontend — `groupConflictsByType` pure utility

**Files:**
- Create: `frontend/src/utils/groupConflictsByType.ts`
- Create: `frontend/src/utils/groupConflictsByType.test.ts`

**Interfaces:**
- Consumes: `Conflict[]` (from `conflictSlice`).
- Produces: `groupConflictsByType(conflicts): readonly ConflictTypeCount[]`, `ConflictTypeCount { type: ConflictType; label: string; count: number }`, always 3 entries in fixed order (`ROOM_DOUBLE_BOOK`, `PROFESSOR_OVERLAP`, `GROUP_OVERLAP`) — consumed by Task 8 (`ConflictBreakdownChart`) and Task 11 (`SimulationOverview`).

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { groupConflictsByType } from './groupConflictsByType';
import type { Conflict } from '@/types';

const makeConflict = (type: Conflict['type'], id: string): Conflict => ({
  id,
  type,
  classIds: ['CLS_001', 'CLS_002'],
  message: '',
});

describe('groupConflictsByType', () => {
  it('returns all 3 types with count 0 when there are no conflicts', () => {
    expect(groupConflictsByType([])).toEqual([
      { type: 'ROOM_DOUBLE_BOOK', label: 'Room double-booked', count: 0 },
      { type: 'PROFESSOR_OVERLAP', label: 'Lecturer double-booked', count: 0 },
      { type: 'GROUP_OVERLAP', label: 'Student group overlap', count: 0 },
    ]);
  });

  it('counts conflicts by type in fixed order regardless of input order', () => {
    const conflicts = [
      makeConflict('GROUP_OVERLAP', 'c1'),
      makeConflict('ROOM_DOUBLE_BOOK', 'c2'),
      makeConflict('ROOM_DOUBLE_BOOK', 'c3'),
    ];
    expect(groupConflictsByType(conflicts)).toEqual([
      { type: 'ROOM_DOUBLE_BOOK', label: 'Room double-booked', count: 2 },
      { type: 'PROFESSOR_OVERLAP', label: 'Lecturer double-booked', count: 0 },
      { type: 'GROUP_OVERLAP', label: 'Student group overlap', count: 1 },
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/utils/groupConflictsByType.test.ts`
Expected: FAIL — cannot find module `./groupConflictsByType`.

- [ ] **Step 3: Implement**

Create `frontend/src/utils/groupConflictsByType.ts`:

```ts
import type { Conflict, ConflictType } from '@/types';

export interface ConflictTypeCount {
  readonly type: ConflictType;
  readonly label: string;
  readonly count: number;
}

const CONFLICT_TYPE_LABELS: Readonly<Record<ConflictType, string>> = {
  ROOM_DOUBLE_BOOK: 'Room double-booked',
  PROFESSOR_OVERLAP: 'Lecturer double-booked',
  GROUP_OVERLAP: 'Student group overlap',
};

const CONFLICT_TYPE_ORDER: readonly ConflictType[] = [
  'ROOM_DOUBLE_BOOK',
  'PROFESSOR_OVERLAP',
  'GROUP_OVERLAP',
];

export const groupConflictsByType = (
  conflicts: readonly Conflict[],
): readonly ConflictTypeCount[] => {
  const counts = new Map<ConflictType, number>();
  conflicts.forEach((c) => counts.set(c.type, (counts.get(c.type) ?? 0) + 1));

  return CONFLICT_TYPE_ORDER.map((type) => ({
    type,
    label: CONFLICT_TYPE_LABELS[type],
    count: counts.get(type) ?? 0,
  }));
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/utils/groupConflictsByType.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/groupConflictsByType.ts frontend/src/utils/groupConflictsByType.test.ts
git commit -m "feat(frontend): add groupConflictsByType for the conflict breakdown chart"
```

---

## Task 7: Frontend — `HealthSummaryTile` molecule

**Files:**
- Create: `frontend/src/molecules/HealthSummaryTile.tsx`
- Create: `frontend/src/molecules/HealthSummaryTile.test.tsx`

**Interfaces:**
- Consumes: `conflictCount: number` (prop, computed by caller from `conflictSlice.conflicts.length`).
- Produces: `<HealthSummaryTile conflictCount={number} />` — consumed by Task 11 (`SimulationOverview`).

- [ ] **Step 1: Write the failing tests**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import HealthSummaryTile from './HealthSummaryTile';

describe('HealthSummaryTile', () => {
  it('shows a healthy message when there are no conflicts', () => {
    render(<HealthSummaryTile conflictCount={0} />);
    expect(screen.getByText(/no scheduling conflicts/i)).toBeInTheDocument();
  });

  it('shows a singular conflict message', () => {
    render(<HealthSummaryTile conflictCount={1} />);
    expect(screen.getByText(/1 scheduling conflict found/i)).toBeInTheDocument();
  });

  it('shows a plural conflicts message', () => {
    render(<HealthSummaryTile conflictCount={3} />);
    expect(screen.getByText(/3 scheduling conflicts found/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/molecules/HealthSummaryTile.test.tsx`
Expected: FAIL — cannot find module `./HealthSummaryTile`.

- [ ] **Step 3: Implement**

Create `frontend/src/molecules/HealthSummaryTile.tsx`:

```tsx
import { Card, CardContent, Stack, Typography } from '@mui/material';
import { CheckCircle, Warning } from '@mui/icons-material';

interface HealthSummaryTileProps {
  readonly conflictCount: number;
}

export default function HealthSummaryTile({
  conflictCount,
}: HealthSummaryTileProps): React.ReactElement {
  const healthy = conflictCount === 0;
  const label = healthy
    ? 'No scheduling conflicts'
    : `${conflictCount} scheduling conflict${conflictCount === 1 ? '' : 's'} found`;

  return (
    <Card>
      <CardContent>
        <Stack direction="row" spacing={1.5} alignItems="center">
          {healthy ? (
            <CheckCircle color="success" fontSize="large" aria-hidden />
          ) : (
            <Warning color="warning" fontSize="large" aria-hidden />
          )}
          <Typography variant="h5" component="p">
            {label}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/molecules/HealthSummaryTile.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/molecules/HealthSummaryTile.tsx frontend/src/molecules/HealthSummaryTile.test.tsx
git commit -m "feat(frontend): add HealthSummaryTile for the Overview tab"
```

---

## Task 8: Frontend — `MetricTileRow` molecule

**Files:**
- Create: `frontend/src/molecules/MetricTileRow.tsx`
- Create: `frontend/src/molecules/MetricTileRow.test.tsx`

**Interfaces:**
- Consumes: `metrics: readonly MetricResult[]` (prop, from `metricSlice.metrics`).
- Produces: `<MetricTileRow metrics={MetricResult[]} />` — consumed by Task 11 (`SimulationOverview`).

- [ ] **Step 1: Write the failing tests**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MetricTileRow from './MetricTileRow';

describe('MetricTileRow', () => {
  it('shows "No metrics configured" when metrics is empty', () => {
    render(<MetricTileRow metrics={[]} />);
    expect(screen.getByText(/no metrics configured/i)).toBeInTheDocument();
  });

  it('renders a tile for each metric', () => {
    render(<MetricTileRow metrics={[{ name: 'Room Utilisation', value: 74, unit: '%' }]} />);
    expect(screen.getByText('Room Utilisation')).toBeInTheDocument();
    expect(screen.getByText('74%')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/molecules/MetricTileRow.test.tsx`
Expected: FAIL — cannot find module `./MetricTileRow`.

- [ ] **Step 3: Implement**

Create `frontend/src/molecules/MetricTileRow.tsx`:

```tsx
import { Card, CardContent, Stack, Typography } from '@mui/material';
import type { MetricResult } from '@/types';

interface MetricTileRowProps {
  readonly metrics: readonly MetricResult[];
}

export default function MetricTileRow({ metrics }: MetricTileRowProps): React.ReactElement {
  if (metrics.length === 0) {
    return <Typography color="text.secondary">No metrics configured</Typography>;
  }

  return (
    <Stack direction="row" spacing={2} flexWrap="wrap">
      {metrics.map((m) => (
        <Card key={m.name} sx={{ minWidth: 180 }}>
          <CardContent>
            <Typography variant="overline" color="text.secondary">
              {m.name}
            </Typography>
            <Typography variant="h4" component="p">
              {m.value}{m.unit}
            </Typography>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/molecules/MetricTileRow.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/molecules/MetricTileRow.tsx frontend/src/molecules/MetricTileRow.test.tsx
git commit -m "feat(frontend): add MetricTileRow for the Overview tab"
```

---

## Task 9: Frontend — add `@mui/x-charts` and `ConflictBreakdownChart` molecule

**Files:**
- Modify: `frontend/package.json` (new dependency)
- Create: `frontend/src/molecules/ConflictBreakdownChart.tsx`
- Create: `frontend/src/molecules/ConflictBreakdownChart.test.tsx`

**Interfaces:**
- Consumes: `counts: readonly ConflictTypeCount[]` (Task 6), optional `onBarClick?: (type: ConflictType) => void`.
- Produces: `<ConflictBreakdownChart counts={ConflictTypeCount[]} onBarClick={fn} />` — consumed by Task 11 (`SimulationOverview`).

- [ ] **Step 1: Install the dependency**

Run: `cd frontend && npm install @mui/x-charts@latest`
This resolves against the existing `@mui/material@^9.2.0` / `react@^19.2.7` peer dependencies already in `frontend/package.json` — if npm reports a peer-dependency conflict, install the latest version explicitly compatible with MUI v9 core (check the installed `@mui/x-charts` version's peerDependencies in `node_modules/@mui/x-charts/package.json` and pin that exact version in `frontend/package.json` if npm's auto-resolution picks an incompatible one).

- [ ] **Step 2: Write the failing tests**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ConflictBreakdownChart from './ConflictBreakdownChart';

const ZERO_COUNTS = [
  { type: 'ROOM_DOUBLE_BOOK' as const, label: 'Room double-booked', count: 0 },
  { type: 'PROFESSOR_OVERLAP' as const, label: 'Lecturer double-booked', count: 0 },
  { type: 'GROUP_OVERLAP' as const, label: 'Student group overlap', count: 0 },
];

describe('ConflictBreakdownChart', () => {
  it('shows "No conflicts to report" when all counts are zero', () => {
    render(<ConflictBreakdownChart counts={ZERO_COUNTS} />);
    expect(screen.getByText(/no conflicts to report/i)).toBeInTheDocument();
  });

  it('renders the chart when there is at least one conflict', () => {
    const counts = [{ ...ZERO_COUNTS[0]!, count: 2 }, ZERO_COUNTS[1]!, ZERO_COUNTS[2]!];
    render(<ConflictBreakdownChart counts={counts} />);
    expect(screen.getByLabelText(/conflicts by type/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/molecules/ConflictBreakdownChart.test.tsx`
Expected: FAIL — cannot find module `./ConflictBreakdownChart`.

- [ ] **Step 4: Implement**

Create `frontend/src/molecules/ConflictBreakdownChart.tsx`:

```tsx
import { BarChart } from '@mui/x-charts/BarChart';
import { Typography } from '@mui/material';
import type { ConflictTypeCount } from '@/utils/groupConflictsByType';
import type { ConflictType } from '@/types';

interface ConflictBreakdownChartProps {
  readonly counts: readonly ConflictTypeCount[];
  readonly onBarClick?: (type: ConflictType) => void;
}

// Validated categorical palette (see docs/superpowers/specs/2026-07-24-simulation-overview-visualizations-design.md)
const BAR_COLORS: Readonly<Record<ConflictType, string>> = {
  ROOM_DOUBLE_BOOK: '#2f6fc4',
  PROFESSOR_OVERLAP: '#b35c00',
  GROUP_OVERLAP: '#5b3a9e',
};

export default function ConflictBreakdownChart({
  counts,
  onBarClick,
}: ConflictBreakdownChartProps): React.ReactElement {
  const total = counts.reduce((sum, c) => sum + c.count, 0);

  if (total === 0) {
    return <Typography color="success.main">No conflicts to report</Typography>;
  }

  return (
    <BarChart
      dataset={counts as unknown as Record<string, unknown>[]}
      xAxis={[{ scaleType: 'band', dataKey: 'label' }]}
      series={[{ dataKey: 'count', label: 'Conflicts' }]}
      colors={counts.map((c) => BAR_COLORS[c.type])}
      onItemClick={(_event, item) => {
        const clicked = counts[item.dataIndex];
        if (clicked !== undefined) onBarClick?.(clicked.type);
      }}
      height={240}
      aria-label="Conflicts by type"
    />
  );
}
```

Note: `dataset`/`xAxis`/`series`/`onItemClick` match the standard `@mui/x-charts` `BarChart` dataset-driven API. If the installed version's TypeScript types reject a prop name, check `node_modules/@mui/x-charts/models` (or the package's own `.d.ts`) for the exact current prop name and adjust — keep the same data-driven behavior (one bar per `ConflictTypeCount`, click → `onBarClick(type)`).

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/molecules/ConflictBreakdownChart.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/molecules/ConflictBreakdownChart.tsx frontend/src/molecules/ConflictBreakdownChart.test.tsx
git commit -m "feat(frontend): add ConflictBreakdownChart using @mui/x-charts"
```

---

## Task 10: Frontend — `RoomUtilisationHeatmap` organism

**Files:**
- Create: `frontend/src/organisms/RoomUtilisationHeatmap.tsx`
- Create: `frontend/src/organisms/RoomUtilisationHeatmap.test.tsx`

**Interfaces:**
- Consumes: `occupancy: OccupancyLookup` (Task 5), `rooms: readonly RawRoom[]`, `sortedTimeSlotIds: readonly string[]`.
- Produces: `<RoomUtilisationHeatmap occupancy={...} rooms={...} sortedTimeSlotIds={...} />` — consumed by Task 11 (`SimulationOverview`).

- [ ] **Step 1: Write the failing tests**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RoomUtilisationHeatmap from './RoomUtilisationHeatmap';
import type { OccupancyLookup } from '@/utils/aggregateOccupancy';
import type { RawRoom } from '@/types';

const ROOMS: RawRoom[] = [{ id: 'RM_101', name: 'Room 101', capacity: 40, building: 'Building A' }];
const TS_IDS = ['TS_MON_P1'];

describe('RoomUtilisationHeatmap', () => {
  it('shows a message when there are no rooms', () => {
    render(<RoomUtilisationHeatmap occupancy={new Map()} rooms={[]} sortedTimeSlotIds={[]} />);
    expect(screen.getByText(/no room data available/i)).toBeInTheDocument();
  });

  it('renders a cell for a booked room/time-slot pair', () => {
    const occupancy: OccupancyLookup = new Map([
      ['RM_101', new Map([['TS_MON_P1', { seatFillRatio: 0.8, classIds: ['CLS_001'], hasConflict: false }]])],
    ]);
    render(<RoomUtilisationHeatmap occupancy={occupancy} rooms={ROOMS} sortedTimeSlotIds={TS_IDS} />);
    expect(screen.getByLabelText(/room 101 80% full at mon p1/i)).toBeInTheDocument();
  });

  it('renders unbooked cells distinctly', () => {
    render(<RoomUtilisationHeatmap occupancy={new Map()} rooms={ROOMS} sortedTimeSlotIds={TS_IDS} />);
    expect(screen.getByLabelText(/room 101 unbooked at mon p1/i)).toBeInTheDocument();
  });

  it('flags a conflicted cell', () => {
    const occupancy: OccupancyLookup = new Map([
      ['RM_101', new Map([['TS_MON_P1', { seatFillRatio: 1.5, classIds: ['CLS_001', 'CLS_002'], hasConflict: true }]])],
    ]);
    render(<RoomUtilisationHeatmap occupancy={occupancy} rooms={ROOMS} sortedTimeSlotIds={TS_IDS} />);
    expect(screen.getByLabelText(/room 101 150% full at mon p1/i)).toBeInTheDocument();
  });

  it('toggles to a table view', async () => {
    const user = userEvent.setup();
    render(<RoomUtilisationHeatmap occupancy={new Map()} rooms={ROOMS} sortedTimeSlotIds={TS_IDS} />);
    await user.click(screen.getByText(/view as table/i));
    expect(screen.getByLabelText(/room utilisation table/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/organisms/RoomUtilisationHeatmap.test.tsx`
Expected: FAIL — cannot find module `./RoomUtilisationHeatmap`.

- [ ] **Step 3: Implement**

Create `frontend/src/organisms/RoomUtilisationHeatmap.tsx`:

```tsx
import { useState } from 'react';
import {
  Box, Link, Tooltip, Typography,
  Table, TableBody, TableCell, TableHead, TableRow,
} from '@mui/material';
import { WarningAmber } from '@mui/icons-material';
import { formatRoomLabel, formatTimeSlotLabel } from '@/utils/scheduleFormatters';
import type { OccupancyLookup } from '@/utils/aggregateOccupancy';
import type { RawRoom } from '@/types';

interface RoomUtilisationHeatmapProps {
  readonly occupancy: OccupancyLookup;
  readonly rooms: readonly RawRoom[];
  readonly sortedTimeSlotIds: readonly string[];
}

// Validated sequential teal ramp (see docs/superpowers/specs/2026-07-24-simulation-overview-visualizations-design.md)
const RAMP = ['#6fae9f', '#4c9385', '#2c7d6c', '#046b5e', '#023b33'] as const;
const UNBOOKED_COLOR = '#e7e8f0'; // theme.palette.surfaceContainerHigh — neutral, not part of the ramp

const seatFillToColor = (ratio: number): string => {
  if (ratio < 0.2) return RAMP[0];
  if (ratio < 0.4) return RAMP[1];
  if (ratio < 0.6) return RAMP[2];
  if (ratio < 0.8) return RAMP[3];
  return RAMP[4];
};

export default function RoomUtilisationHeatmap({
  occupancy,
  rooms,
  sortedTimeSlotIds,
}: RoomUtilisationHeatmapProps): React.ReactElement {
  const [tableView, setTableView] = useState(false);

  if (rooms.length === 0 || sortedTimeSlotIds.length === 0) {
    return <Typography color="text.secondary">No room data available for this draft.</Typography>;
  }

  const sortedRooms = [...rooms].sort((a, b) => a.id.localeCompare(b.id));

  return (
    <Box>
      <Typography variant="h6" component="h3" gutterBottom>
        Room Utilisation
      </Typography>

      {tableView ? (
        <Table size="small" aria-label="Room utilisation table">
          <TableHead>
            <TableRow>
              <TableCell>Room</TableCell>
              {sortedTimeSlotIds.map((tsId) => (
                <TableCell key={tsId}>{formatTimeSlotLabel(tsId)}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedRooms.map((room) => (
              <TableRow key={room.id}>
                <TableCell>{formatRoomLabel(room.id)}</TableCell>
                {sortedTimeSlotIds.map((tsId) => {
                  const cell = occupancy.get(room.id)?.get(tsId);
                  return (
                    <TableCell key={tsId}>
                      {cell === undefined
                        ? '—'
                        : `${Math.round(cell.seatFillRatio * 100)}%${cell.hasConflict ? ' (conflict)' : ''}`}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <Box
          role="grid"
          aria-label="Room utilisation heatmap"
          sx={{
            display: 'grid',
            gridTemplateColumns: `120px repeat(${sortedTimeSlotIds.length}, minmax(60px, 1fr))`,
            gap: '2px',
          }}
        >
          <Box />
          {sortedTimeSlotIds.map((tsId) => (
            <Typography key={tsId} variant="caption" align="center" sx={{ fontWeight: 600 }}>
              {formatTimeSlotLabel(tsId)}
            </Typography>
          ))}

          {sortedRooms.map((room) => (
            <>
              <Typography
                key={`label-${room.id}`}
                variant="caption"
                sx={{ fontWeight: 600, display: 'flex', alignItems: 'center' }}
              >
                {formatRoomLabel(room.id)}
              </Typography>
              {sortedTimeSlotIds.map((tsId) => {
                const cell = occupancy.get(room.id)?.get(tsId);
                const bg = cell === undefined ? UNBOOKED_COLOR : seatFillToColor(cell.seatFillRatio);
                const pct = cell === undefined ? null : Math.round(cell.seatFillRatio * 100);
                const label = pct === null
                  ? `${formatRoomLabel(room.id)} unbooked at ${formatTimeSlotLabel(tsId)}`
                  : `${formatRoomLabel(room.id)} ${pct}% full at ${formatTimeSlotLabel(tsId)}`;

                return (
                  <Tooltip
                    key={`${room.id}-${tsId}`}
                    title={pct === null ? 'Unbooked' : `${pct}% full${cell?.hasConflict === true ? ' — conflict' : ''}`}
                    enterDelay={300}
                  >
                    <Box
                      sx={{ bgcolor: bg, minHeight: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      aria-label={label}
                    >
                      {cell?.hasConflict === true && (
                        <WarningAmber fontSize="small" sx={{ color: 'warning.main' }} />
                      )}
                    </Box>
                  </Tooltip>
                );
              })}
            </>
          ))}
        </Box>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
        <Typography variant="caption">Emptier</Typography>
        {RAMP.map((color) => (
          <Box key={color} sx={{ width: 16, height: 16, bgcolor: color }} aria-hidden />
        ))}
        <Typography variant="caption">Fuller</Typography>
        <Link
          component="button"
          variant="caption"
          onClick={() => setTableView((v) => !v)}
          sx={{ ml: 2 }}
        >
          {tableView ? 'View as heatmap' : 'View as table'}
        </Link>
      </Box>
    </Box>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/organisms/RoomUtilisationHeatmap.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/organisms/RoomUtilisationHeatmap.tsx frontend/src/organisms/RoomUtilisationHeatmap.test.tsx
git commit -m "feat(frontend): add RoomUtilisationHeatmap organism"
```

---

## Task 11: Frontend — `SimulationOverview` organism

**Files:**
- Create: `frontend/src/organisms/SimulationOverview.tsx`
- Create: `frontend/src/organisms/SimulationOverview.test.tsx`

**Interfaces:**
- Consumes: `state.class`, `state.conflict`, `state.metric`, `state.schedule` (Redux), `aggregateOccupancy` (Task 5), `groupConflictsByType` (Task 6), `HealthSummaryTile` (Task 7), `MetricTileRow` (Task 8), `ConflictBreakdownChart` (Task 9), `RoomUtilisationHeatmap` (Task 10), `GridSkeleton` (existing).
- Produces: `<SimulationOverview onGoToGridView={fn} onSelectConflictType={fn} />` — consumed by Task 12 (`TimetablePage`).

- [ ] **Step 1: Write the failing tests**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import SimulationOverview from './SimulationOverview';
import classReducer from '@/store/reducers/classSlice';
import conflictReducer from '@/store/reducers/conflictSlice';
import metricReducer from '@/store/reducers/metricSlice';
import scheduleReducer from '@/store/reducers/scheduleSlice';
import type { ScheduleClass } from '@/types';

const sampleClass: ScheduleClass = {
  id: 'CLS_001',
  courseId: 'CRS_BIO101',
  title: 'Biology 101',
  professorId: 'PRF_SMITH',
  studentGroupId: 'GRP_BIO_Y1',
  roomId: 'RM_101',
  timeSlotIds: ['TS_MON_P1'],
};

const makeStore = (overrides: {
  classes?: ScheduleClass[];
  classLoading?: boolean;
  scheduleLoading?: boolean;
} = {}) =>
  configureStore({
    reducer: {
      class: classReducer,
      conflict: conflictReducer,
      metric: metricReducer,
      schedule: scheduleReducer,
    },
    preloadedState: {
      class: {
        classes: overrides.classes ?? [],
        total: overrides.classes?.length ?? 0,
        currentPage: 1,
        hasMore: false,
        loading: overrides.classLoading ?? false,
        error: null,
      },
      conflict: { conflicts: [], loading: false, lastFetchedAt: null, error: null },
      metric: { metrics: [], loading: false, error: null },
      schedule: {
        rooms: [{ id: 'RM_101', name: 'Room 101', capacity: 40, building: 'Building A' }],
        studentGroups: [{ id: 'GRP_BIO_Y1', name: 'Bio Year 1', size: 32 }],
        loading: overrides.scheduleLoading ?? false,
        error: null,
      },
    },
  });

describe('SimulationOverview', () => {
  it('shows a skeleton while loading with no classes yet', () => {
    render(
      <Provider store={makeStore({ classLoading: true })}>
        <SimulationOverview onGoToGridView={vi.fn()} onSelectConflictType={vi.fn()} />
      </Provider>,
    );
    expect(screen.getByLabelText(/loading timetable/i)).toBeInTheDocument();
  });

  it('shows an empty state when there are no classes', () => {
    render(
      <Provider store={makeStore({ classes: [] })}>
        <SimulationOverview onGoToGridView={vi.fn()} onSelectConflictType={vi.fn()} />
      </Provider>,
    );
    expect(screen.getByText(/nothing to show yet/i)).toBeInTheDocument();
  });

  it('calls onGoToGridView when the empty-state button is clicked', () => {
    const onGoToGridView = vi.fn();
    render(
      <Provider store={makeStore({ classes: [] })}>
        <SimulationOverview onGoToGridView={onGoToGridView} onSelectConflictType={vi.fn()} />
      </Provider>,
    );
    screen.getByRole('button', { name: /go to grid view/i }).click();
    expect(onGoToGridView).toHaveBeenCalledOnce();
  });

  it('renders the health summary, heatmap, conflict chart and metrics when classes exist', () => {
    render(
      <Provider store={makeStore({ classes: [sampleClass] })}>
        <SimulationOverview onGoToGridView={vi.fn()} onSelectConflictType={vi.fn()} />
      </Provider>,
    );
    expect(screen.getByText(/no scheduling conflicts/i)).toBeInTheDocument();
    expect(screen.getByText(/room utilisation/i)).toBeInTheDocument();
    expect(screen.getByText(/conflicts by type/i)).toBeInTheDocument();
    expect(screen.getByText(/^metrics$/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/organisms/SimulationOverview.test.tsx`
Expected: FAIL — cannot find module `./SimulationOverview`.

- [ ] **Step 3: Implement**

Create `frontend/src/organisms/SimulationOverview.tsx`:

```tsx
import { Box, Button, Stack, Typography } from '@mui/material';
import { useAppSelector } from '@/store/hooks';
import GridSkeleton from '@/organisms/GridSkeleton';
import RoomUtilisationHeatmap from '@/organisms/RoomUtilisationHeatmap';
import HealthSummaryTile from '@/molecules/HealthSummaryTile';
import MetricTileRow from '@/molecules/MetricTileRow';
import ConflictBreakdownChart from '@/molecules/ConflictBreakdownChart';
import { aggregateOccupancy } from '@/utils/aggregateOccupancy';
import { groupConflictsByType } from '@/utils/groupConflictsByType';
import { sortTimeSlotIds, uniqueSorted } from '@/utils/scheduleFormatters';
import type { ConflictType } from '@/types';

interface SimulationOverviewProps {
  readonly onGoToGridView: () => void;
  readonly onSelectConflictType: (type: ConflictType) => void;
}

export default function SimulationOverview({
  onGoToGridView,
  onSelectConflictType,
}: SimulationOverviewProps): React.ReactElement {
  const classes = useAppSelector((s) => s.class.classes);
  const classesLoading = useAppSelector((s) => s.class.loading);
  const conflicts = useAppSelector((s) => s.conflict.conflicts);
  const metrics = useAppSelector((s) => s.metric.metrics);
  const rooms = useAppSelector((s) => s.schedule.rooms);
  const studentGroups = useAppSelector((s) => s.schedule.studentGroups);
  const scheduleLoading = useAppSelector((s) => s.schedule.loading);

  if ((classesLoading || scheduleLoading) && classes.length === 0) {
    return <GridSkeleton />;
  }

  if (classes.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography sx={{ mb: 2 }}>
          Nothing to show yet — add classes in Grid View to see utilisation and conflicts here.
        </Typography>
        <Button variant="contained" onClick={onGoToGridView}>
          Go to Grid View
        </Button>
      </Box>
    );
  }

  const sortedTimeSlotIds = sortTimeSlotIds(uniqueSorted(classes.flatMap((c) => [...c.timeSlotIds])));
  const occupancy = aggregateOccupancy(classes, rooms, studentGroups);
  const conflictCounts = groupConflictsByType(conflicts);

  return (
    <Stack spacing={3} sx={{ p: 3, maxWidth: 900, mx: 'auto' }}>
      <HealthSummaryTile conflictCount={conflicts.length} />
      <RoomUtilisationHeatmap
        occupancy={occupancy}
        rooms={rooms}
        sortedTimeSlotIds={sortedTimeSlotIds}
      />
      <Box>
        <Typography variant="h6" component="h3" gutterBottom>
          Conflicts by Type
        </Typography>
        <ConflictBreakdownChart counts={conflictCounts} onBarClick={onSelectConflictType} />
      </Box>
      <Box>
        <Typography variant="h6" component="h3" gutterBottom>
          Metrics
        </Typography>
        <MetricTileRow metrics={metrics} />
      </Box>
    </Stack>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/organisms/SimulationOverview.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/organisms/SimulationOverview.tsx frontend/src/organisms/SimulationOverview.test.tsx
git commit -m "feat(frontend): add SimulationOverview organism composing the Overview tab"
```

---

## Task 12: Frontend — `WorkspaceTabs` molecule + wire into `TimetablePage`

**Files:**
- Create: `frontend/src/molecules/WorkspaceTabs.tsx`
- Create: `frontend/src/molecules/WorkspaceTabs.test.tsx`
- Modify: `frontend/src/pages/TimetablePage.tsx`
- Test: `frontend/src/pages/TimetablePage.test.tsx` (create if it does not already exist)

**Interfaces:**
- Produces: `<WorkspaceTabs value={'grid'|'overview'} onChange={fn} />`; wires `SimulationOverview` (Task 11) and the schedule fetch (Task 4) into `TimetablePage`; wires `TimetableGrid`'s existing (previously-unused) `conflictedClassIds` prop from `conflictSlice`.

- [ ] **Step 1: Write the failing `WorkspaceTabs` tests**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WorkspaceTabs from './WorkspaceTabs';

describe('WorkspaceTabs', () => {
  it('highlights the active tab', () => {
    render(<WorkspaceTabs value="grid" onChange={vi.fn()} />);
    expect(screen.getByRole('tab', { name: 'Grid View' })).toHaveAttribute('aria-selected', 'true');
  });

  it('calls onChange with "overview" when the Overview tab is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<WorkspaceTabs value="grid" onChange={onChange} />);
    await user.click(screen.getByRole('tab', { name: 'Overview' }));
    expect(onChange).toHaveBeenCalledWith('overview');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/molecules/WorkspaceTabs.test.tsx`
Expected: FAIL — cannot find module `./WorkspaceTabs`.

- [ ] **Step 3: Implement `WorkspaceTabs`**

Create `frontend/src/molecules/WorkspaceTabs.tsx`:

```tsx
import { Tabs, Tab } from '@mui/material';

export type WorkspaceTabValue = 'grid' | 'overview';

interface WorkspaceTabsProps {
  readonly value: WorkspaceTabValue;
  readonly onChange: (value: WorkspaceTabValue) => void;
}

export default function WorkspaceTabs({ value, onChange }: WorkspaceTabsProps): React.ReactElement {
  return (
    <Tabs
      value={value}
      onChange={(_e, newValue: WorkspaceTabValue) => onChange(newValue)}
      aria-label="Timetable workspace view"
    >
      <Tab value="grid" label="Grid View" />
      <Tab value="overview" label="Overview" />
    </Tabs>
  );
}
```

- [ ] **Step 4: Run `WorkspaceTabs` tests to verify they pass**

Run: `cd frontend && npx vitest run src/molecules/WorkspaceTabs.test.tsx`
Expected: PASS.

- [ ] **Step 5: Write the failing `TimetablePage` tests**

Create `frontend/src/pages/TimetablePage.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import TimetablePage from './TimetablePage';
import classReducer from '@/store/reducers/classSlice';
import conflictReducer from '@/store/reducers/conflictSlice';
import metricReducer from '@/store/reducers/metricSlice';
import scheduleReducer from '@/store/reducers/scheduleSlice';
import sessionReducer from '@/store/reducers/sessionSlice';
import uiReducer from '@/store/reducers/uiSlice';

vi.mock('@/hooks/useHeartbeat', () => ({ useHeartbeat: vi.fn() }));
vi.mock('@/hooks/useInactivityWarning', () => ({
  useInactivityWarning: vi.fn().mockReturnValue({ showWarning: false, dismiss: vi.fn() }),
}));
vi.mock('@/organisms/TimetableGrid', () => ({ default: () => <div>Grid View Content</div> }));
vi.mock('@/organisms/SimulationOverview', () => ({ default: () => <div>Overview Content</div> }));
vi.mock('@/organisms/Inspector', () => ({ default: () => null }));
vi.mock('@/organisms/HUD', () => ({ default: () => null }));
vi.mock('@/organisms/SessionExpiryModal', () => ({ default: () => null }));
vi.mock('@/organisms/SubmitProposalModal', () => ({ default: () => null }));
vi.mock('@/services/simulationService', () => ({
  simulationService: {
    getSimulationClasses: vi.fn().mockResolvedValue({ data: [], total: 0, page: 1 }),
    getSchedule: vi.fn().mockResolvedValue({
      metadata: {}, courses: [], professors: [], studentGroups: [], rooms: [], timeSlots: [], classes: [],
    }),
    getConflicts: vi.fn().mockResolvedValue([]),
    getMetrics: vi.fn().mockResolvedValue([]),
  },
}));

const makeStore = () =>
  configureStore({
    reducer: {
      class: classReducer,
      conflict: conflictReducer,
      metric: metricReducer,
      schedule: scheduleReducer,
      session: sessionReducer,
      ui: uiReducer,
    },
  });

const renderPage = () =>
  render(
    <Provider store={makeStore()}>
      <MemoryRouter initialEntries={['/simulations/sim-1']}>
        <Routes>
          <Route path="/simulations/:id" element={<TimetablePage />} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );

describe('TimetablePage — workspace tabs', () => {
  it('shows Grid View content by default', () => {
    renderPage();
    expect(screen.getByText('Grid View Content')).toBeInTheDocument();
  });

  it('switches to Overview content when the Overview tab is clicked', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('tab', { name: 'Overview' }));
    expect(screen.getByText('Overview Content')).toBeInTheDocument();
    expect(screen.queryByText('Grid View Content')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run `TimetablePage` tests to verify they fail**

Run: `cd frontend && npx vitest run src/pages/TimetablePage.test.tsx`
Expected: FAIL — no "Overview" tab exists yet (`getByRole('tab', { name: 'Overview' })` throws).

- [ ] **Step 7: Implement — wire tabs, schedule fetch, and conflictedClassIds into `TimetablePage`**

Replace the full contents of `frontend/src/pages/TimetablePage.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import AppShell from '@/templates/AppShell';
import TimetableGrid from '@/organisms/TimetableGrid';
import SimulationOverview from '@/organisms/SimulationOverview';
import Inspector from '@/organisms/Inspector';
import HUD from '@/organisms/HUD';
import SessionExpiryModal from '@/organisms/SessionExpiryModal';
import SubmitProposalModal from '@/organisms/SubmitProposalModal';
import ViewBySelector from '@/molecules/ViewBySelector';
import SaveChangesButton from '@/molecules/SaveChangesButton';
import InactivityBanner from '@/molecules/InactivityBanner';
import WorkspaceTabs, { type WorkspaceTabValue } from '@/molecules/WorkspaceTabs';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setSession } from '@/store/reducers/sessionSlice';
import { fetchClassesPage, resetClasses } from '@/store/reducers/classSlice';
import { fetchScheduleThunk } from '@/store/reducers/scheduleSlice';
import { selectClass, toggleInspector } from '@/store/reducers/uiSlice';
import { useHeartbeat } from '@/hooks/useHeartbeat';
import { useInactivityWarning } from '@/hooks/useInactivityWarning';
import type { ConflictType } from '@/types';

const PAGE_SIZE = 50; // must match PAGE_SIZE in classSlice

export default function TimetablePage(): React.ReactElement {
  const { id: simId } = useParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const [submitOpen, setSubmitOpen] = useState(false);
  const [tab, setTab] = useState<WorkspaceTabValue>('grid');

  const conflicts = useAppSelector((s) => s.conflict.conflicts);
  const conflictedClassIds = useMemo(
    () => new Set(conflicts.flatMap((c) => c.classIds)),
    [conflicts],
  );

  // Session lifecycle hooks
  useHeartbeat(simId ?? null);
  const { showWarning, dismiss } = useInactivityWarning(simId ?? '');

  // On mount: set session context and eagerly load all class pages + schedule master data
  useEffect(() => {
    if (!simId) return;
    dispatch(resetClasses());
    dispatch(setSession(simId));
    void dispatch(fetchScheduleThunk(simId));

    const loadAll = async (): Promise<void> => {
      let page = 1;
      let more = true;
      while (more) {
        const result = await dispatch(fetchClassesPage({ simId, page }));
        if (fetchClassesPage.fulfilled.match(result)) {
          more = result.payload.classes.length === PAGE_SIZE;
          page++;
        } else {
          break;
        }
      }
    };

    void loadAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simId]);

  const handleSelectConflictType = (type: ConflictType): void => {
    const match = conflicts.find((c) => c.type === type);
    if (match !== undefined) {
      dispatch(selectClass(match.classIds[0]));
      dispatch(toggleInspector(true));
    }
    setTab('grid');
  };

  if (!simId) {
    return (
      <AppShell>
        <Box sx={{ p: 4 }}>
          <Typography color="error">No simulation ID provided.</Typography>
        </Box>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
        {/* Inactivity warning — pinned below TopAppBar */}
        {showWarning && (
          <InactivityBanner simId={simId} onDismiss={dismiss} />
        )}

        {/* Toolbar */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            px: 3,
            py: 1.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
            flexShrink: 0,
          }}
        >
          <ViewBySelector />
          <Box sx={{ flex: 1 }} />
          <SaveChangesButton simId={simId} />
        </Box>

        {/* Workspace tabs */}
        <Box sx={{ px: 3, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
          <WorkspaceTabs value={tab} onChange={setTab} />
        </Box>

        {/* Main area: grid + inspector overlay, or overview */}
        <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative', display: 'flex' }}>
          {tab === 'grid' ? (
            <>
              <TimetableGrid conflictedClassIds={conflictedClassIds} />
              <Inspector simId={simId} />
            </>
          ) : (
            <Box sx={{ flex: 1, overflow: 'auto' }}>
              <SimulationOverview
                onGoToGridView={() => setTab('grid')}
                onSelectConflictType={handleSelectConflictType}
              />
            </Box>
          )}
        </Box>

        {/* HUD — bottom bar with live conflicts + metrics */}
        <HUD simId={simId} onSubmitProposal={() => setSubmitOpen(true)} />
      </Box>

      {/* Submit Proposal Modal — rendered outside the main layout so Snackbar persists */}
      <SubmitProposalModal
        open={submitOpen}
        simId={simId}
        onClose={() => setSubmitOpen(false)}
      />

      {/* Session expiry overlay — non-dismissable */}
      <SessionExpiryModal />
    </AppShell>
  );
}
```

- [ ] **Step 8: Run `TimetablePage` tests to verify they pass**

Run: `cd frontend && npx vitest run src/pages/TimetablePage.test.tsx`
Expected: PASS.

- [ ] **Step 9: Run the full frontend test suite to check for regressions**

Run: `cd frontend && npx vitest run`
Expected: PASS (no regressions in `TimetableGrid.test.tsx`, `HUD.test.tsx`, etc.)

- [ ] **Step 10: Commit**

```bash
git add frontend/src/molecules/WorkspaceTabs.tsx frontend/src/molecules/WorkspaceTabs.test.tsx frontend/src/pages/TimetablePage.tsx frontend/src/pages/TimetablePage.test.tsx
git commit -m "feat(frontend): add Overview tab to the Timetable workspace"
```

---

## Task 13: Frontend — `TimetableGrid` building grouping/collapsing (room view)

**Files:**
- Modify: `frontend/src/organisms/TimetableGrid.tsx`
- Modify: `frontend/src/organisms/TimetableGrid.test.tsx`

**Interfaces:**
- Consumes: `state.schedule.rooms` (Task 4, for `RawRoom.building`).
- Produces: no new external interface — internal rendering change only, active when `viewBy === 'room'`.

- [ ] **Step 1: Write the failing tests**

Add to `frontend/src/organisms/TimetableGrid.test.tsx` (needs `schedule` reducer added to `makeStore`'s reducer map and `preloadedState`, and a helper for rooms-with-buildings):

```tsx
import scheduleReducer from '@/store/reducers/scheduleSlice';

// Update makeStore to also register schedule + accept a rooms override:
const makeStoreWithRooms = (
  classes: ScheduleClass[],
  rooms: Array<{ id: string; name: string; capacity: number; building: string }>,
) =>
  configureStore({
    reducer: { class: classReducer, ui: uiReducer, schedule: scheduleReducer },
    preloadedState: {
      class: { classes, total: classes.length, currentPage: 1, hasMore: false, loading: false, error: null },
      ui: { role: 'user' as const, selectedClassId: null, inspectorOpen: false, viewBy: 'room' as const },
      schedule: { rooms, studentGroups: [], loading: false, error: null },
    },
  });

describe('TimetableGrid — building grouping', () => {
  const classInBuildingA = { ...sampleClass, id: 'CLS_A', roomId: 'RM_101' };
  const classInBuildingB = { ...sampleClass, id: 'CLS_B', roomId: 'RM_201' };
  const ROOMS = [
    { id: 'RM_101', name: 'Room 101', capacity: 40, building: 'Building A' },
    { id: 'RM_201', name: 'Room 201', capacity: 30, building: 'Building B' },
  ];

  it('renders a building header row for each distinct building when viewBy=room', () => {
    render(
      <Provider store={makeStoreWithRooms([classInBuildingA, classInBuildingB], ROOMS)}>
        <MemoryRouter>
          <TimetableGrid />
        </MemoryRouter>
      </Provider>,
    );
    expect(screen.getByText(/building a/i)).toBeInTheDocument();
    expect(screen.getByText(/building b/i)).toBeInTheDocument();
  });

  it('hides a building\'s room rows when its header is collapsed', async () => {
    const user = userEvent.setup();
    render(
      <Provider store={makeStoreWithRooms([classInBuildingA], ROOMS)}>
        <MemoryRouter>
          <TimetableGrid />
        </MemoryRouter>
      </Provider>,
    );
    expect(screen.getByText(/room 101/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /collapse building a/i }));
    expect(screen.queryByText(/room 101/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/organisms/TimetableGrid.test.tsx -t "building grouping"`
Expected: FAIL — no "Building A"/"Building B" text rendered yet.

- [ ] **Step 3: Implement**

In `frontend/src/organisms/TimetableGrid.tsx`:

Add imports:

```tsx
import { useMemo, useState } from 'react';
import { IconButton } from '@mui/material';
import { ExpandMore, ExpandLess } from '@mui/icons-material';
```

(merge with the existing `useMemo`/MUI imports rather than duplicating).

Add a `rooms` selector and a `buildingOf` map, plus collapse state, inside the component body (after the existing `viewBy`/`classes`/`loading` selectors):

```tsx
  const rooms = useAppSelector((s) => s.schedule.rooms);
  const [collapsedBuildings, setCollapsedBuildings] = useState<ReadonlySet<string>>(new Set());

  const buildingOf = useMemo(
    () => new Map(rooms.map((r) => [r.id, r.building])),
    [rooms],
  );

  const toggleBuilding = (building: string): void => {
    setCollapsedBuildings((prev) => {
      const next = new Set(prev);
      if (next.has(building)) next.delete(building);
      else next.add(building);
      return next;
    });
  };
```

Extract the existing per-resource row body (the `resourceIds.map((resId) => { ... return (<>...</>) })` block) into a helper function `renderResourceRow(resId: string)` defined just before the component's `return`, with the exact same body it already has (row label + cells), so it can be called from both the grouped-by-building branch and the ungrouped branch:

```tsx
  const renderResourceRow = (resId: string): React.ReactNode => {
    const rowLookup = lookup.get(resId) ?? new Map<string, ScheduleClass>();
    const cells: React.ReactNode[] = [];
    let skipCols = 0;

    sortedTsIds.forEach((tsId, colIdx) => {
      if (skipCols > 0) {
        skipCols--;
        return;
      }

      const cls = rowLookup.get(tsId);
      if (cls !== undefined) {
        const span = calcSpan(cls, sortedTsIds);
        skipCols = span - 1;
        const isConflicted = conflictedClassIds.has(cls.id);
        cells.push(
          <Box
            key={`${resId}-${tsId}`}
            sx={{ ...cellSx, gridColumn: `${colIdx + 2} / span ${span}` }}
          >
            <ClassChip classItem={cls} state={isConflicted ? 'conflicted' : 'default'} />
          </Box>,
        );
      } else {
        cells.push(
          <Box
            key={`${resId}-${tsId}`}
            sx={{ ...cellSx, gridColumn: colIdx + 2 }}
            aria-label="Empty time slot"
          />,
        );
      }
    });

    return (
      <>
        <Box key={`label-${resId}`} sx={stickyLabelSx}>
          <Tooltip title={resId} enterDelay={300}>
            <Typography variant="caption" sx={{ fontWeight: 600 }} noWrap>
              {formatResourceLabel(resId, viewBy)}
            </Typography>
          </Tooltip>
        </Box>
        {cells}
      </>
    );
  };
```

Replace the existing `{resourceIds.map((resId) => { ... })}` block (the one currently inline in the JSX, which becomes redundant with `renderResourceRow`) with building-aware rendering:

```tsx
        {viewBy === 'room' ? (
          Object.entries(
            resourceIds.reduce<Record<string, string[]>>((acc, resId) => {
              const building = buildingOf.get(resId) ?? 'Other';
              (acc[building] ??= []).push(resId);
              return acc;
            }, {}),
          )
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([building, roomIds]) => {
              const collapsed = collapsedBuildings.has(building);
              const buildingConflictCount = roomIds
                .flatMap((resId) => [...(lookup.get(resId)?.values() ?? [])])
                .filter((cls) => conflictedClassIds.has(cls.id)).length;

              return (
                <>
                  <Box
                    key={`building-${building}`}
                    sx={{ ...stickyLabelSx, gridColumn: `1 / span ${colCount + 1}`, justifyContent: 'space-between' }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>
                      {building} · {roomIds.length} room{roomIds.length === 1 ? '' : 's'}
                      {buildingConflictCount > 0 ? ` · ${buildingConflictCount} conflict${buildingConflictCount === 1 ? '' : 's'}` : ''}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => toggleBuilding(building)}
                      aria-label={collapsed ? `Expand ${building}` : `Collapse ${building}`}
                    >
                      {collapsed ? <ExpandMore /> : <ExpandLess />}
                    </IconButton>
                  </Box>
                  {!collapsed && roomIds.map((resId) => renderResourceRow(resId))}
                </>
              );
            })
        ) : (
          resourceIds.map((resId) => renderResourceRow(resId))
        )}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/organisms/TimetableGrid.test.tsx`
Expected: PASS (all pre-existing `TimetableGrid` tests plus the new building-grouping tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/organisms/TimetableGrid.tsx frontend/src/organisms/TimetableGrid.test.tsx
git commit -m "feat(frontend): group Timetable grid rows by building in room view"
```

---

## Task 14: Frontend — `TimetableGrid` density/zoom control

**Files:**
- Modify: `frontend/src/organisms/TimetableGrid.tsx`
- Modify: `frontend/src/organisms/TimetableGrid.test.tsx`

**Interfaces:**
- No external interface change — internal row-height control only.

- [ ] **Step 1: Write the failing tests**

Add to `frontend/src/organisms/TimetableGrid.test.tsx`:

```tsx
describe('TimetableGrid — density control', () => {
  it('defaults to comfortable row height', () => {
    render_([sampleClass]);
    expect(screen.getByLabelText(/comfortable row height/i)).toHaveAttribute('aria-pressed', 'true');
  });

  it('switches to compact row height when Compact is clicked', async () => {
    const user = userEvent.setup();
    render_([sampleClass]);
    await user.click(screen.getByRole('button', { name: /compact row height/i }));
    expect(screen.getByLabelText(/compact row height/i)).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText(/comfortable row height/i)).toHaveAttribute('aria-pressed', 'false');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/organisms/TimetableGrid.test.tsx -t "density control"`
Expected: FAIL — no element with label `/comfortable row height/i` exists yet.

- [ ] **Step 3: Implement**

In `frontend/src/organisms/TimetableGrid.tsx`, add the import:

```tsx
import { ToggleButton, ToggleButtonGroup } from '@mui/material';
```

Add density state and a row-height constant, near the other `useState`/`useMemo` declarations:

```tsx
  const [density, setDensity] = useState<'compact' | 'comfortable'>('comfortable');
  const rowHeight = density === 'compact' ? 44 : 72;
```

Update `cellSx` and `stickyLabelSx` usages inside `renderResourceRow` (from Task 13) and the building-header row to override `minHeight: rowHeight` instead of the module-level constant's hardcoded `72`:

```tsx
        <Box key={`label-${resId}`} sx={{ ...stickyLabelSx, minHeight: rowHeight }}>
```

and for each data cell:

```tsx
          <Box key={`${resId}-${tsId}`} sx={{ ...cellSx, minHeight: rowHeight, gridColumn: `${colIdx + 2} / span ${span}` }}>
```

(apply the same `minHeight: rowHeight` override to the empty-cell `Box` branch too).

Wrap the component's existing root return in an outer flex column, with the density toggle above the scrollable grid `Box`. Replace the entire `return (...)` statement (the `GridSkeleton` early-return above it, at the top of the function, stays exactly as-is and is not touched by this step) with:

```tsx
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'flex-end',
          px: 1,
          py: 0.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <ToggleButtonGroup
          value={density}
          exclusive
          size="small"
          aria-label="Row density"
          onChange={(_e, next: 'compact' | 'comfortable' | null) => {
            if (next !== null) setDensity(next);
          }}
        >
          <ToggleButton value="comfortable" aria-label="Comfortable row height">
            Comfortable
          </ToggleButton>
          <ToggleButton value="compact" aria-label="Compact row height">
            Compact
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Box
        onClick={() => dispatch(deselectClass())}
        sx={{ overflow: 'auto', flex: 1 }}
        aria-label="Timetable grid"
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: `100px repeat(${colCount}, minmax(150px, 1fr))`,
            width: 'max-content',
            minWidth: '100%',
          }}
        >
          {/* ── Row 0: sticky header ── */}
          <Box sx={{ ...stickyHeaderSx, position: 'sticky', left: 0, zIndex: 20 }} />

          {sortedTsIds.map((tsId) => (
            <Box key={tsId} sx={stickyHeaderSx}>
              <Tooltip title={tsId} enterDelay={300}>
                <Typography variant="caption" sx={{ fontWeight: 600 }} noWrap>
                  {formatTimeSlotLabel(tsId)}
                </Typography>
              </Tooltip>
            </Box>
          ))}

          {/* ── Data rows — grouped by building in room view (Task 13), flat otherwise ── */}
          {viewBy === 'room' ? (
            Object.entries(
              resourceIds.reduce<Record<string, string[]>>((acc, resId) => {
                const building = buildingOf.get(resId) ?? 'Other';
                (acc[building] ??= []).push(resId);
                return acc;
              }, {}),
            )
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([building, roomIds]) => {
                const collapsed = collapsedBuildings.has(building);
                const buildingConflictCount = roomIds
                  .flatMap((resId) => [...(lookup.get(resId)?.values() ?? [])])
                  .filter((cls) => conflictedClassIds.has(cls.id)).length;

                return (
                  <>
                    <Box
                      key={`building-${building}`}
                      sx={{ ...stickyLabelSx, minHeight: rowHeight, gridColumn: `1 / span ${colCount + 1}`, justifyContent: 'space-between' }}
                    >
                      <Typography variant="caption" sx={{ fontWeight: 700 }}>
                        {building} · {roomIds.length} room{roomIds.length === 1 ? '' : 's'}
                        {buildingConflictCount > 0 ? ` · ${buildingConflictCount} conflict${buildingConflictCount === 1 ? '' : 's'}` : ''}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => toggleBuilding(building)}
                        aria-label={collapsed ? `Expand ${building}` : `Collapse ${building}`}
                      >
                        {collapsed ? <ExpandMore /> : <ExpandLess />}
                      </IconButton>
                    </Box>
                    {!collapsed && roomIds.map((resId) => renderResourceRow(resId))}
                  </>
                );
              })
          ) : (
            resourceIds.map((resId) => renderResourceRow(resId))
          )}

          {/* Empty state when no classes loaded */}
          {!loading && classes.length === 0 && (
            <Box
              sx={{
                gridColumn: `1 / span ${colCount + 1}`,
                display: 'flex',
                justifyContent: 'center',
                py: 8,
              }}
            >
              <Typography color="text.secondary">
                No classes loaded. The schedule may be empty.
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
```

And update `renderResourceRow` (from Task 13) so its label and cell `Box`es use `minHeight: rowHeight` instead of relying solely on `stickyLabelSx`/`cellSx`'s baked-in `72`:

```tsx
        <Box key={`label-${resId}`} sx={{ ...stickyLabelSx, minHeight: rowHeight }}>
```

```tsx
          <Box
            key={`${resId}-${tsId}`}
            sx={{ ...cellSx, minHeight: rowHeight, gridColumn: `${colIdx + 2} / span ${span}` }}
          >
```

```tsx
          <Box
            key={`${resId}-${tsId}`}
            sx={{ ...cellSx, minHeight: rowHeight, gridColumn: colIdx + 2 }}
            aria-label="Empty time slot"
          />
```

(each replacing the corresponding `Box` inside `renderResourceRow`'s three branches — conflicted/default chip cell, and the empty-cell branch).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/organisms/TimetableGrid.test.tsx`
Expected: PASS (all pre-existing tests, Task 13's building-grouping tests, and the new density tests).

- [ ] **Step 5: Run the full frontend test suite one final time**

Run: `cd frontend && npx vitest run`
Expected: PASS — no regressions anywhere in the frontend suite.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/organisms/TimetableGrid.tsx frontend/src/organisms/TimetableGrid.test.tsx
git commit -m "feat(frontend): add compact/comfortable density control to Timetable grid"
```

---

## Manual accessibility check (after Task 10, before considering the plan complete)

Run the dataviz skill's validator against the two palettes used (values already computed and embedded in Tasks 9 and 10's code):

```bash
node <dataviz-skill-base>/scripts/validate_palette.js "#6fae9f,#4c9385,#2c7d6c,#046b5e,#023b33" --mode light --ordinal
node <dataviz-skill-base>/scripts/validate_palette.js "#2f6fc4,#b35c00,#5b3a9e" --mode light
```

Both were validated during design (all checks pass) — this is a final confirmation, not new work, in case either palette was hand-edited during implementation. `<dataviz-skill-base>` is wherever the `dataviz` skill is loaded in the implementing session (invoke the skill and note its base directory).
