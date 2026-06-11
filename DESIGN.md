# UI Design Document — University Scheduling System

This document is the authoritative UI/UX specification for the frontend. It defines every screen, interaction model, state, and component mapping. It is written against the actual backend implementation — see [ONBOARDING.md](./ONBOARDING.md) for API details and [ONBOARDING.md#17-known-gaps--not-yet-implemented](./ONBOARDING.md#17-known-gaps--not-yet-implemented) for current backend gaps.

---

## Table of Contents

1. [Purpose & Scope](#1-purpose--scope)
2. [Design Principles](#2-design-principles)
3. [User Roles & Personas](#3-user-roles--personas)
4. [Information Architecture](#4-information-architecture)
5. [Application Shell](#5-application-shell)
6. [Screen Specifications](#6-screen-specifications)
   - [6.1 Simulation Dashboard](#61-simulation-dashboard)
   - [6.2 Timetable Grid](#62-timetable-grid)
   - [6.3 Contextual Inspector](#63-contextual-inspector)
   - [6.4 Metrics & Conflicts HUD](#64-metrics--conflicts-hud)
   - [6.5 Submit Proposal Modal & Commit Gate](#65-submit-proposal-modal--commit-gate)
   - [6.6 Admin Proposal Dashboard](#66-admin-proposal-dashboard)
   - [6.7 Diff Review Screen](#67-diff-review-screen)
   - [6.8 Rule Builder](#68-rule-builder)
7. [Session Lifecycle UX](#7-session-lifecycle-ux)
8. [Loading, Empty & Error States](#8-loading-empty--error-states)
9. [Component & State Map](#9-component--state-map)
10. [API ↔ UI Mapping](#10-api--ui-mapping)
11. [Backend Gaps Required for Full UI](#11-backend-gaps-required-for-full-ui)

---

## 1. Purpose & Scope

### What this document covers
- The complete screen inventory and navigation structure
- Interaction model for every user action
- Component breakdown mapped to MUI and Redux
- API call mapping per screen
- Session lifecycle edge cases (expiry, heartbeat, hydration latency)
- Loading, empty, and error states for every screen
- A clear list of backend work required before each screen can be fully built

### What this document does NOT cover
- Visual design (colours, typography, spacing) — MUI theme configuration is a separate concern
- Actual wireframe images — descriptions are text-based; wireframes should be created in Figma
- Backend implementation details — see [ONBOARDING.md](./ONBOARDING.md)

### Target platform
**Desktop-only.** Minimum supported viewport: **1024 × 768px**. The application is a staff tool used at desktops — no mobile or tablet layout is required.

---

## 2. Design Principles

### 1. The workspace is a command centre
The timetable grid is the heart of the application. Everything else — the inspector, the HUD, the sidebar — exists to serve it. No screen transition should feel heavy or slow during an active editing session.

### 2. Complexity is hidden, not removed
The Git-flow metaphor (branches, pull requests, merges) is powerful but unfamiliar to most university staff. The UI uses scheduling-native language: "simulation," "proposal," "publish." The underlying Git operations are never surfaced.

### 3. Feedback is immediate and honest
Every edit triggers a live conflict check. If a change creates a hard conflict, the HUD turns red before the user moves on. Users should never discover they've broken the schedule at proposal-submission time.

### 4. The Admin is a gatekeeper, not a bottleneck
The Admin's Proposal Dashboard is designed for speed: proposals are pre-labelled `READY` or `BLOCKED` by the CI pipeline, the diff is human-readable, and the merge path is one click. The Admin should never need to re-run checks manually.

---

## 3. User Roles & Personas

Since there is no authentication system, roles are toggled via a switch in the top navigation bar.

### User — Scheduling Officer

| Attribute | Detail |
|---|---|
| **Goal** | Propose a better timetable arrangement without disrupting the live schedule |
| **Mental model** | Familiar with spreadsheets and calendar apps; not a developer |
| **Key screens** | Simulation Dashboard, Timetable Grid, Inspector, HUD, Submit Proposal Modal |
| **Key anxieties** | "Will my change break something else?" / "Is my proposal going to be approved?" |

### Admin — Registry Manager

| Attribute | Detail |
|---|---|
| **Goal** | Review incoming proposals quickly and confidently; keep `main` clean |
| **Mental model** | Process-oriented; cares about data integrity and audit trail |
| **Key screens** | Admin Proposal Dashboard, Diff Review Screen, Rule Builder |
| **Key anxieties** | "How do I know this is safe to merge?" / "What exactly changed?" |

### Role switching

A toggle in the top app bar labelled **"Admin View"** switches the navigation and available screens. This is a demo-mode affordance — in a production system it would be replaced by real authentication.

- Default state: **User View**
- Toggle on: **Admin View** (shows Admin Proposal Dashboard and Rule Builder in nav; hides Simulation Dashboard)
- The toggle is visually prominent but labelled with a "Demo" chip to signal its temporary nature

---

## 4. Information Architecture

### Screen Inventory

| ID | Screen | Role | Route |
|---|---|---|---|
| S1 | Simulation Dashboard | User | `/` |
| S2 | Timetable Grid | User | `/simulations/:id` |
| S3 | Contextual Inspector | User | Slide-in panel within S2 |
| S4 | Metrics & Conflicts HUD | User | Persistent bar within S2 |
| S5 | Submit Proposal Modal | User | Modal within S2 |
| S6 | Admin Proposal Dashboard | Admin | `/admin/proposals` |
| S7 | Diff Review Screen | Admin | `/admin/proposals/:id` |
| S8 | Rule Builder | Admin | `/admin/rules` |

### Navigation Map

```
App Shell (Top Bar)
├── [User View]
│   └── "My Simulations"  →  S1: Simulation Dashboard
│       └── Click simulation  →  S2: Timetable Grid
│           ├── Click class  →  S3: Contextual Inspector (slide-in)
│           ├── Persistent   →  S4: Metrics & Conflicts HUD (bottom bar)
│           └── "Submit Proposal"  →  S5: Submit Proposal Modal
│
└── [Admin View]  (toggled via top-bar switch)
    ├── "Proposals"  →  S6: Admin Proposal Dashboard
    │   └── Click proposal  →  S7: Diff Review Screen
    └── "Rules"  →  S8: Rule Builder
```

---

## 5. Application Shell

The shell is the persistent frame that wraps every screen. It has two zones: the **top app bar** and the **main content area**. The Metrics & Conflicts HUD (S4) is a third persistent zone that appears only when inside a simulation session (S2).

### Top App Bar

```
┌─────────────────────────────────────────────────────────────────────┐
│  🗓 UniSchedule          [My Simulations]        [ Admin View 🔵 ] │
└─────────────────────────────────────────────────────────────────────┘
```

| Element | Behaviour |
|---|---|
| Logo / app name | Navigates to S1 (Simulation Dashboard) |
| "My Simulations" nav link | Visible in User View; navigates to S1 |
| "Proposals" nav link | Visible in Admin View; navigates to S6 |
| "Rules" nav link | Visible in Admin View; navigates to S8 |
| Admin View toggle | MUI `Switch` with label; switches nav context |

### Main Content Area

Full-height below the app bar. Each screen fills this area.

### Metrics & Conflicts HUD (Persistent bottom bar in simulation)

Visible only on route `/simulations/:id`. Pinned to the bottom of the viewport above any scrollable content. See [Section 6.4](#64-metrics--conflicts-hud) for full specification.

---

## 6. Screen Specifications

---

### 6.1 Simulation Dashboard

**Purpose:** Entry point for Users. Lets them see the official schedule, their draft simulations, and start a new simulation.

**Layout:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  My Simulations                          [+ New Simulation]         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  MAIN SCHEDULE                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  📋  Fall Semester 2026 — Official Schedule      [View]      │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  MY SIMULATIONS                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  sim-alice-a1b2c3d4   Created 2h ago         [Open] [Delete] │   │
│  │  ○ 0 conflicts · Room Utilization: 74%                       │   │
│  └──────────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  sim-alice-f9e8d7c6   Created yesterday       [Open] [Delete] │   │
│  │  🔴 3 conflicts · Room Utilization: 68%                      │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Key components:**

| Component | MUI | Notes |
|---|---|---|
| "New Simulation" button | `Button` variant="contained" | Triggers `POST /simulations`; navigates to S2 on success |
| Simulation card | `Card` + `CardContent` | Shows ID (truncated), age, conflict count, key metric |
| Conflict count chip | `Chip` color="error" / color="success" | Red if > 0, green if 0 |
| "Open" button | `Button` variant="outlined" | Navigates to `/simulations/:id` — triggers heartbeat + re-hydration check |
| "Delete" button | `IconButton` with confirm dialog | Not currently in the API — see [Section 11](#11-backend-gaps-required-for-full-ui) |

**User flow:**
1. User lands on dashboard. Existing simulations are listed (stored in Redux from previous sessions via `localStorage` of simulation IDs).
2. User clicks **"+ New Simulation"** → loading state → `POST /simulations { userId }` → on success navigate to S2.
3. User clicks **"Open"** on an existing simulation → navigate to S2 with the stored `simulationId` (the session must still be active; if expired, an error banner guides the user to create a new one).

**Empty state:** No simulations yet — show a centred illustration with the message *"You haven't started any simulations yet."* and a large **"Create your first simulation"** button.

---

### 6.2 Timetable Grid

**Purpose:** The core editing workspace. Displays the schedule as a grid and lets users interact with individual classes.

**Layout:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  sim-alice-a1b2c3d4          View by: [Rooms ▼]    [Commit Draft]  │
├──────────────┬──────────────┬──────────────┬──────────────────────┤
│              │  Monday P1   │  Monday P2   │  Tuesday P1  │  ...  │
├──────────────┼──────────────┼──────────────┼──────────────────────┤
│  Room 101    │ [BIO101 ●]  │              │              │       │
├──────────────┼──────────────┼──────────────┼──────────────────────┤
│  Room 102    │              │ [HIS201]     │              │       │
├──────────────┼──────────────┼──────────────┼──────────────────────┤
│  Room 103    │              │              │ [CHEM301 🔴] │       │
└──────────────┴──────────────┴──────────────┴──────────────────────┘

[Metrics & Conflicts HUD — pinned bottom bar]
```

**Grid axes:**
- **Rows:** The selected resource type (Rooms, Professors, or Student Groups)
- **Columns:** Time slots (sorted chronologically by day + start time)
- **Cells:** Class chips — one chip per `(resource, timeSlot)` intersection

**View-by selector:** A `Select` dropdown (Rooms / Professors / Student Groups) that re-renders the row axis. The underlying data does not change — only the grouping dimension.

**Class chip states:**

| State | Visual | Condition |
|---|---|---|
| Default | Filled chip, course code + title (truncated) | No conflict |
| Conflicted | Red outlined chip + 🔴 icon | This class appears in the current conflicts list |
| Selected | Elevated chip with primary border | User has clicked it; Inspector is open |
| Multi-slot | Chip spans multiple columns | Class has 2+ `timeSlotIds` |

**Interaction:**
1. User clicks a class chip → Inspector panel (S3) slides in from the right; chip transitions to "Selected" state.
2. After a suggestion is applied via the Inspector, the affected chip moves to its new cell; `GET /conflicts` is called; HUD updates.
3. Clicking elsewhere on the grid (not a chip) deselects and closes the Inspector.

**Pagination:** The API returns paginated classes (`?page=&limit=`). For the grid, all classes for the current simulation should be loaded eagerly in the background (sequential page fetches) and stored in Redux. A loading skeleton is shown until the first page arrives.

**"Commit Draft" button:** Triggers `POST /simulations/:id/commit` — saves the current Memgraph state back to the GitHub branch. Visually indicated as a save action, not a publish. See the commit-gate flow in [Section 6.5](#65-submit-proposal-modal--commit-gate).

---

### 6.3 Contextual Inspector

**Purpose:** A slide-in side panel that opens when a class is selected. Shows class details, smart suggestions from the API, and the metric impact of each suggestion.

**Layout (right side panel, ~380px wide):**

```
┌──────────────────────────────────────┐
│  ✕  BIO101 — Intro to Biology        │
│     Section A                        │
├──────────────────────────────────────┤
│  CURRENT ASSIGNMENT                  │
│  Professor:  Dr. Jane Smith          │
│  Room:       Room 101 (50 seats)     │
│  Time:       Monday Period 1         │
│              Monday Period 2         │
├──────────────────────────────────────┤
│  SMART SUGGESTIONS                   │
│  ┌────────────────────────────────┐  │
│  │  Room 102 · Wednesday P1  ✓   │  │
│  │  Room Util: 74% → 71% (-3%)   │  │
│  │                  [Apply]       │  │
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │  Room 103 · Tuesday P1    ✓   │  │
│  │  Room Util: 74% → 72% (-2%)   │  │
│  │                  [Apply]       │  │
│  └────────────────────────────────┘  │
│                                      │
│  (No conflicts in any suggestion)    │
└──────────────────────────────────────┘
```

**Data sources:**
- Class details: from Redux store (already loaded by the grid)
- Suggestions: `GET /simulations/:id/classes/:classId/suggestions`
- Metric impact: computed client-side by comparing current metric values (in Redux) against what they would be if this suggestion were applied — or fetched post-apply as a diff

**Metric delta display:**
Since the API does not provide a "what-if" metric preview, the metric impact shown in the Inspector is computed *after* the suggestion is applied: the UI applies the change, calls `GET /metrics`, and shows the before/after delta. Until that call completes, a loading spinner replaces the metric row. If the user clicks "Apply":

1. `PATCH /simulations/:id/classes/:classId` → class updated in graph
2. `GET /simulations/:id/conflicts` → HUD refreshes (live update)
3. `GET /simulations/:id/metrics` → Inspector metric delta updates

**No suggestions state:** If `GET /suggestions` returns an empty array, show: *"No conflict-free slots available for this class. Try moving a conflicting class first."*

**Key components:**

| Component | MUI | Notes |
|---|---|---|
| Panel container | `Drawer` variant="persistent" anchor="right" | Slides in/out; does not push grid content |
| Close button | `IconButton` | Deselects class, closes panel |
| Current assignment | `List` + `ListItem` | Read-only display |
| Suggestion card | `Card` | One per suggestion; includes room, time, metric delta |
| Apply button | `Button` variant="contained" size="small" | Triggers PATCH + conflict re-check |
| Metric delta chip | `Chip` color="success"/"error" | Green for improvement, red for regression |

---

### 6.4 Metrics & Conflicts HUD

**Purpose:** A persistent bottom bar visible throughout the simulation session. Gives the user an at-a-glance health status of their simulation at all times.

**Layout:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  Hard Conflicts: 🔴 2   │  Room Utilization: 74%  │  Avg Classes/  │
│                         │                         │  Prof/Day: 3.2 │
└─────────────────────────────────────────────────────────────────────┘
```

**Conflict counter states:**

| Value | Visual |
|---|---|
| 0 | `Chip` color="success" — "✓ No conflicts" |
| > 0 | `Chip` color="error" — "🔴 N conflict(s)" — clicking expands a popover listing all conflicts |

**Conflict popover:** Clicking the conflict chip opens a `Popover` listing each conflict:
- Type icon (room / professor / group)
- Affected class IDs + human-readable message
- Each row is a shortcut: clicking it selects that class and opens the Inspector

**Metric chips:** One chip per active metric rule from `rules.json`. If no metric rules are configured, the metric zone shows *"No metrics configured — set them up in Admin → Rules."*

**Live update behaviour:**
- `GET /conflicts` is dispatched after every successful `PATCH` (class update)
- `GET /metrics` is dispatched after every successful `PATCH`
- Both calls are debounced by 300ms to prevent redundant requests if the user edits rapidly
- While either call is in-flight, the relevant chip shows a `CircularProgress` spinner

---

### 6.5 Submit Proposal Modal & Commit Gate

**Purpose:** The transition from editing to proposing. The user documents their intent and submits their simulation for Admin review.

**Flow:**

```
User clicks "Submit Proposal"
        │
        ▼
┌─────────────────────────────────────┐
│  COMMIT GATE (if unsaved changes)   │
│                                     │
│  "Save your changes to your branch  │
│   before submitting."               │
│                                     │
│   [Save Draft]  [Submit Anyway]     │
└─────────────────────────────────────┘
        │ (after save or skip)
        ▼
┌─────────────────────────────────────┐
│  Submit Proposal                    │
│                                     │
│  Describe your changes:             │
│  ┌─────────────────────────────┐    │
│  │ Text area (required)        │    │
│  │ e.g. "Moving BIO101 to      │    │
│  │  Wednesday reduces overlap  │    │
│  │  for Year 1 students..."    │    │
│  └─────────────────────────────┘    │
│                                     │
│  ⚠️  2 hard conflicts detected.     │
│  Your proposal will be marked       │
│  BLOCKED until they are resolved.   │
│                                     │
│          [Cancel]  [Submit →]       │
└─────────────────────────────────────┘
```

**Commit gate logic:**
- The frontend tracks whether any `PATCH` has been made since the last `POST /commit`
- If yes, show the commit gate prompt before the proposal form
- "Save Draft" calls `POST /simulations/:id/commit`, then opens the proposal form
- "Submit Anyway" skips the commit (the branch may be stale — the CI will still run against the branch's latest committed state)

**Conflict warning:**
- If the current HUD conflict count > 0, show the inline warning inside the modal
- The user can still submit — the CI will label it `BLOCKED` and the Admin will not see it in the Ready queue
- The warning is informational, not blocking

**Submit action:**
1. `POST /proposals { simulationId, description }` 
2. On success: close modal, show a `Snackbar` — *"Proposal #42 submitted — CI is running…"*
3. If CI returns `BLOCKED`: snackbar updates to *"Proposal #42 is BLOCKED — fix conflicts and resubmit"*
4. If CI returns `READY`: snackbar updates to *"Proposal #42 is READY for Admin review ✓"*

**Key components:**

| Component | MUI | Notes |
|---|---|---|
| Modal | `Dialog` | `maxWidth="sm"` |
| Description input | `TextField` multiline rows={4} | Required; validated before submit |
| Conflict warning | `Alert` severity="warning" | Shown if HUD conflicts > 0 |
| Submit button | `Button` variant="contained" | Disabled while `POST /proposals` is in-flight |
| Snackbar | `Snackbar` + `Alert` | Auto-hides after 6s; includes link to Admin view |

---

### 6.6 Admin Proposal Dashboard

**Purpose:** The Admin's overview of all incoming proposals. Visually separates `READY` proposals (awaiting merge) from `BLOCKED` proposals (CI failed).

**Layout:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  Proposals                                            [Refresh 🔄]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ✅ READY TO MERGE  (2)                                             │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  #42  sim-alice-a1b2c3d4    Submitted 1h ago    [Review →]   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  #38  sim-bob-c9d8e7f6      Submitted 3h ago    [Review →]   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  🔴 BLOCKED — CI FAILED  (1)                                        │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  #39  sim-carol-b1c2d3e4    Submitted 2h ago    [Review →]   │   │
│  │  ⚠️  3 conflicts detected                                    │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Data source:** `GET /proposals` — returns only open PRs labelled `ci:ready`. For the `BLOCKED` section, a separate `GET /proposals` with a filter is needed — **this requires a backend change** (see [Section 11](#11-backend-gaps-required-for-full-ui)).

**Sections:**
- **READY TO MERGE** — PRs with `ci:ready` label (currently supported by the API)
- **BLOCKED** — PRs with `ci:blocked` label (requires new `GET /proposals?status=blocked` query parameter)

**Key components:**

| Component | MUI | Notes |
|---|---|---|
| Section header | `Typography` variant="h6" + status `Chip` | READY = green, BLOCKED = red |
| Proposal card | `Card` | Shows PR number, simulation ID, submitted time |
| "Review →" button | `Button` | Navigates to S7 |
| Refresh button | `IconButton` | Re-fetches proposals list |
| BLOCKED conflict count | `Chip` color="error" | Shown only on BLOCKED cards |

**Empty state (all clear):** Centred illustration + *"No proposals waiting for review."*

---

### 6.7 Diff Review Screen

**Purpose:** The Admin's deep-dive into a single proposal. Presents a human-readable summary of what changed, the user's reasoning, and the CI result — with Approve and Reject actions.

**Layout:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Proposals    Proposal #42 — sim-alice-a1b2c3d4    ✅ CI: READY  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  USER'S REASONING                                                   │
│  "Moving BIO101 to Wednesday reduces overlap for Year 1 students   │
│   who have back-to-back classes on Monday mornings."               │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  CHANGES  (3 classes modified)                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  CLS_00001 · Intro to Biology - Section A                    │   │
│  │    Room:   Room 101 → Room 102                               │   │
│  │    Time:   Monday P1 → Wednesday P1                          │   │
│  └──────────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  CLS_00002 · Modern History - Section A                      │   │
│  │    Professor: Prof. Jones → Dr. Smith                        │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  RAW GIT DIFF  [Expand ▼]                                           │
│  (collapsed by default — shows raw JSON diff from GitHub)          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│              [🚫 Reject]                    [✅ Approve & Merge]    │
└─────────────────────────────────────────────────────────────────────┘
```

**Human-readable diff:**
The raw diff returned by `GET /proposals/:id` is a JSON diff string. The frontend must parse this into a list of changed class entries and render each as a readable change card (Old value → New value). This parsing logic lives in a pure utility function in `utils/`.

Parsing strategy:
- Diff lines starting with `-` for `"classes"` array entries → old values
- Diff lines starting with `+` for `"classes"` array entries → new values
- Pair them by `"id"` to produce "before → after" comparison rows

**CI status badge:**
- `ci:ready` → green `Chip` "✅ CI: READY"
- `ci:blocked` → red `Chip` "🔴 CI: BLOCKED" + count of conflicts below

**Approve action:**
1. `POST /proposals/:id/merge`
2. On success: navigate back to S6; show snackbar *"Proposal #42 merged into main ✓"*
3. On error (409 — not ready): show `Alert` — *"This proposal cannot be merged until CI passes."*

**Reject action:**
1. Show a confirmation `Dialog`: *"Are you sure? The branch will be kept but the proposal will be closed."*
2. On confirm: `POST /proposals/:id/reject` ← **requires new backend endpoint** (see [Section 11](#11-backend-gaps-required-for-full-ui))
3. On success: navigate back to S6; show snackbar *"Proposal #42 closed."*

**Key components:**

| Component | MUI | Notes |
|---|---|---|
| Back navigation | `Breadcrumbs` + `Button` | "← Proposals" |
| CI status chip | `Chip` | Color driven by proposal status |
| Change card | `Card` + `Table` | One row per changed field; Old → New |
| Raw diff | `Accordion` | Collapsed by default; uses monospace `Typography` |
| Reject button | `Button` variant="outlined" color="error" | Opens confirmation dialog |
| Approve button | `Button` variant="contained" color="success" | Calls merge endpoint |

---

### 6.8 Rule Builder

**Purpose:** Admin configuration screen for creating and deleting metric rules and hard constraints that are stored in `rules.json` on `main`.

> ⚠️ **This screen depends entirely on the `RulesService` backend implementation, which currently returns `501 Not Implemented` for all endpoints.** The UI can be built but will not function until the backend is completed. See [Section 11](#11-backend-gaps-required-for-full-ui).

**Layout:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  Rules Configuration                                                │
├──────────────────────────────┬──────────────────────────────────────┤
│  METRIC RULES                │  HARD CONSTRAINTS                    │
│                              │                                      │
│  [+ Add Metric]              │  [+ Add Constraint]                  │
│                              │                                      │
│  ┌──────────────────────┐    │  (Constraints section — same         │
│  │  Room Utilization    │    │   layout pattern as metrics)         │
│  │  Room · utilization  │    │                                      │
│  │  Threshold: 80%      │    │                                      │
│  │              [🗑]    │    │                                      │
│  └──────────────────────┘    │                                      │
│  ┌──────────────────────┐    │                                      │
│  │  Avg Load per Prof   │    │                                      │
│  │  Professor ·         │    │                                      │
│  │  avg_classes_per_day │    │                                      │
│  │  Threshold: 4        │    │                                      │
│  │              [🗑]    │    │                                      │
│  └──────────────────────┘    │                                      │
└──────────────────────────────┴──────────────────────────────────────┘
```

**"Add Metric" form (inline or modal):**

```
┌──────────────────────────────────────┐
│  Add Metric Rule                     │
│                                      │
│  Name:      [___________________]    │
│  Target:    [Class          ▼]       │
│  Condition: [count          ▼]       │
│  Threshold: [___]                    │
│                                      │
│             [Cancel]  [Add Rule]     │
└──────────────────────────────────────┘
```

**Supported target/condition combinations** (driven by backend's `MetricRuleTranslator`):

| Target | Available Conditions |
|---|---|
| `Class` | `count` |
| `Professor` | `avg_classes_per_day`, `max_classes_per_day` |
| `Room` | `utilization` |

The `Condition` dropdown is populated dynamically based on the selected `Target` — selecting "Class" shows only "count"; selecting "Professor" shows both professor conditions.

**Delete action:**
1. Click trash icon → confirm `Dialog`
2. `DELETE /rules/metrics/:metricId`
3. On success: remove card from list; show snackbar

**Key components:**

| Component | MUI | Notes |
|---|---|---|
| Two-column layout | `Grid` container | Metrics left, Constraints right |
| Rule card | `Card` | Name, target, condition, threshold, delete icon |
| Add button | `Button` variant="outlined" | Opens `Dialog` with the rule builder form |
| Target select | `Select` | Drives available condition options |
| Condition select | `Select` | Options filtered by selected target |
| Threshold input | `TextField` type="number" | Min 0; validated before submit |

---

## 7. Session Lifecycle UX

Sessions are ephemeral — a simulation's Memgraph data has a **5-minute TTL** and is garbage-collected if not kept alive. The frontend must handle this transparently.

### 7.1 Heartbeat

While a user is on the Timetable Grid (`/simulations/:id`):
- A background `setInterval` runs every **60 seconds** and calls `POST /simulations/:id/heartbeat`
- If the heartbeat returns `200 OK` → session is alive, no UI change
- If the heartbeat returns `404` → session has expired; show the expiry modal (see below)
- The interval is cleared when the user navigates away from the simulation route

### 7.2 Session Expiry Modal

If the heartbeat (or any simulation API call) returns `404 NOT_FOUND`:

```
┌──────────────────────────────────────────┐
│  ⏱ Session Expired                       │
│                                          │
│  Your editing session has timed out.     │
│  Your last committed changes are saved   │
│  on your branch.                         │
│                                          │
│  Uncommitted edits in this session       │
│  have been lost.                         │
│                                          │
│    [Back to Dashboard]  [New Simulation] │
└──────────────────────────────────────────┘
```

- This is a blocking `Dialog` (no backdrop click to dismiss)
- "Back to Dashboard" → navigates to S1
- "New Simulation" → creates a fresh simulation (the user can open the same branch manually by restoring from GitHub)

### 7.3 Inactivity Warning

To prevent surprise expiry, show a non-blocking `Alert` banner inside the simulation after **3 minutes of inactivity** (no API calls):

> *"Your session will expire in 2 minutes. Make an edit or save your draft to keep it alive."*

The banner auto-dismisses if any API call is made before the TTL elapses.

### 7.4 Hydration Latency

When a simulation is first created:
- The `POST /simulations` call may take several seconds for large schedules (hydration of 30,000+ nodes)
- Show a full-screen loading state with a `LinearProgress` bar and the message *"Creating your simulation — loading schedule into memory…"*
- The Simulation Dashboard card shows a "Creating…" skeleton until the response resolves

---

## 8. Loading, Empty & Error States

### Per-screen summary

| Screen | Loading | Empty | Error |
|---|---|---|---|
| S1 Simulation Dashboard | Skeleton cards | "No simulations yet" + CTA | Error `Alert` — "Could not load simulations" |
| S2 Timetable Grid | Skeleton grid cells; `LinearProgress` at top | Cannot be empty (classes always exist after hydration) | Session expired modal; API error snackbar |
| S3 Inspector | `CircularProgress` in suggestions list | "No conflict-free slots available" message | "Could not load suggestions" inline `Alert` |
| S4 HUD | `CircularProgress` inside chips | "No metrics configured" placeholder | Conflict chip shows "—" with tooltip |
| S5 Submit Modal | Button loading state during submit | N/A | Inline `Alert` inside modal |
| S6 Admin Dashboard | Skeleton proposal cards | "No proposals waiting" illustration | Error `Alert` with refresh button |
| S7 Diff Review | Skeleton change cards | N/A (navigated to from a known proposal) | "Could not load proposal" + back link |
| S8 Rule Builder | Skeleton rule cards | "No rules configured yet" + CTA | `Alert` "Rules service unavailable (501)" |

### Global error handling

Network errors and unexpected `5xx` responses surface as a `Snackbar` at the bottom of the screen:
- Auto-dismisses after 6 seconds
- Has a "Retry" action where applicable

`4xx` errors (validation failures, not-found, conflicts) are handled inline on the relevant screen — they are not surfaced as global snackbars.

---

## 9. Component & State Map

### Redux Slices

| Slice | State it holds | Screens that consume it |
|---|---|---|
| `simulationSlice` | `{ simulations: Simulation[], current: Simulation \| null, loading, error }` | S1, S2 |
| `classSlice` | `{ classes: ScheduleClass[], total, page, loading }` | S2, S3 |
| `conflictSlice` | `{ conflicts: Conflict[], loading }` | S2 (HUD), S3 (chip colour) |
| `metricSlice` | `{ metrics: MetricResult[], loading }` | S4 (HUD) |
| `proposalSlice` | `{ proposals: Proposal[], current: ProposalDetail \| null, loading }` | S5, S6, S7 |
| `rulesSlice` | `{ metrics: MetricRule[], constraints: Constraint[], loading }` | S8 |
| `sessionSlice` | `{ simulationId: string \| null, lastBeat: number, expired: boolean }` | S2 (heartbeat timer), expiry modal |
| `uiSlice` | `{ selectedClassId: string \| null, inspectorOpen: boolean, role: 'user' \| 'admin' }` | App shell, S2, S3 |

### Key MUI Components by screen

| Screen | Primary MUI components |
|---|---|
| S1 | `Card`, `CardContent`, `CardActions`, `Button`, `Chip`, `Skeleton` |
| S2 | `TableContainer`, `Table`, `TableHead`, `TableRow`, `TableCell`, `Chip`, `Select`, `LinearProgress` |
| S3 | `Drawer` (persistent), `List`, `ListItem`, `Card`, `Chip`, `CircularProgress` |
| S4 | `AppBar` (bottom), `Chip`, `Popover`, `List`, `CircularProgress` |
| S5 | `Dialog`, `TextField`, `Alert`, `Button`, `CircularProgress` |
| S6 | `Card`, `Chip`, `Divider`, `Typography`, `IconButton`, `Skeleton` |
| S7 | `Breadcrumbs`, `Chip`, `Card`, `Table`, `Accordion`, `Dialog`, `Button` |
| S8 | `Grid`, `Card`, `Dialog`, `Select`, `TextField`, `IconButton`, `Snackbar` |

---

## 10. API ↔ UI Mapping

| Method | Endpoint | Screen(s) | Trigger | Status |
|---|---|---|---|---|
| `POST` | `/simulations` | S1 | "New Simulation" button | ✅ |
| `POST` | `/simulations/:id/heartbeat` | S2 | Background 60s interval | ✅ |
| `POST` | `/simulations/:id/commit` | S2 | "Commit Draft" button; commit gate in S5 | ✅ |
| `GET` | `/simulations/:id/classes` | S2 | On navigation to S2; paginated background load | ✅ |
| `PATCH` | `/simulations/:id/classes/:classId` | S3 | "Apply" button on suggestion | ✅ |
| `GET` | `/simulations/:id/classes/:classId/suggestions` | S3 | On class selection | ✅ |
| `GET` | `/simulations/:id/conflicts` | S4 | After every PATCH; on page load | ✅ |
| `GET` | `/simulations/:id/metrics` | S4, S3 | After every PATCH; on page load | ✅ |
| `POST` | `/proposals` | S5 | "Submit →" button | ✅ |
| `GET` | `/proposals` | S6 | On page load; refresh button | ✅ (READY only) |
| `GET` | `/proposals/:id` | S7 | On navigation to S7 | ✅ |
| `POST` | `/proposals/:id/merge` | S7 | "Approve & Merge" button | ✅ |
| `GET` | `/rules/metrics` | S8 | On page load | ⚠️ 501 |
| `POST` | `/rules/metrics` | S8 | "Add Rule" form submit | ⚠️ 501 |
| `DELETE` | `/rules/metrics/:id` | S8 | Delete icon | ⚠️ 501 |
| `GET` | `/rules/constraints` | S8 | On page load | ⚠️ 501 |
| `POST` | `/rules/constraints` | S8 | "Add Constraint" form submit | ⚠️ 501 |
| `DELETE` | `/rules/constraints/:id` | S8 | Delete icon | ⚠️ 501 |
| `GET` | `/proposals?status=blocked` | S6 | On page load (BLOCKED section) | ❌ Missing |
| `POST` | `/proposals/:id/reject` | S7 | "Reject" button | ❌ Missing |
| `DELETE` | `/simulations/:id` | S1 | "Delete" button on simulation card | ❌ Missing |

---

## 11. Backend Gaps Required for Full UI

The following backend work must be completed before the affected screens can be fully functional.

### Gap 1 — `RulesService` (blocks S8: Rule Builder entirely)

**All 6 methods in `RulesService.ts` throw `501 Not Implemented`.**

Required endpoints to implement:
- `GET /rules/metrics` — read `rules.json` from `main` and return the `metrics` array
- `POST /rules/metrics` — append a new metric rule to `rules.json` on `main`
- `DELETE /rules/metrics/:metricId` — remove a metric rule from `rules.json` on `main`
- `GET /rules/constraints` — read the `constraints` array from `rules.json`
- `POST /rules/constraints` — append a new constraint
- `DELETE /rules/constraints/:constraintId` — remove a constraint

All read/write operations go through `GitHubService.readFile` / `writeFile` on the `main` branch.

**UI impact:** The Rule Builder screen (S8) can be built with mock data, but all interactions will fail until this is implemented.

---

### Gap 2 — `GET /proposals?status=blocked` (blocks BLOCKED section of S6)

**Current `GET /proposals` only returns PRs labelled `ci:ready`.**

Required change: accept a `?status=` query parameter (`ready` | `blocked` | `all`) so the Admin Dashboard can display the BLOCKED section.

**UI impact:** The BLOCKED proposals section on S6 cannot be populated.

---

### Gap 3 — `POST /proposals/:id/reject` (blocks Reject button on S7)

**No reject endpoint exists.** The agreed behaviour is to close the GitHub PR (soft reject — the simulation branch is kept).

Required new endpoint:
- `POST /proposals/:id/reject`
- Calls `octokit.rest.pulls.update({ state: 'closed' })` on the PR
- Returns the updated proposal with `status: 'REJECTED'`

**UI impact:** The "Reject" button on S7 (Diff Review Screen) cannot function.

---

### Gap 4 — `DELETE /simulations/:id` (blocks Delete button on S1)

**No endpoint exists to delete a simulation.** Clean-up requires both deleting the GitHub branch and flushing the Memgraph session.

Required new endpoint:
- `DELETE /simulations/:id`
- Calls `graph.flush(simulationId)` then `github.deleteBranch(simulationId)`
- Removes the session from the registry

**UI impact:** The "Delete" button on simulation cards in S1 cannot function.

---

### Gap 5 — CI pipeline does not check merged state (affects S7)

As documented in [ONBOARDING.md Section 9](./ONBOARDING.md#9-ci-pipeline), the CI checks the simulation branch in isolation rather than the merged result. This means the "CI: READY" badge on S7 may not reflect the true post-merge state.

**UI impact:** No blocking UI issue, but the Admin should be aware. The Diff Review Screen (S7) should include a small disclaimer: *"CI was run on the simulation branch at submission time. Re-running CI against the current main is not yet supported."*

---

*Last updated: June 2026 — reflects backend as of initial backend milestone and agreed UI design decisions.*
