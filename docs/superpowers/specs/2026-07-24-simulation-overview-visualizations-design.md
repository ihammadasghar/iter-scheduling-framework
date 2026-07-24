# Simulation Overview: Gantt Enhancements, Density Heatmap & Diagnostics — Design

## Problem

The Timetable workspace (`frontend/src/pages/TimetablePage.tsx`, route `/simulations/:id`) is the only place a user sees their draft schedule, and today it's a single view: a hand-rolled resource × time-slot grid (`TimetableGrid`) plus a bottom HUD showing conflict/metric counts as plain MUI chips (`HUD.tsx`). There's no way to see "the bigger picture" — overall room-utilisation density across the week, a breakdown of what kinds of conflicts exist, or a calm at-a-glance health summary — without manually scanning every cell of the grid. The user (target audience: 50+ non-technical university staff, per `docs/stitch-prompt.md`) has asked for better visualization strategies: an interactive resource Gantt (hard constraints), density heatmaps (soft constraints), and better diagnostic dashboards.

## Goal

Add a second tab, "Overview," to the existing Timetable workspace, containing a room-utilisation density heatmap and a diagnostics dashboard (health summary, conflict breakdown, metric tiles) — plus targeted visual polish to the existing Gantt-style grid — so a user can understand a draft simulation's overall health and density without clicking through every cell. All of this reads as a calm, plain-language administrative tool consistent with the existing design system, not a developer dashboard.

## Non-goals

- Drag-and-drop rescheduling on the grid — interactivity stays at click-to-inspect (existing Inspector flow); this design only adds hover tooltips, resource grouping/collapsing, and a density/zoom control.
- Any change to the Simulation Dashboard (`SimulationDashboardPage.tsx`) home page — its per-draft summary cards are out of scope; deeper visualization lives only inside the per-simulation workspace.
- A draft-vs-published-schedule comparison view — the diagnostics dashboard shows the current draft's own snapshot only.
- A generic charting/calendar library for the heatmap or the Gantt grid — both stay hand-rolled to preserve pixel-aligned consistency with the existing grid layout.

**Scope correction from the original brainstorm:** the design originally assumed zero backend changes. Investigation during planning found that room `capacity` and student-group `size` — required for the seat-fill heatmap — are hydrated into the graph DB per simulation but never re-exposed through any API route; the frontend only ever sees IDs (`roomId`, `studentGroupId`), never the numbers. A minimal read-only endpoint is therefore in scope (see below); everything else (conflict breakdown, metric tiles, health summary) still needs no backend changes since `conflictSlice`/`metricSlice` already carry that data.

## Design

### Architecture & navigation

```
TimetablePage
├── Toolbar (existing: title, ViewBySelector, Save button)
├── NEW: WorkspaceTabs — "Grid View" | "Overview"  (MUI Tabs)
├── conditional content:
│   ├── "Grid View" → existing TimetableGrid + Inspector (enhanced — see below)
│   └── "Overview"  → NEW SimulationOverview organism
│         ├── HealthSummaryTile
│         ├── RoomUtilisationHeatmap
│         ├── ConflictBreakdownChart
│         └── MetricTileRow
└── HUD (existing, unchanged — visible under both tabs)
```

- `WorkspaceTabs` selection is local component state (not URL/Redux) — switching tabs doesn't refetch data, since `TimetablePage`'s existing effects already load classes/conflicts/metrics once per simulation.
- `SimulationOverview` is mostly a derived-data view: conflicts/metrics come from the Redux state the Grid/HUD already consume, with one addition — a new `scheduleSlice` fetches room/student-group master data once per simulation (mirroring how `classSlice` fetches classes), since that data doesn't exist client-side today.
- New reusable pieces:
  - `frontend/src/organisms/SimulationOverview.tsx`
  - `frontend/src/organisms/RoomUtilisationHeatmap.tsx`
  - `frontend/src/molecules/ConflictBreakdownChart.tsx`
  - `frontend/src/molecules/HealthSummaryTile.tsx`
  - `frontend/src/utils/aggregateOccupancy.ts` — pure function `aggregateOccupancy(classes, rooms, timeSlots, studentGroups)` → per-cell seat-fill grid
  - `frontend/src/utils/groupConflictsByType.ts` — pure function grouping `Conflict[]` by `type`
  - `frontend/src/store/reducers/scheduleSlice.ts` — new slice holding `{ rooms: RawRoom[], studentGroups: RawStudentGroup[] }`, fetched via a new `getSchedule` service call
- The Simulation Dashboard (`SimulationDashboardPage.tsx`) is untouched.

### New backend endpoint — `GET /simulations/:id/schedule`

Room `capacity` and student-group `size` already live in the graph DB per branch, and `GraphService.exportScheduleJson(simulationId)` **already exists** and already returns the full `ScheduleJson` (courses, professors, studentGroups, rooms, timeSlots, classes) as a JSON string — it's just never read back out through any route today (its only caller is `SimulationService.commit()`, which writes it to GitHub). No new Cypher or `IGraphService` method is needed — just a thin read path reusing what's already there:

- `ISimulationService`/`SimulationService`: new `getSchedule(simulationId)` — same registry-touch/404-guard pattern as `getConflicts`/`getMetrics`, calling `this.graph.exportScheduleJson(simulationId)` and `JSON.parse`-ing the result.
- `SimulationController`: new `getSchedule` handler, same try/catch/`res.json` shape as `getConflicts`/`getMetrics`.
- `routes/simulations.ts`: new `GET /:id/schedule` route.
- Frontend `simulationService.ts`: new `getSchedule(simId)` method, same shape as `getConflicts`/`getMetrics`, typed to return the fields the frontend needs (`rooms`, `studentGroups`).
- No mutation, no new business logic, no new backend query — this is a straightforward read of data the system already computes today via an already-tested method.

### Gantt (Grid View tab) enhancements

Visual polish only — no new interaction model:

- **Resource grouping/collapsing**: rows collapse by building (room view only, using the new schedule master data's `RawRoom.building`); a collapsed group shows an aggregate chip (e.g. "Building A · 6 rooms · 1 conflict").
- **Density/zoom control**: a "Compact / Comfortable" toggle changes row height.
- **Persistent conflict highlighting**: `TimetableGrid` already accepts a `conflictedClassIds` prop and already renders a distinct amber/warning-icon chip style for it (`ClassChip`'s `'conflicted'` state) — it's just never populated today (`TimetablePage` renders `<TimetableGrid />` with no prop passed). This is a wiring fix: pass the current `conflictSlice` conflicts' `classIds` through as a `Set`.
- ~~Hover tooltip~~ — already implemented: `ClassChip` already wraps every chip variant in a `Tooltip` showing title/room/professor. No work needed here.

### Room Utilisation Heatmap

Encodes **seat-fill density**, not raw booking status — this is what makes it a soft-constraint view distinct from the Gantt's hard-constraint conflict view:

- Grid axes match the existing Gantt: rooms (rows) × day/period (columns).
- Each booked cell's value = `studentGroup.size / room.capacity` (how full the room is relative to capacity for that class), computed by `aggregateOccupancy`.
- Unbooked cells render as neutral pale gray — "no data," not "zero density."
- A multi-period class (spanning several `timeSlotIds`) applies the same seat-fill value to each time-slot column it spans, matching how the Gantt grid already renders spanning chips.
- A cell with a hard-constraint conflict (`ROOM_DOUBLE_BOOK` — two classes assigned to the same room+slot) sums the overlapping classes' seat-fill values (which can exceed 100%) and gets a small conflict indicator overlaid on the cell, rather than blending colors — this keeps the heatmap's color meaning ("how full") separate from the Gantt's conflict signal, while still surfacing that the cell is in a bad state.
- Color: sequential single-hue ramp (light → dark) built from the existing UniSchedule teal accent (`#00695C`), kept visually distinct from the primary blue used for interactive Gantt chips.
- A visible legend ("Emptier → Fuller") plus a hover tooltip per cell showing the exact percentage and class name — magnitude is never color-only.
- Palette validated for contrast/colorblind-safety via the dataviz skill's validator before implementation.
- A "View as table" text link provides an accessible tabular fallback, consistent with the existing 50+/low-vision-friendly design mandate.

### Diagnostics dashboard (Overview tab contents)

Single column, same max-width convention as other screens (per `docs/stitch-prompt.md`):

1. **Health Summary tile** (top, full width): plain-language status reusing the same wording/logic as the HUD's conflict chip — "✅ No scheduling conflicts" (green) or "⚠️ 3 scheduling conflicts found" (amber). No new status vocabulary.
2. **Room Utilisation Heatmap** (above), with legend and "View as table" link.
3. **Conflicts by Type**: `@mui/x-charts` `BarChart`, three fixed categorical bars — Room / Professor / Group — translated via the existing copy glossary ("Room double-booked," "Lecturer double-booked," "Student group overlap"). Each bar is clickable and jumps to the Grid tab with that conflict's Inspector open, reusing the existing Inspector-open logic.
4. **Metric tiles row**: the same `MetricResult[]` data the HUD already fetches (e.g. avg classes/lecturer/day vs. target), restyled as larger stat tiles.

### Charting approach

- `@mui/x-charts` (community/free tier) is adopted for the diagnostics dashboard's simple charts (`ConflictBreakdownChart`). Rationale: the app is already all-MUI v9, so `@mui/x-charts` inherits the existing theme tokens (colors, typography, spacing) automatically rather than introducing a second visual language. Its free tier covers bar charts, which is all this design needs.
- The heatmap is **not** built with a charting library — it's a specialized colored grid that must mirror the exact day/period column layout of the existing `TimetableGrid`; no generic heatmap component (including `@mui/x-charts`'s own Heatmap, which is Pro-only) would replicate that alignment.
- All new colors follow the dataviz skill's rules: sequential ramp = one hue light→dark; categorical bars = fixed hue order, never cycled; status colors (green/amber/red) reserved for health/conflict state and never reused as categorical/sequential encodings.

### States

- **Loading**: reuse the existing `GridSkeleton` pattern for the Overview tab's loading placeholders, rather than inventing a new skeleton style.
- **Empty** (no classes scheduled yet): "Nothing to show yet — add classes in Grid View to see utilisation and conflicts here," with a button back to Grid View.
- **Zero conflicts**: the Conflicts-by-Type chart is replaced by a calm green confirmation state ("No conflicts to report") rather than rendering three zero-height bars, which would look broken.

## Testing

- **Backend unit tests**: `SimulationService.test.ts` addition for `getSchedule` (404-when-expired + happy path + confirms it parses `exportScheduleJson`'s output, mirrors `getConflicts`/`getMetrics` tests).
- **Frontend unit tests** (pure functions, table-driven): `aggregateOccupancy.test.ts`, `groupConflictsByType.test.ts`.
- **Frontend component tests**, following the existing `TimetableGrid.test.tsx`/`HUD.test.tsx` patterns: `RoomUtilisationHeatmap.test.tsx`, `SimulationOverview.test.tsx` (loading/empty/zero-conflict/normal states against mock Redux state), `ConflictBreakdownChart.test.tsx`.
- **Manual accessibility check**: run the dataviz skill's palette validator against the heatmap's teal ramp and the conflict-breakdown bar colors (light and dark mode) before implementation is considered done.

## Summary of new/changed files

**Backend:**
- `backend/src/interfaces/ISimulationService.ts` (edit — add `getSchedule`)
- `backend/src/services/SimulationService.ts` / `.test.ts` (edit — implement + test `getSchedule`)
- `backend/src/controllers/SimulationController.ts` (edit — add `getSchedule` handler)
- `backend/src/routes/simulations.ts` (edit — add `GET /:id/schedule` route)
- `backend/src/types/domain.ts` (edit — add `ScheduleMasterData` type)

**Frontend:**
- `frontend/src/pages/TimetablePage.tsx` (edit — add `WorkspaceTabs`, conditional Grid/Overview content, dispatch schedule fetch)
- `frontend/src/services/simulationService.ts` (edit — add `getSchedule` method)
- `frontend/src/store/reducers/scheduleSlice.ts` / `.test.ts` (new)
- `frontend/src/store/store.ts` (edit — register `schedule` reducer)
- `frontend/src/types/schedule.ts` + `frontend/src/types/index.ts` (edit — add/export `ScheduleMasterData`)
- `frontend/src/organisms/SimulationOverview.tsx` / `.test.tsx` (new)
- `frontend/src/organisms/RoomUtilisationHeatmap.tsx` / `.test.tsx` (new)
- `frontend/src/molecules/ConflictBreakdownChart.tsx` / `.test.tsx` (new)
- `frontend/src/molecules/HealthSummaryTile.tsx` (new)
- `frontend/src/utils/aggregateOccupancy.ts` / `.test.ts` (new)
- `frontend/src/utils/groupConflictsByType.ts` / `.test.ts` (new)
- `frontend/src/organisms/TimetableGrid.tsx` (edit — resource grouping/collapsing, density/zoom control, persistent conflict ring, hover tooltip)
- `frontend/package.json` (edit — add `@mui/x-charts` dependency)
