# Frontend Implementation Plan — University Scheduling System

> **Status:** All 17 tasks complete — all 8 screens from `DESIGN.md` are implemented and tested. Backend Gaps 1–4 (§11) were closed separately; see `docs/superpowers/specs/2026-07-23-close-backend-gaps-design.md`.  
> **Related docs:** [`DESIGN.md`](../DESIGN.md) · [`ONBOARDING.md`](../ONBOARDING.md) · [`AGENTS.md`](../AGENTS.md)  
> **Frontend location:** `frontend/` at repo root  

## Overview

Build the complete React + MUI + Redux Toolkit frontend for the university scheduling system. The frontend lives in the `frontend/` directory at the repo root. Visual language is adapted from `ui_example.html` (Material Design 3 color tokens, Inter font, accessible targets). All 8 screens from `DESIGN.md` are implemented.

**Tech stack:** React 18 · TypeScript strict · MUI v5 · Redux Toolkit · React Router v6 · Axios · Vitest + RTL  
**Package manager:** pnpm  
**Dev server:** `pnpm --filter frontend dev` (proxies `/api` → `http://localhost:3000`)

**Backend status:** fully implemented except `RulesService` (501). The plan accounts for these gaps.

---

## Task List (ordered by dependency)

---

### Task 01 — Project Scaffolding

**Description:** Bootstrap the `frontend/` workspace with all tooling configured and ready for feature work.

**Technical details:**
- Create `frontend/` at repo root using `pnpm create vite@latest frontend -- --template react-ts`
- Configure `pnpm` workspace: add `frontend` to a `pnpm-workspace.yaml` at repo root (or manage standalone)
- Install production dependencies:
  - `@mui/material @mui/icons-material @emotion/react @emotion/styled`
  - `react-router-dom@6`
  - `@reduxjs/toolkit react-redux`
  - `axios`
- Install dev dependencies:
  - `vitest @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom @testing-library/user-event`
  - `jsdom`
- Configure `tsconfig.json`: `"strict": true`, `"baseUrl": "src"`, path aliases (`@/` → `src/`)
- Configure `vite.config.ts`: dev server proxy (`/api` → `http://localhost:3000`), alias `@/`
- Configure `vitest.config.ts`: jsdom environment, setupFiles, coverage thresholds (80% controllers, 90% utils)
- Add root-level `package.json` scripts for convenience: `"dev:frontend"`, `"test:frontend"`
- Create `.env.example` with `VITE_API_BASE_URL=http://localhost:3000/api/v1`
- Initial `src/` directory scaffold:
  ```
  src/
  ├── atoms/
  ├── molecules/
  ├── organisms/
  ├── templates/
  ├── pages/
  ├── hooks/
  ├── services/
  ├── store/
  │   └── reducers/
  ├── types/
  ├── utils/
  └── styles/
  ```

**Acceptance criteria:**
- `pnpm --filter frontend dev` starts the Vite dev server without errors
- `pnpm --filter frontend test` runs (0 tests pass, but no config errors)
- `pnpm --filter frontend build` compiles TypeScript with zero errors
- `tsc --noEmit` passes with strict mode enabled
- Path alias `@/` resolves correctly in both Vite and Vitest

---

### Task 02 — MUI Theme & Global Styles

**Description:** Configure the MUI theme with Material Design 3 color tokens extracted from `ui_example.html`, set the Inter font, and establish the accessibility baseline.

**Technical details:**
- Create `src/styles/theme.ts` exporting a MUI `createTheme(...)` object
- Color palette (map `ui_example.html` Tailwind tokens to MUI palette slots):
  ```ts
  primary: { main: '#004d99', contrastText: '#ffffff' }       // primary / on-primary
  secondary: { main: '#046b5e', contrastText: '#ffffff' }     // secondary / on-secondary
  error: { main: '#ba1a1a', contrastText: '#ffffff' }
  success: { main: '#198754', contrastText: '#ffffff' }
  background: { default: '#f9f9ff', paper: '#f9f9ff' }
  text: { primary: '#191c21', secondary: '#424752' }
  ```
  Also define custom tokens in `theme.palette` augmentation for `surfaceContainer`, `outlineVariant`, `primaryContainer` etc. via MUI TypeScript module augmentation
- Typography:
  - `fontFamily: '"Inter", sans-serif'`
  - `body1`: 16px / 24px line-height (WCAG minimum)
  - `body2`: 14px / 20px (minimum for secondary labels)
  - `h1`-`h4` mapped per DESIGN.md size scale
  - `button`: 14px, fontWeight 600
- Component overrides:
  - `MuiButton`: `minHeight: 44px`, `minWidth: 44px` (WCAG touch target)
  - `MuiIconButton`: `minWidth: 44px`, `minHeight: 44px`
  - `MuiChip`: `height: 32px` minimum
  - `MuiTooltip`: `enterDelay: 300`
- Create `src/styles/GlobalStyles.tsx` component with custom scrollbar CSS (matching `ui_example.html` scrollbar styles), imported into `App.tsx`
- Create `src/App.tsx` wrapping children with `<ThemeProvider theme={theme}><CssBaseline /><GlobalStyles />...</ThemeProvider>`
- Load Inter from Google Fonts in `index.html`

**Acceptance criteria:**
- `theme.palette.primary.main` equals `#004d99`
- All `Button`, `IconButton` components have minimum 44×44px touch targets (verifiable via snapshot test)
- Body text renders at 16px minimum
- No hardcoded hex colors in any component — always `theme.palette.*` references
- `pnpm --filter frontend build` still compiles cleanly

---

### Task 03 — TypeScript Type Definitions

**Description:** Define all shared TypeScript interfaces for frontend use, mirroring the backend domain types and adding UI-specific extensions.

**Technical details:**
- Create `src/types/domain.ts` — re-export/re-define all types from the backend's `domain.ts`, adapted for frontend:
  ```ts
  // Domain entities
  interface Simulation { id, branchId, createdAt, userId? }
  interface ScheduleClass { id, courseId, title, professorId, studentGroupId, roomId, timeSlotIds }
  interface Conflict { id, type: 'ROOM_DOUBLE_BOOK'|'PROFESSOR_OVERLAP'|'GROUP_OVERLAP', classIds, message }
  interface MetricResult { name, value, unit }
  interface Suggestion { roomId, timeSlotIds, conflictFree }
  interface Proposal { id, simulationId, status: 'PENDING'|'READY'|'BLOCKED'|'MERGED', createdAt }
  interface ProposalDetail extends Proposal { diff: string, description?: string, userId?: string }
  interface MetricRule { id, name, target, condition, threshold }
  interface Constraint { id, name, target, violationCondition }
  ```
- Create `src/types/schedule.ts` — schedule master data shapes (used for diff ID resolution):
  ```ts
  interface RawTimeSlot { id, day, name, startTime, endTime }
  interface RawRoom { id, name, capacity, building }
  interface RawProfessor { id, name, department }
  interface RawStudentGroup { id, name, size }
  interface RawCourse { id, code, name, department }
  interface ScheduleJson { metadata, timeSlots, rooms, professors, studentGroups, courses, classes }
  ```
- Create `src/types/api.ts` — API request/response shapes:
  ```ts
  interface PaginatedResponse<T> { data: T[], total: number, page: number, limit: number }
  interface ApiError { statusCode: number, code: string, message: string }
  interface CreateSimulationRequest { userId: string }
  interface UpdateClassRequest { roomId?: string, professorId?: string, timeSlotIds?: string[] }
  interface CreateProposalRequest { simulationId: string, description: string }
  interface CreateMetricRuleRequest { name, target, condition, threshold }
  interface CreateConstraintRequest { name, target, violationCondition }
  ```
- Create `src/types/ui.ts` — frontend-only types:
  ```ts
  type UserRole = 'user' | 'admin'
  type ConflictTypeKey = 'ROOM_DOUBLE_BOOK' | 'PROFESSOR_OVERLAP' | 'GROUP_OVERLAP'
  interface ClassChipState { classId: string, hasConflict: boolean, isSelected: boolean }
  interface SimulationCard extends Simulation { conflictCount?: number, metrics?: MetricResult[] }
  type ViewByOption = 'room' | 'professor' | 'studentGroup'
  ```
- Export all from `src/types/index.ts`

**Acceptance criteria:**
- All interfaces have `readonly` on every property
- `strict: true` TypeScript compiles with no `any` usage
- Every API request and response shape has a matching typed interface
- `src/types/index.ts` re-exports everything for single-import convenience

---

### Task 04 — API Service Layer

**Description:** Build the typed Axios service modules that wrap every backend endpoint, with a shared base client and error normalisation.

**Technical details:**
- Create `src/services/apiClient.ts`:
  - Axios instance with `baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1'`
  - Request interceptor: adds `Content-Type: application/json`
  - Response interceptor: on error, normalise to `ApiError` shape; rethrow
  - Export typed `apiClient` instance
- Create `src/services/simulationService.ts`:
  ```ts
  createSimulation(userId: string): Promise<Simulation>           // POST /simulations
  getSimulationClasses(id, page, limit): Promise<PaginatedResponse<ScheduleClass>>  // GET /simulations/:id/classes
  updateClass(simId, classId, params): Promise<ScheduleClass>     // PATCH /simulations/:id/classes/:classId
  getClassSuggestions(simId, classId): Promise<Suggestion[]>      // GET /simulations/:id/classes/:classId/suggestions
  getConflicts(simId): Promise<Conflict[]>                        // GET /simulations/:id/conflicts
  getMetrics(simId): Promise<MetricResult[]>                      // GET /simulations/:id/metrics
  commitSimulation(simId): Promise<void>                          // POST /simulations/:id/commit
  sendHeartbeat(simId): Promise<void>                             // POST /simulations/:id/heartbeat
  deleteSimulation(simId): Promise<void>                          // DELETE /simulations/:id (Gap 4 — 404 expected)
  ```
- Create `src/services/proposalService.ts`:
  ```ts
  createProposal(params): Promise<Proposal>                       // POST /proposals
  listProposals(): Promise<Proposal[]>                            // GET /proposals (ci:ready)
  listBlockedProposals(): Promise<Proposal[]>                     // GET /proposals?status=blocked (Gap 2 — empty fallback)
  getProposal(id): Promise<ProposalDetail>                        // GET /proposals/:id
  mergeProposal(id): Promise<Proposal>                            // POST /proposals/:id/merge
  rejectProposal(id): Promise<void>                               // POST /proposals/:id/reject (Gap 3 — 404 fallback)
  ```
- Create `src/services/rulesService.ts`:
  ```ts
  getMetricRules(): Promise<MetricRule[]>                         // GET /rules/metrics (501 — empty fallback)
  createMetricRule(params): Promise<MetricRule>                   // POST /rules/metrics
  deleteMetricRule(id): Promise<void>                             // DELETE /rules/metrics/:id
  getConstraints(): Promise<Constraint[]>                         // GET /rules/constraints
  createConstraint(params): Promise<Constraint>                   // POST /rules/constraints
  deleteConstraint(id): Promise<void>                             // DELETE /rules/constraints/:id
  ```
- Error handling strategy: wrap 501 and gap-related 404/405 in try/catch inside each service function; return empty arrays as safe fallback where appropriate; rethrow for all other errors

**Acceptance criteria:**
- Every service function has an explicit return type
- No `any` types in service files
- 501 responses from rules endpoints return empty arrays without throwing
- `apiClient` base URL is configurable via `VITE_API_BASE_URL` env var
- All service functions are pure (no side effects other than the HTTP call)

---

### Task 05 — Redux Store & All Slices

**Description:** Configure the Redux store and implement all 8 slices with their async thunks.

**Technical details:**
- Create `src/store/store.ts`: `configureStore` with all reducers, `RootState` and `AppDispatch` exports
- Create `src/store/hooks.ts`: typed `useAppDispatch`, `useAppSelector` hooks
- Create each slice in `src/store/reducers/`:

  **`simulationSlice.ts`**
  - State: `{ simulations: Simulation[], current: Simulation | null, loading: boolean, error: string | null }`
  - Thunks: `createSimulationThunk(userId)`, `deleteSimulationThunk(simId)`
  - Load simulation list from `localStorage` on init (persisted IDs) → `loadSimulationsFromStorage` action
  - `setCurrentSimulation(sim)` action
  - Clear current on unmount via `clearCurrentSimulation` action

  **`classSlice.ts`**
  - State: `{ classes: ScheduleClass[], total: number, currentPage: number, hasMore: boolean, loading: boolean }`
  - Thunks: `fetchClassesPage(simId, page)`, `updateClassThunk(simId, classId, params)`
  - `resetClasses` action (called on simulation exit)
  - Store all pages accumulated in `classes[]` for eager grid loading

  **`conflictSlice.ts`**
  - State: `{ conflicts: Conflict[], loading: boolean, lastFetchedAt: number | null }`
  - Thunk: `fetchConflictsThunk(simId)`
  - Debounce: track `lastFetchedAt`; components should call after PATCH with 300ms delay

  **`metricSlice.ts`**
  - State: `{ metrics: MetricResult[], loading: boolean }`
  - Thunk: `fetchMetricsThunk(simId)`

  **`proposalSlice.ts`**
  - State: `{ proposals: Proposal[], blocked: Proposal[], current: ProposalDetail | null, loading: boolean }`
  - Thunks: `fetchProposalsThunk()`, `fetchProposalDetailThunk(id)`, `createProposalThunk(params)`, `mergeProposalThunk(id)`, `rejectProposalThunk(id)`

  **`rulesSlice.ts`**
  - State: `{ metrics: MetricRule[], constraints: Constraint[], loading: boolean, unavailable: boolean }`
  - Thunks: `fetchMetricRulesThunk()`, `createMetricRuleThunk(params)`, `deleteMetricRuleThunk(id)`, `fetchConstraintsThunk()`, `createConstraintThunk(params)`, `deleteConstraintThunk(id)`
  - Set `unavailable: true` when any thunk receives 501

  **`sessionSlice.ts`**
  - State: `{ simulationId: string | null, lastHeartbeat: number, expired: boolean, hasUnsavedChanges: boolean }`
  - Actions: `setSession(simId)`, `clearSession()`, `markExpired()`, `markHeartbeat()`, `setHasUnsavedChanges(bool)`
  - `hasUnsavedChanges` is set to `true` on every successful `PATCH` and `false` after every `POST /commit`

  **`uiSlice.ts`**
  - State: `{ selectedClassId: string | null, inspectorOpen: boolean, role: 'user' | 'admin', viewBy: 'room' | 'professor' | 'studentGroup' }`
  - Actions: `selectClass(id)`, `deselectClass()`, `toggleInspector(bool)`, `setRole(role)`, `setViewBy(option)`

**Acceptance criteria:**
- `RootState` has all 8 slices
- `useAppSelector` and `useAppDispatch` are typed — no raw `useDispatch`/`useSelector` usage in components
- `simulationSlice` persists simulation IDs to `localStorage` on create/delete
- `sessionSlice.hasUnsavedChanges` correctly tracks PATCH vs commit lifecycle
- `rulesSlice.unavailable` is set correctly on 501 response
- All thunks handle `rejected` state and set `error` or `unavailable` accordingly
- `pnpm --filter frontend build` compiles cleanly

---

### Task 06 — App Shell & Routing

**Description:** Wire up React Router, the persistent App Shell frame, and the Top App Bar with role switching.

**Technical details:**
- Update `src/App.tsx`:
  - Wrap with `<BrowserRouter>`, `<ThemeProvider>`, `<Provider store={store}>`
  - `<Routes>` with all 6 route definitions:
    ```
    /                           → SimulationDashboardPage  (user)
    /simulations/:id            → TimetablePage             (user)
    /admin/proposals            → ProposalsDashboardPage    (admin)
    /admin/proposals/:id        → ProposalReviewPage        (admin)
    /admin/rules                → RulesPage                 (admin)
    *                           → NotFoundPage
    ```
  - Wrap admin routes with a `<AdminGuard>` component: redirects to `/` if `uiSlice.role !== 'admin'`
- Create `src/templates/AppShell.tsx`:
  - Renders `<TopAppBar />` + `<main>{children}</main>`
  - Each page uses this as its outer wrapper
- Create `src/organisms/TopAppBar.tsx`:
  - MUI `AppBar` with `position="sticky"`, height 64px
  - Left side: logo icon (`CalendarMonth` MUI icon) + "UniSchedule" text, links to `/`
  - Center/right nav links (conditional on `role`):
    - User view: "My Simulations" → `/`
    - Admin view: "Proposals" → `/admin/proposals`, "Rules" → `/admin/rules`
  - Far right:
    - "DEMO ONLY" `Chip` (small, outlined, not clickable)
    - "Switch to Admin View" / "Switch to User View" `Button` (variant="outlined")
  - Role switch triggers confirmation `Dialog`:
    - Switching to Admin: *"You are now viewing as Admin. Changes you make here affect the published rules."*
    - [Cancel] and [Continue as Admin]
    - On confirm: dispatch `setRole('admin')`
  - Active nav link gets `color="primary"` + bottom border indicator
  - All nav items have `Tooltip` with description
- Create `src/pages/NotFoundPage.tsx`: centred 404 message + "Go Home" button

**Acceptance criteria:**
- Navigating to `/admin/proposals` as a user redirects to `/`
- Role switch toggle updates nav links immediately
- Confirmation dialog appears before switching to admin
- All nav links have visible text labels (no icon-only nav)
- Top bar is sticky (stays at top on scroll)
- Logo click navigates to `/`

---

### Task 07 — Simulation Dashboard (S1)

**Description:** The User's entry screen — lists simulations with status, supports creating and deleting drafts.

**Technical details:**
- Create `src/pages/SimulationDashboardPage.tsx`:
  - Loads simulations from `localStorage`-persisted IDs via `loadSimulationsFromStorage`
  - Dispatches `createSimulationThunk` → loading state → navigate to `/simulations/:id` on success
  - Page heading "My Simulations" + right-aligned `<Button variant="contained" size="large">+ Create New Simulation</Button>`
- Create `src/molecules/CreateSimulationDialog.tsx`:
  - MUI `Dialog` `maxWidth="xs"`
  - `TextField` label "Your name" (the `userId` field) — required, trimmed
  - Submit: dispatches `createSimulationThunk`, shows `LinearProgress` during loading
  - On success: close dialog, store simulation in Redux + localStorage
- Create `src/organisms/PublishedScheduleCard.tsx`:
  - Static `Card` under a "PUBLISHED SCHEDULE" section label
  - Title from `schedule.json` metadata (`semesterName`) — use a placeholder *"Official Published Schedule"* if not fetched
  - "View Schedule" `Button` — navigates to `/simulations/main` (read-only view; not yet fully implemented, can be a soft stub)
  - Section label uses `Typography variant="overline"` style
- Create `src/organisms/SimulationCard.tsx`:
  - Props: `simulation: Simulation, conflictCount?: number, metric?: MetricResult`
  - Human-readable age: `formatDistanceToNow(simulation.createdAt)` from `date-fns` (install if not present)
  - Conflict summary: ✅ "No scheduling conflicts" or ⚠️ "N scheduling conflicts found" (using plain English, never type codes)
  - Key metric chip if available
  - "Open Draft" `Button variant="contained"` → navigate to `/simulations/:id`
  - "Delete Draft" `Button variant="outlined" color="error"` → opens `<DeleteSimulationDialog>`
  - Never displays raw `simulation.id` to the user
- Create `src/molecules/DeleteSimulationDialog.tsx`:
  - Confirmation `Dialog`: *"Are you sure you want to delete this draft? This cannot be undone."*
  - [Cancel] and [Yes, Delete Draft] buttons
  - On confirm: dispatches `deleteSimulationThunk`; on success removes from localStorage and Redux
  - If 404/unimplemented (Gap 4): show inline `Alert` *"Could not delete — please try again later"*
- Create `src/atoms/EmptyState.tsx`:
  - Centred layout with icon, message text, optional CTA `Button`
  - Used when `simulations.length === 0`: *"You haven't started any simulations yet."* + "Create your first simulation" button
- `src/organisms/SimulationCardSkeleton.tsx`:
  - MUI `Skeleton` matching `SimulationCard` shape (3 skeleton lines + 2 skeleton buttons)
  - Shown while `simulationSlice.loading === true`

**Acceptance criteria:**
- "Create New Simulation" button opens dialog; on confirm shows loading and navigates on success
- Simulation cards never show raw IDs — only human-readable age and name
- Conflict count shows correct plain English (not type codes)
- Delete shows confirmation dialog before any action
- Empty state shown when no simulations exist
- Skeleton cards shown during loading
- `date-fns` installed and used for time formatting

---

### Task 08 — Timetable Grid (S2)

**Description:** The core editing workspace. Renders the schedule as a scrollable sticky-header CSS grid with class chips, supports view-by switching, eager pagination loading, and the "Save Changes" commit action.

**Technical details:**
- Create `src/pages/TimetablePage.tsx`:
  - Extracts `simId` from `useParams()`
  - On mount: dispatches `setSession(simId)`, starts eager class loading
  - Eager loading: dispatch `fetchClassesPage(simId, 1)`, then sequentially load subsequent pages until `hasMore === false`; store all in `classSlice.classes[]`
  - Layout: flex column — `<TimetableGrid>` fills remaining height above the `<HUD>` bottom bar
  - Right-side `<Inspector>` drawer does not push grid content (use `position: fixed` or `Drawer variant="persistent"` with padding)
- Create `src/organisms/TimetableGrid.tsx`:
  - CSS Grid using `display: grid` with:
    - Column 1: sticky time-slot label (100px)
    - Columns 2…N: one per `TimeSlot`, sorted by day + `startTime`
    - Row 1: sticky header row with day+period labels
    - Rows 2…M: one per resource (Room/Professor/StudentGroup depending on `viewBy`)
  - Sticky corner cell (top-left) using `position: sticky; z-index: 20`
  - Cell rendering: for each `(resource, timeSlot)` intersection, find matching class in Redux → render `<ClassChip>` if found
  - Multi-slot classes: chip spans multiple columns (use `gridColumn: "span N"`)
  - Grid container has `overflow: auto` with custom scrollbar styles from theme
- Create `src/molecules/ViewBySelector.tsx`:
  - MUI `Select` with options: "View by Room", "View by Professor", "View by Student Group"
  - Each option has a `Tooltip` explaining what it shows
  - On change: dispatch `setViewBy(option)`
- Create `src/atoms/ClassChip.tsx`:
  - Props: `classItem: ScheduleClass, state: 'default' | 'conflicted' | 'selected'`
  - Default: MUI `Chip variant="filled"` with course title (truncated, `maxWidth: 140px`)
  - Conflicted: `Chip variant="outlined" color="warning"` + `WarningAmber` icon
  - Selected: elevated appearance — `Box` with `border: 2px solid primary.main`, `boxShadow: theme.shadows[3]`
  - `onClick`: dispatch `selectClass(classId)`, `toggleInspector(true)`
  - Chip label shows course name (look up from `courseId` in classes array), not the full title
  - `Tooltip` on hover: full title + room + professor name (look up from IDs)
  - Minimum touch target 44×44px per theme override
- Create `src/molecules/SaveChangesButton.tsx`:
  - `Button variant="contained"` labelled "Save Changes"
  - `Tooltip`: *"Saves your current changes to your draft so they are not lost."*
  - On click: dispatches `commitSimulation(simId)` thunk → shows `CircularProgress` inside button during loading
  - On success: dispatches `setHasUnsavedChanges(false)`, shows brief `Snackbar` *"Draft saved ✓"*
  - Disabled if `sessionSlice.hasUnsavedChanges === false`
- Create `src/organisms/GridSkeleton.tsx`:
  - MUI `Skeleton` grid of cells shown while `classSlice.loading && classSlice.classes.length === 0`

**Acceptance criteria:**
- Grid renders correctly for all 3 `viewBy` modes
- Switching `viewBy` re-renders with correct row axis without re-fetching data
- All classes pages are eagerly loaded and accumulated in Redux
- Class chips change state correctly (default → conflicted, default → selected)
- "Save Changes" is disabled when there are no unsaved changes
- "Save Changes" shows loading state during the commit request
- Multi-slot classes span the correct number of columns
- Grid is horizontally and vertically scrollable with sticky headers
- Clicking outside a chip (on empty cell) dispatches `deselectClass()`

---

### Task 09 — Contextual Inspector (S3)

**Description:** The slide-in right panel that shows class details and smart suggestions when a class is selected.

**Technical details:**
- Create `src/organisms/Inspector.tsx`:
  - MUI `Drawer variant="persistent" anchor="right"` — 380px wide
  - Open state driven by `uiSlice.inspectorOpen`
  - Close `IconButton` (×) at top right: dispatches `deselectClass()` + `toggleInspector(false)`
  - Header: course title (resolved from `courseId`), class section name
  - Two sections: "CURRENT ASSIGNMENT" and "SMART SUGGESTIONS"
- Create `src/molecules/ClassDetailSection.tsx`:
  - MUI `List` with `ListItem` rows for:
    - Professor: resolved name from `professorId` using classes master data
    - Room: resolved name from `roomId`
    - Time: resolved names from `timeSlotIds[]` (each shown as "Monday Period 1")
  - All fields read-only; labels use 14px minimum; values use 16px
- Create `src/organisms/SuggestionsList.tsx`:
  - On `selectedClassId` change: dispatches `getClassSuggestions(simId, classId)` → loading state
  - Renders `<SuggestionCard>` for each suggestion
  - Loading: `CircularProgress` centred in panel
  - Empty: *"No conflict-free slots available for this class. Try moving a conflicting class first."*
  - Error: inline `Alert severity="error"` *"Could not load suggestions. Please try again."*
- Create `src/molecules/SuggestionCard.tsx`:
  - Props: `suggestion: Suggestion, onApply: () => void, metricDelta?: MetricDelta, loadingDelta: boolean`
  - Shows: room name (resolved), time slots (resolved), ✓ "No conflicts" badge
  - Metric delta chip: `Chip color="success"` for improvement, `Chip color="error"` for regression; `CircularProgress` while loading
  - "Apply" `Button variant="contained" size="small"`
- Create `src/hooks/useApplySuggestion.ts`:
  - `applysuggestion(simId, classId, suggestion)` async function:
    1. Dispatch `updateClassThunk(simId, classId, { roomId, timeSlotIds })`
    2. Dispatch `setHasUnsavedChanges(true)`
    3. After 300ms debounce, dispatch `fetchConflictsThunk(simId)` + `fetchMetricsThunk(simId)`
    4. Update metric delta in local state for display
  - Returns `{ apply, loading, error }`
- `InspectorSkeleton.tsx`: Skeleton version of the panel shown while `inspectorOpen` but `selectedClassId` just changed

**Acceptance criteria:**
- Inspector opens/closes with slide animation
- Clicking a class chip opens Inspector with that class's details
- All IDs (professorId, roomId, timeSlotIds) are resolved to human-readable names
- Suggestions load when a class is selected
- "Apply" triggers PATCH, then live conflict + metrics refresh
- Metric delta shows after apply completes
- Closing Inspector dispatches `deselectClass()`
- Inspector does not push grid content (uses persistent drawer with explicit right padding on grid container)

---

### Task 10 — Metrics & Conflicts HUD (S4)

**Description:** The persistent bottom bar showing live conflict count and metric values throughout the simulation session.

**Technical details:**
- Create `src/organisms/HUD.tsx`:
  - MUI `Paper` or `AppBar position="fixed" sx={{ top: 'auto', bottom: 0 }}` — 56px tall
  - Visible only on route `/simulations/:id`; mount/unmount with the route
  - On mount: dispatches `fetchConflictsThunk(simId)` + `fetchMetricsThunk(simId)`
  - After each successful `PATCH` (listen via Redux action side-effect or event): re-dispatch both with 300ms debounce
  - Layout: three zones left to right — Conflicts | Metrics | (spacer for Submit button)
- Create `src/molecules/ConflictChip.tsx`:
  - 0 conflicts: `Chip color="success"` icon=`CheckCircle` label="No scheduling conflicts"
  - >0 conflicts: `Chip color="error"` icon=`Warning` label="N scheduling conflict(s) — click to see details"
  - Loading: `Chip` with `CircularProgress size={16}` inside
  - Click → opens `<ConflictPopover>`
- Create `src/molecules/ConflictPopover.tsx`:
  - MUI `Popover` anchored to the ConflictChip
  - Lists each conflict as a plain English sentence:
    - `ROOM_DOUBLE_BOOK` → *"Room [name] is booked for two classes at the same time"*
    - `PROFESSOR_OVERLAP` → *"[Prof name] is already teaching another class at this time"*
    - `GROUP_OVERLAP` → *"[Group name] students are in two classes at once"*
  - Each conflict row is clickable: dispatches `selectClass(classIds[0])`, opens Inspector, closes Popover
  - All names resolved from IDs using `classSlice.classes[]`
  - Technical type code (`ROOM_DOUBLE_BOOK` etc.) never shown to user
- Create `src/molecules/MetricChip.tsx`:
  - Props: `metric: MetricResult`
  - `Chip variant="outlined"` label=`"${metric.name}: ${metric.value}${metric.unit}"`
  - `Tooltip`: plain English explanation of the metric
  - Loading: `CircularProgress size={14}` inside chip
- "Submit Proposal" `Button variant="contained"` rendered at far right of HUD (acts as the trigger for Task 11 modal)
- `src/utils/conflictMessages.ts`: pure function `getConflictMessage(type, resourceName): string` — maps type + name to human sentence

**Acceptance criteria:**
- HUD only visible on `/simulations/:id` route
- Conflict chip shows correct count; updates after every PATCH
- Clicking conflict chip opens popover with plain English messages
- Clicking a conflict row in the popover selects the class and opens Inspector
- Metric chips render all active metrics from `metricSlice`
- "No metrics configured" placeholder shown when `metricSlice.metrics === []`
- No raw type codes visible to users anywhere in HUD
- `getConflictMessage` is a pure function unit-tested in isolation

---

### Task 11 — Submit Proposal Modal & Commit Gate (S5)

**Description:** The transition flow from editing to submitting a proposal, including the unsaved-changes gate, the proposal form, and CI-result feedback via Snackbar.

**Technical details:**
- Create `src/organisms/SubmitProposalModal.tsx`:
  - Controlled by local `open` state; triggered from "Submit Proposal" button in HUD
  - Two-stage flow managed by local state `stage: 'commit-gate' | 'proposal-form'`
- Create `src/molecules/CommitGate.tsx` (stage 1 — shown if `sessionSlice.hasUnsavedChanges === true`):
  - MUI `Dialog maxWidth="sm"`
  - Message: *"You have unsaved changes in this draft. Save them before submitting so nothing is lost."*
  - [Save My Changes First] `Button variant="contained"`:
    - Dispatches `commitSimulation(simId)` thunk with loading state
    - On success: advance to stage 2
  - [Submit Without Saving] `Button variant="text"`:
    - Advance to stage 2 without committing
- Create `src/molecules/ProposalForm.tsx` (stage 2):
  - MUI `Dialog maxWidth="sm"`
  - Title: "Submit Proposal for Review"
  - `TextField multiline rows={4}` label="Explain your changes" — required; placeholder guides user
  - If `conflictSlice.conflicts.length > 0`: show `Alert severity="warning"` — *"Your draft has [N] scheduling conflicts. The scheduling office will see these and may ask you to fix them before approving."* (no type codes)
  - [Cancel] + [Submit for Review →] `Button variant="contained" size="large"`
  - Submit button shows `CircularProgress` while in-flight; disabled while loading
  - `description` field validated: must not be empty before submit
- Submit action:
  1. Dispatch `createProposalThunk({ simulationId, description })`
  2. Close dialog
  3. Show `Snackbar` with `Alert`:
     - `PENDING`/in-flight: *"Your proposal has been submitted and is being checked for conflicts…"*
     - `READY` response: *"Your proposal is ready for review by the scheduling office ✓"* (color="success")
     - `BLOCKED` response: *"Your proposal has scheduling conflicts — the scheduling office has been notified and will contact you"* (color="warning")
     - Error: *"Could not submit proposal. Please try again."* (color="error")
  4. Snackbar `autoHideDuration={8000}` (8 seconds for older users)

**Acceptance criteria:**
- Commit gate shown only if `hasUnsavedChanges === true`; skipped otherwise
- "Save My Changes First" shows loading spinner and only advances on success
- Description field validation prevents empty submission
- Conflict warning uses plain English only; number is correct
- Snackbar message reflects actual CI status from API response
- Snackbar auto-hides after 8 seconds
- Modal is accessible: focus trapped, ESC closes it, aria-labels present

---

### Task 12 — Admin Proposal Dashboard (S6)

**Description:** The Admin's inbox of proposals, separated into Ready and Blocked sections.

**Technical details:**
- Create `src/pages/ProposalsDashboardPage.tsx`:
  - Route: `/admin/proposals`
  - On mount: dispatches `fetchProposalsThunk()` (ready) and attempts blocked fetch (Gap 2 workaround: if API returns error, set `blocked: []` gracefully)
  - Page heading "Proposals for Review" + right-aligned "Refresh List 🔄" `Button variant="text"` with full text label
- Create `src/organisms/ProposalSection.tsx`:
  - Props: `title: string, subtitle: string, proposals: Proposal[], status: 'ready' | 'blocked'`
  - Section heading: `Typography variant="h6"` + status `Chip` (green for ready, amber for blocked)
  - Subtitle: `Typography variant="body2" color="text.secondary"` — one plain English sentence
  - Ready subtitle: *"Checked by the system — no scheduling conflicts found"*
  - Blocked subtitle: *"Cannot be published until the conflicts are fixed"*
  - Renders `<ProposalCard>` for each proposal
  - Empty (no proposals in section): nothing shown (whole section hidden)
- Create `src/molecules/ProposalCard.tsx`:
  - Props: `proposal: Proposal, status: 'ready' | 'blocked'`
  - Shows: submitter name (from `proposal.simulationId`, extract `userId` portion as readable name), time ago (date-fns), first line of description (if available)
  - Raw `simulationId` never shown to user
  - Ready: "Review & Publish →" `Button variant="contained"` → navigate to `/admin/proposals/:id`
  - Blocked: "Review Details →" `Button variant="outlined"` → navigate to `/admin/proposals/:id`
  - Blocked card shows: "⚠️ N scheduling conflicts detected" in amber
- Create `src/organisms/ProposalCardSkeleton.tsx`: Skeleton version for loading state
- Empty state (no proposals at all): centred illustration + *"No proposals waiting for review."*
- `src/utils/formatSimulationId.ts`: pure function `extractUserLabel(simulationId: string): string` — parses `sim-alice-a1b2c3d4` → `"alice"` (or formats as "Unknown" if pattern doesn't match)

**Acceptance criteria:**
- Ready and Blocked sections are visually distinct
- Gap 2 (no blocked endpoint): Blocked section is simply omitted, no error shown
- Refresh button re-fetches proposals
- Proposal cards never show raw simulation IDs
- Skeleton cards shown during loading
- Empty state shown when both sections are empty
- Clicking "Review & Publish →" navigates to detail page

---

### Task 13 — Diff Review Screen (S7)

**Description:** The Admin's detail view of a proposal — shows human-readable diff, CI status, and Approve / Close actions.

**Technical details:**
- Create `src/pages/ProposalReviewPage.tsx`:
  - Route: `/admin/proposals/:id`
  - On mount: dispatches `fetchProposalDetailThunk(id)`
  - Layout: single column, max-width 900px, centred
- Create `src/atoms/BackButton.tsx`:
  - `Button variant="text" startIcon={<ArrowBackIcon />}` — "Back to Proposals" — full text label
  - Navigates back to `/admin/proposals`
- Create `src/molecules/CIStatusBadge.tsx`:
  - `status: 'READY' | 'BLOCKED' | 'PENDING'`
  - READY: `Chip color="success"` — "✅ Checked — no conflicts"
  - BLOCKED: `Chip color="warning"` — "⚠️ Has scheduling conflicts"
  - PENDING: `Chip` — "Checking…" with spinner
  - Below the badge: disclaimer `Typography variant="caption"`: *"This check was run when the proposal was submitted. It does not re-check against changes made to the published schedule after that date."*
- Create `src/utils/diffParser.ts`:
  - `parseDiff(diff: string, schedule: ScheduleJson): ClassChange[]`
  - Parses the raw unified diff string from `ProposalDetail.diff`
  - Extracts changed entries from the `"classes"` array section of the diff
  - Pairs `-` (old) and `+` (new) entries by `"id"` field
  - Resolves all IDs to human-readable names using `schedule` (rooms, professors, groups, timeslots)
  - Returns `ClassChange[]`: `{ className, changes: Array<{ field: string, from: string, to: string }> }`
  - Field name mapping: `professorId` → "Lecturer", `roomId` → "Room", `timeSlotIds` → "Time"
  - This is a pure function — fully unit-testable with no external deps
- Create `src/molecules/ChangeCard.tsx`:
  - Props: `change: ClassChange`
  - `Card` showing class name (human-readable title, not ID)
  - Each changed field: row with label, "From:" value → "To:" value
  - Uses arrow icon between old and new value
- Create `src/organisms/TechnicalDiffAccordion.tsx`:
  - MUI `Accordion` — collapsed by default
  - Label: "Show technical details (for IT use)"
  - Expanded content: `<pre>` block with raw diff string; monospace font
- Approve action:
  - "✅ Approve & Publish" `Button variant="contained" color="success" size="large"`
  - Opens confirmation `Dialog`: *"You are about to publish these changes to the live timetable. This will affect students and lecturers. Are you sure?"*
  - [Cancel] + [Yes, Publish Changes]
  - On confirm: dispatch `mergeProposalThunk(id)` → loading state
  - On success: navigate to `/admin/proposals` + `Snackbar` *"Changes published to the live timetable ✓"*
  - On 409 error: inline `Alert severity="error"` *"This proposal cannot be published because it has unresolved scheduling conflicts."*
- Close (reject) action:
  - "Close This Proposal" `Button variant="outlined"`
  - Opens confirmation `Dialog`: *"Are you sure you want to close this proposal? The lecturer's draft will be kept and they can make adjustments and resubmit."*
  - [Cancel] + [Yes, Close Proposal]
  - On confirm: dispatch `rejectProposalThunk(id)` (Gap 3 — graceful failure with `Alert`)
  - On success: navigate to `/admin/proposals` + `Snackbar` *"Proposal closed."*

**Acceptance criteria:**
- Diff is parsed and displayed as human-readable change cards (no raw JSON shown by default)
- All IDs resolved to names in change cards (roomId → "Room 101", etc.)
- Technical diff Accordion is collapsed by default
- CI status badge uses plain English labels only
- Disclaimer shown below CI badge
- Approve opens confirmation dialog before calling API
- Close opens separate confirmation dialog
- Gap 3 (reject not implemented): shows `Alert` *"This feature is not available yet"* instead of crashing
- `parseDiff` is a pure function

---

### Task 14 — Rule Builder (S8)

**Description:** Admin configuration screen for managing metric rules and hard constraints stored in `rules.json`.

**Technical details:**
- Create `src/pages/RulesPage.tsx`:
  - Route: `/admin/rules`
  - On mount: dispatches `fetchMetricRulesThunk()` + `fetchConstraintsThunk()`
  - If `rulesSlice.unavailable === true`: show full-width `Alert severity="info"` — *"The rules configuration service is not available yet. Please contact your IT department."* + still renders the page layout below with disabled add buttons
- Create `src/templates/TwoColumnLayout.tsx`:
  - MUI `Grid container spacing={4}`
  - Left: `Grid item xs={12} md={6}` — Metric Rules section
  - Right: `Grid item xs={12} md={6}` — Hard Constraints section
- Metric Rules section:
  - Section heading "Metric Rules" + `Typography variant="overline"`
  - "+ Add Metric" `Button variant="outlined"` → opens `<AddMetricDialog>`
  - `MetricRuleCard` list
- Constraints section:
  - Identical pattern: "+ Add Constraint" → `<AddConstraintDialog>`
  - `ConstraintRuleCard` list
- Create `src/molecules/MetricRuleCard.tsx`:
  - Shows: name, human-readable target label, human-readable condition label, threshold value
  - Delete `IconButton` with trash icon + tooltip "Delete this rule" (icon must have `aria-label`)
  - Delete click → confirmation `Dialog` → dispatches `deleteMetricRuleThunk(id)` → `Snackbar` *"Rule deleted"*
- Create `src/molecules/ConstraintRuleCard.tsx`: same pattern
- Create `src/molecules/AddMetricDialog.tsx`:
  - MUI `Dialog maxWidth="sm"`
  - Fields:
    - "Name" `TextField` — required
    - "What to measure" `Select` — options: "Classes", "Lecturers", "Rooms" (with Tooltip)
    - "How to measure it" `Select` — options filtered by target:
      - Classes → "Total number of classes" (condition: `count`)
      - Lecturers → "Average classes per lecturer per day" (condition: `avg_classes_per_day`), "Maximum classes any lecturer teaches in one day" (condition: `max_classes_per_day`)
      - Rooms → "Percentage of rooms in use" (condition: `utilization`)
    - "Target value" `TextField type="number"` — min 0; suffix label changes based on condition (e.g., "%" for utilization)
  - [Cancel] + [Add This Metric] `Button variant="contained"`
  - Submit: dispatches `createMetricRuleThunk(params)` → closes dialog → `Snackbar` *"Metric rule added"*
- Create `src/molecules/AddConstraintDialog.tsx`: similar form (simpler — name, target, violationCondition)
- Create `src/utils/ruleLabels.ts`: pure functions `getTargetLabel(target)`, `getConditionLabel(condition)`, `getConditionsByTarget(target)` — maps internal keys to plain English labels
- Create `src/organisms/RuleCardSkeleton.tsx`: skeleton for loading state

**Acceptance criteria:**
- "How to measure it" dropdown options are correctly filtered by selected "What to measure"
- All rule cards show human-readable labels (never raw `target`/`condition` keys)
- Delete shows confirmation dialog before calling API
- 501 response from backend shows the "not available yet" Alert without crashing
- Add dialogs validate required fields before submitting
- Each icon button has a visible `aria-label`
- `getConditionsByTarget` is a pure function unit-tested in isolation

---

### Task 15 — Session Lifecycle (Heartbeat, Expiry, Inactivity)

**Description:** Background heartbeat management, session expiry modal, and inactivity warning banner for the Timetable Grid route.

**Technical details:**
- Create `src/hooks/useHeartbeat.ts`:
  - Accepts `simId: string | null`
  - Sets up `setInterval(60_000)` that calls `simulationService.sendHeartbeat(simId)` on each tick
  - On 404 response: dispatches `markExpired()` in `sessionSlice`
  - On 200: dispatches `markHeartbeat()`
  - Clears interval on unmount (cleanup function)
  - Does nothing if `simId === null`
- Create `src/organisms/SessionExpiryModal.tsx`:
  - Shown when `sessionSlice.expired === true`
  - Non-dismissable `Dialog` (no `onBackdropClick`, no `ESC` close):
    - Heading: "⏱ Your session has ended"
    - Body: *"You were away for a while and your editing session has closed automatically. Don't worry — any changes you saved are still there on your draft. Only unsaved changes from this session were lost."*
    - [Go Back to My Simulations] `Button variant="contained"` → dispatches `clearSession()`, navigates to `/`
    - [Start a New Draft] `Button variant="outlined"` → dispatches `clearSession()`, opens `CreateSimulationDialog`
- Create `src/hooks/useInactivityWarning.ts`:
  - Accepts `simId: string`
  - Tracks time since last API call (use a Redux action middleware or a ref updated on every thunk fulfillment)
  - After 3 minutes (180 seconds) of no API calls: sets local `showWarning: boolean` to `true`
  - Warning auto-dismisses if any API call is made (reset timer)
- Create `src/molecules/InactivityBanner.tsx`:
  - `Alert severity="warning"` pinned below TopAppBar
  - Message: *"You've been away for a while. To avoid losing any unsaved changes, save your draft now or make an edit to keep your session active."*
  - "Save Now" `Button variant="text"` inside Alert: calls `commitSimulation(simId)`
  - "Dismiss" `Button variant="text"` inside Alert: hides banner (does NOT reset the inactivity timer)
- Mount both hooks and both components inside `TimetablePage.tsx`

**Acceptance criteria:**
- Heartbeat interval fires every 60 seconds exactly
- Heartbeat interval is cleared when navigating away from `/simulations/:id`
- 404 from heartbeat endpoint shows expiry modal
- Expiry modal cannot be dismissed by clicking outside or pressing ESC
- "Go Back to My Simulations" clears session state and navigates to `/`
- Inactivity banner appears after 3 minutes of no API activity
- "Save Now" in banner triggers commit
- Banner hides after any successful API call (inactivity timer resets)

---

### Task 16 — Global Error Handling & Loading/Empty States

**Description:** Global Snackbar error handler, per-screen error `Alert` components, and a library of reusable empty/loading state components.

**Technical details:**
- Create `src/hooks/useGlobalErrorSnackbar.ts`:
  - Subscribes to all Redux slices' `error` fields via `useAppSelector`
  - When any error appears: opens global `Snackbar`
  - Maps API error codes to plain English using `src/utils/errorMessages.ts`
  - Auto-hides after 8 seconds; has "Try Again" action where applicable
- Create `src/utils/errorMessages.ts`:
  - Pure function `getErrorMessage(code: string, context?: string): string`
  - Mapping:
    - `INTERNAL_SERVER_ERROR` → *"Something went wrong on our end. Please try again."*
    - `NOT_FOUND` (simulation) → *"This draft is no longer available. It may have timed out."*
    - `CONFLICT` (merge) → *"This proposal cannot be published yet — it still has scheduling conflicts."*
    - `NOT_IMPLEMENTED` → *"This feature is not available yet. Please contact your IT department."*
    - Default → *"An unexpected error occurred. Please try again."*
- Create `src/atoms/GlobalErrorSnackbar.tsx`:
  - Single instance mounted in `App.tsx`
  - MUI `Snackbar` + `Alert` (auto-hide 8s, anchor bottom-left)
  - Uses `useGlobalErrorSnackbar` hook for state
- Create `src/atoms/EmptyState.tsx` (if not created in Task 07):
  - Generic component: `icon?: ReactNode`, `message: string`, `ctaLabel?: string`, `onCta?: () => void`
  - Centred layout, 300px max-width
- Create `src/organisms/SkeletonComponents.tsx`:
  - `SimulationCardSkeleton` — 3 lines + 2 button placeholders
  - `ProposalCardSkeleton` — 2 lines + 1 button placeholder
  - `RuleCardSkeleton` — 2 lines + 1 icon placeholder
  - `GridSkeleton` — grid of `Skeleton` cells (6 rows × 5 cols)
  - `InspectorSkeleton` — vertical list of `Skeleton` items
- Ensure all screens have proper loading/empty/error state coverage per the table in `DESIGN.md §8`:
  - S1: skeleton cards → empty state → error Alert
  - S2: `LinearProgress` at top + grid skeleton → (cannot be empty) → session expiry modal + error Snackbar
  - S3: `CircularProgress` → empty message → error Alert
  - S4: spinner chips → "No metrics configured" → dash with tooltip
  - S6: skeleton cards → empty illustration → error Alert + refresh button
  - S7: skeleton change cards → error Alert + back link
  - S8: skeleton rule cards → "No rules yet" + CTA → info Alert for 501

**Acceptance criteria:**
- No HTTP status codes, raw error codes, or stack traces shown to users
- Global error Snackbar fires for any unhandled 500 error
- 8-second auto-hide on all Snackbars
- Empty states have a clear message and actionable CTA where appropriate
- `getErrorMessage` is a pure function
- All screens have skeleton loading states

---

### Task 17 — Test Suite

**Description:** Vitest + React Testing Library tests covering core business logic, Redux slices, and key components.

**Technical details:**
- `src/store/reducers/simulationSlice.test.ts`:
  - `createSimulationThunk` transitions to correct loading/success/error states
  - Simulation IDs are persisted to localStorage on create
  - `loadSimulationsFromStorage` loads persisted IDs
- `src/store/reducers/classSlice.test.ts`:
  - `fetchClassesPage` accumulates pages in `classes[]`
  - `updateClassThunk` updates the correct class in state
- `src/store/reducers/sessionSlice.test.ts`:
  - `hasUnsavedChanges` is `true` after updateClassThunk fulfills, `false` after commitSimulation fulfills
  - `markExpired()` sets `expired: true`
- `src/store/reducers/conflictSlice.test.ts`:
  - `fetchConflictsThunk` stores conflicts; empty array = no conflicts
- `src/utils/conflictMessages.test.ts`:
  - Each conflict type maps to correct plain English string
  - No raw type codes in output strings
- `src/utils/diffParser.test.ts`:
  - Correctly parses a sample diff string into `ClassChange[]`
  - All IDs resolved to names using mock schedule
  - Returns empty array for diffs with no class changes
  - Pure function — no side effects
- `src/utils/ruleLabels.test.ts`:
  - `getConditionsByTarget('Room')` returns only room conditions
  - `getConditionsByTarget('Lecturers')` returns professor conditions
  - Labels are human-readable strings
- `src/utils/errorMessages.test.ts`:
  - Each error code maps to expected plain English message
  - Unknown codes return the default message
- `src/organisms/HUD.test.tsx`:
  - Renders conflict chip with correct count
  - Shows "No scheduling conflicts" chip when count = 0
  - No raw conflict type codes in rendered output
- `src/molecules/ConflictPopover.test.tsx`:
  - Maps `ROOM_DOUBLE_BOOK` type to correct human message
  - Maps `PROFESSOR_OVERLAP` to correct human message
  - Maps `GROUP_OVERLAP` to correct human message
- `src/pages/SimulationDashboardPage.test.tsx`:
  - Renders empty state when no simulations
  - Renders skeleton while loading
  - Renders simulation cards when loaded
  - "Create New Simulation" button opens dialog
- `src/organisms/Inspector.test.tsx`:
  - Renders class details with resolved names (not raw IDs)
  - "Apply" button triggers correct thunk dispatch sequence

**Acceptance criteria:**
- All test files co-located with their source file
- Tests use AAA pattern (Arrange, Act, Assert)
- Mocks injected via constructor/DI pattern where possible; `vi.mock` only for module-level externals
- `pnpm --filter frontend test` passes with 0 failures
- Coverage: 80%+ on Redux slices and hooks; 90%+ on pure utility functions
- No test uses raw `useDispatch` or `useSelector` — uses typed hooks

---

## Dependency Map

```
Task 01 (Scaffolding)
  └─ Task 02 (Theme)
  └─ Task 03 (Types)
       └─ Task 04 (Services)
            └─ Task 05 (Redux)
                 └─ Task 06 (App Shell)
                      ├─ Task 07 (Dashboard S1)
                      ├─ Task 08 (Grid S2)
                      │    ├─ Task 09 (Inspector S3)
                      │    ├─ Task 10 (HUD S4)
                      │    │    └─ Task 11 (Submit Modal S5)
                      │    └─ Task 15 (Session Lifecycle)
                      ├─ Task 12 (Proposals Dashboard S6)
                      │    └─ Task 13 (Diff Review S7)
                      └─ Task 14 (Rule Builder S8)
  └─ Task 16 (Global Error / Skeletons) — can start after Task 02
Task 17 (Tests) — depends on all above tasks
```

---

## Backend Gaps Summary

| Gap | Affected Screen | Frontend Mitigation |
|---|---|---|
| `DELETE /simulations/:id` (Gap 4) | S1 Delete button | Catch 404/405, show inline Alert |
| `GET /proposals?status=blocked` (Gap 2) | S6 Blocked section | Return empty array on error; hide section |
| `POST /proposals/:id/reject` (Gap 3) | S7 Close button | Catch 404/405, show "not available" Alert |
| `RulesService` 501 (Gap 1) | S8 Rule Builder | Catch 501, set `rulesSlice.unavailable`, show info Alert |

---

## Notes

- The `frontend/` directory is a separate pnpm workspace package. Backend is untouched.
- The `ui_example.html` Tailwind theme is the visual reference only — all components use MUI with the equivalent MD3 color tokens; Tailwind is NOT installed in the frontend.
- The grid uses plain CSS Grid (not MUI `Table`) to enable sticky headers in both axes efficiently.
- `date-fns` is the preferred date utility; add as a dependency in Task 07 when first needed.
- The `ProposalDetail.diff` raw field contains a standard unified diff string from `GET /proposals/:id`. The parser in Task 13 must handle both added and modified class entries.
