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

### 5. Designed for non-technical users aged 50+
Both primary user groups — scheduling department staff and professors — are likely to be 50+ years old and non-technical. The UI must never assume comfort with developer tools, abstract terminology, or small interactive targets.

Concrete requirements that flow from this:
- **Minimum font size: 16px** for all body text; 14px floor for secondary labels
- **Minimum click/touch target: 44 × 44px** for every interactive element
- **Labels on every icon** — no icon-only buttons anywhere in the application
- **Plain English everywhere** — no jargon, no IDs in user-facing copy where a name exists, no raw error codes
- **Confirmation before every destructive action** — no silent deletes or irreversible operations
- **Tooltips on non-obvious elements** — every button or field that isn't self-explanatory gets a `Tooltip` on hover
- **High contrast** — WCAG AA minimum (4.5:1 for normal text, 3:1 for large text and UI components)
- **Error messages explain what to do**, not just what went wrong (e.g. *"This class has a room conflict — click the class to see available alternatives"* not *"ROOM_DOUBLE_BOOK error"*)

---

## 3. User Roles & Personas

Since there is no authentication system, roles are toggled via a switch in the top navigation bar.

### User — Professor (Scheduling Requestor)

| Attribute | Detail |
|---|---|
| **Age / background** | Typically 50+ years old; comfortable with email and Microsoft Office but not specialist software |
| **Goal** | Make a specific timetable change (e.g. move one of their classes to a different room or time) and submit it without creating problems for anyone else |
| **Mental model** | Thinks of the timetable as a calendar or spreadsheet; has no concept of version control, branches, or pull requests |
| **Tech anxiety** | High — easily loses confidence if the UI behaves unexpectedly or shows unfamiliar terminology |
| **Key screens** | Simulation Dashboard, Timetable Grid, Inspector, HUD, Submit Proposal Modal |
| **Key anxieties** | *"Will I accidentally break the whole schedule?"* / *"I don't know what half these buttons do"* / *"What does 'conflict' mean here?"* |
| **Usage pattern** | Infrequent — may use the tool a handful of times per semester; cannot be expected to remember how it works between sessions |

**Design implications for this persona:**
- The Simulation Dashboard must make it obvious what to do first ("Create New Simulation" is the only prominent action)
- Simulation IDs like `sim-alice-a1b2c3d4` must never appear in user-facing copy — use *"Your draft from 2 hours ago"* or a user-defined name
- The Timetable Grid must show only classes relevant to the logged-in professor by default (filtered view), with an option to show all
- Every action button must carry a text label describing the outcome, not just the action (e.g. *"Save draft to branch"* not just *"Commit"*)
- Conflict messages must use real names: *"Dr. Smith is already teaching at this time"*, not `PROFESSOR_OVERLAP: PRF_SMITH`

---

### Admin — Scheduling Department Staff

| Attribute | Detail |
|---|---|
| **Age / background** | Typically 55+ years old; scheduling department veteran; expert in university processes but not in software; likely uses email, spreadsheets, and a student information system daily |
| **Goal** | Review incoming change proposals quickly, confirm they don't break anything, and publish the approved ones |
| **Mental model** | Thinks in terms of approvals and paperwork; a "proposal" is like a form on their desk waiting to be stamped |
| **Tech anxiety** | Moderate — comfortable with structured forms and lists but intimidated by anything that looks like developer output (diffs, JSON, IDs) |
| **Key screens** | Admin Proposal Dashboard, Diff Review Screen, Rule Builder |
| **Key anxieties** | *"How do I know this is safe to approve?"* / *"What exactly changed — show me in plain English"* / *"What if I approve the wrong one?"* |
| **Usage pattern** | Regular but not constant — checks for new proposals once or twice a day |

**Design implications for this persona:**
- The Admin Dashboard must feel like an inbox — a clear list with status labels, not a developer-facing Kanban board
- The Diff Review Screen must translate every change into plain prose: *"Intro to Biology (Section A) moved from Room 101 on Monday morning to Room 102 on Wednesday morning"* — the raw JSON diff is collapsed and only available on request
- The "Approve & Publish" button must be large, clearly labelled, and preceded by a confirmation step
- The Rule Builder must feel like filling in a form, not writing code — dropdowns and number fields only, no free-text rule syntax

---

### Role switching

A toggle in the top app bar labelled **"Switch to Admin View"** switches the navigation and available screens. This is a demo-mode affordance — in a production system it would be replaced by real authentication.

- Default state: **User View**
- Toggle on: **Admin View** (shows Admin Proposal Dashboard and Rule Builder in nav; hides Simulation Dashboard)
- The toggle carries a **"Demo only"** `Chip` to signal its temporary nature and prevent confusion
- When switching to Admin View, show a brief confirmation: *"You are now viewing as Admin. Changes you make here affect the published rules."*

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

### Accessibility baseline (applies to entire shell and all screens)

| Requirement | Spec |
|---|---|
| Body text size | 16px minimum |
| Secondary / label text | 14px minimum |
| Interactive target size | 44 × 44px minimum |
| Colour contrast | WCAG AA — 4.5:1 for text, 3:1 for UI components |
| Icon usage | Every icon must be accompanied by a visible text label — no standalone icons |
| Tooltips | All non-obvious controls get a `Tooltip` on hover with a plain-English description |
| Focus indicators | Visible keyboard focus ring on all interactive elements |

### Top App Bar

```
┌─────────────────────────────────────────────────────────────────────┐
│  🗓 UniSchedule      [My Simulations]   [Switch to Admin View] Demo │
└─────────────────────────────────────────────────────────────────────┘
```

| Element | Behaviour |
|---|---|
| Logo / app name | Navigates to S1 (Simulation Dashboard) |
| "My Simulations" nav link | Visible in User View; navigates to S1 |
| "Proposals" nav link | Visible in Admin View; navigates to S6 |
| "Rules" nav link | Visible in Admin View; navigates to S8 |
| "Switch to Admin View" toggle | MUI `Switch` with full text label + "Demo only" `Chip`; shows confirmation message on switch |

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
│  My Simulations                    [+ Create New Simulation]        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  PUBLISHED SCHEDULE                                                 │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  📋  Fall Semester 2026 — Current Published Schedule         │   │
│  │                                          [View Schedule]     │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  MY DRAFT SIMULATIONS                                               │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Draft from 2 hours ago                                      │   │
│  │  ✅ No scheduling conflicts · Room Utilization: 74%          │   │
│  │                               [Open Draft]  [Delete Draft]   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Draft from yesterday                                        │   │
│  │  ⚠️ 3 scheduling conflicts found · Room Utilization: 68%    │   │
│  │                               [Open Draft]  [Delete Draft]   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Key components:**

| Component | MUI | Notes |
|---|---|---|
| "Create New Simulation" button | `Button` variant="contained" size="large" | Full text label; triggers `POST /simulations`; navigates to S2 on success |
| Simulation card | `Card` + `CardContent` | Shows human-readable age ("2 hours ago"), conflict summary, key metric — **never shows raw simulation ID** |
| Conflict summary | `Typography` with ✅ / ⚠️ icon + text | Plain English: "No scheduling conflicts" or "3 scheduling conflicts found" — never the raw type code |
| "Open Draft" button | `Button` variant="contained" | Full text label; navigates to `/simulations/:id` |
| "Delete Draft" button | `Button` variant="outlined" color="error" | Full text label; opens confirmation dialog before deletion |
| Confirmation dialog | `Dialog` | *"Are you sure you want to delete this draft? This cannot be undone."* with [Cancel] and [Yes, Delete Draft] |

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
│  Your Draft Simulation          View by: [Rooms ▼]  [Save Changes] │
├──────────────┬──────────────┬──────────────┬──────────────────────┤
│              │  Monday P1   │  Monday P2   │  Tuesday P1  │  ...  │
├──────────────┼──────────────┼──────────────┼──────────────────────┤
│  Room 101    │ [BIO101 ●]  │              │              │       │
├──────────────┼──────────────┼──────────────┼──────────────────────┤
│  Room 102    │              │ [HIS201]     │              │       │
├──────────────┼──────────────┼──────────────┼──────────────────────┤
│  Room 103    │              │              │ [CHEM301 ⚠️] │       │
└──────────────┴──────────────┴──────────────┴──────────────────────┘

[Metrics & Conflicts HUD — pinned bottom bar]
```

**Grid axes:**
- **Rows:** The selected resource type (Rooms, Professors, or Student Groups)
- **Columns:** Time slots (sorted chronologically by day + start time)
- **Cells:** Class chips — one chip per `(resource, timeSlot)` intersection

**View-by selector:** A `Select` dropdown with plain labels — "View by Room", "View by Professor", "View by Student Group" — that re-renders the row axis. The underlying data does not change — only the grouping dimension. Each option has a `Tooltip` explaining what it shows.

**Class chip states:**

| State | Visual | Condition |
|---|---|---|
| Default | Filled chip, course name (truncated) | No conflict |
| Conflicted | Amber outlined chip + ⚠️ icon | This class has a scheduling conflict |
| Selected | Elevated chip with primary border | User has clicked it; Inspector is open |
| Multi-slot | Chip spans multiple columns | Class runs across multiple periods |

> **Note on conflicted state:** Use ⚠️ (amber warning) rather than 🔴 (red error) on the chip itself — red signals "broken" which may alarm users. The HUD counter uses red only when there are unresolved conflicts at submission time.

**Interaction:**
1. User clicks a class chip → Inspector panel (S3) slides in from the right; chip transitions to "Selected" state.
2. After a suggestion is applied via the Inspector, the affected chip moves to its new cell; `GET /conflicts` is called; HUD updates.
3. Clicking elsewhere on the grid (not a chip) deselects and closes the Inspector.

**Pagination:** The API returns paginated classes (`?page=&limit=`). For the grid, all classes for the current simulation should be loaded eagerly in the background (sequential page fetches) and stored in Redux. A loading skeleton is shown until the first page arrives.

**"Save Changes" button:** Labelled "Save Changes" (not "Commit Draft" — avoid developer jargon). Triggers `POST /simulations/:id/commit`. A `Tooltip` on hover reads: *"Saves your current changes to your draft so they are not lost."* See the commit-gate flow in [Section 6.5](#65-submit-proposal-modal--commit-gate).

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
| 0 | `Chip` color="success" — "✅ No scheduling conflicts" |
| > 0 | `Chip` color="error" — "⚠️ N scheduling conflict(s) — click to see details" |

**Conflict popover:** Clicking the conflict chip opens a `Popover` listing each conflict in plain English:
- "Dr. Smith is already teaching another class at this time" (PROFESSOR_OVERLAP)
- "Room 101 is booked for two classes at the same time" (ROOM_DOUBLE_BOOK)
- "Biology Year 1 students are in two classes at once" (GROUP_OVERLAP)

The technical type code (`ROOM_DOUBLE_BOOK` etc.) is **never shown to users**. Each conflict row acts as a shortcut: clicking it selects that class and opens the Inspector.

**Metric chips:** One chip per active metric rule from `rules.json`, using the rule's human-readable name (e.g. *"Room Utilization: 74%"*). If no metric rules are configured, the metric zone shows a muted label: *"No performance metrics configured yet."*

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
User clicks "Submit Proposal for Review"
        │
        ▼
┌─────────────────────────────────────┐
│  UNSAVED CHANGES                    │
│                                     │
│  You have unsaved changes in this   │
│  draft. Save them before submitting │
│  so nothing is lost.                │
│                                     │
│  [Save My Changes First]            │
│  [Submit Without Saving]            │
└─────────────────────────────────────┘
        │ (after saving or skipping)
        ▼
┌─────────────────────────────────────┐
│  Submit Proposal for Review         │
│                                     │
│  Explain your changes:              │
│  ┌─────────────────────────────┐    │
│  │ e.g. "I moved my Biology    │    │
│  │  lecture to Wednesday       │    │
│  │  because students have      │    │
│  │  back-to-back classes on    │    │
│  │  Monday mornings..."        │    │
│  └─────────────────────────────┘    │
│                                     │
│  ⚠️  Your draft has 2 scheduling   │
│  conflicts. The scheduling office  │
│  will see these and may ask you    │
│  to fix them before approving.     │
│                                     │
│   [Cancel]   [Submit for Review →] │
└─────────────────────────────────────┘
```

**Commit gate logic:**
- The frontend tracks whether any `PATCH` has been made since the last `POST /commit`
- If yes, show the unsaved-changes prompt before the proposal form
- "Save My Changes First" calls `POST /simulations/:id/commit`, then opens the proposal form
- "Submit Without Saving" skips the commit (the branch may be stale — the CI will still run against the branch's latest committed state)

**Conflict warning:**
- If the current HUD conflict count > 0, show the inline warning using plain language (no jargon, no raw conflict types)
- The user can still submit — the CI will label it BLOCKED and the Admin will not see it in the Ready queue
- The warning is informational, not blocking

**Submit action:**
1. `POST /proposals { simulationId, description }` 
2. On success: close modal, show a `Snackbar` — *"Your proposal has been submitted and is being checked for conflicts…"*
3. If CI returns `BLOCKED`: snackbar updates to *"Your proposal has scheduling conflicts — the scheduling office has been notified and will contact you"*
4. If CI returns `READY`: snackbar updates to *"Your proposal is ready for review by the scheduling office ✓"*

**Key components:**

| Component | MUI | Notes |
|---|---|---|
| Modal | `Dialog` | `maxWidth="sm"` |
| Description input | `TextField` multiline rows={4} | Required; placeholder text guides the user; validated before submit |
| Conflict warning | `Alert` severity="warning" | Plain English — no raw conflict type codes |
| Submit button | `Button` variant="contained" size="large" | Full label "Submit for Review →"; disabled while request is in-flight |
| Snackbar | `Snackbar` + `Alert` | Auto-hides after 8s (longer than default for older users); includes link to Admin view |

---

### 6.6 Admin Proposal Dashboard

**Purpose:** The Admin's overview of all incoming proposals. Visually separates `READY` proposals (awaiting merge) from `BLOCKED` proposals (CI failed).

**Layout:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  Proposals for Review                          [Refresh List 🔄]    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ✅ READY TO PUBLISH  (2)                                           │
│  Checked by the system — no scheduling conflicts found              │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Submitted by Dr. Alice Brown  ·  1 hour ago                 │   │
│  │  "Moving BIO101 to Wednesday to reduce student overlap"       │   │
│  │                                    [Review & Publish →]      │   │
│  └──────────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Submitted by Prof. Bob Chen  ·  3 hours ago                 │   │
│  │  "Room swap for HIS201 to accommodate larger group"           │   │
│  │                                    [Review & Publish →]      │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ⚠️ HAS SCHEDULING CONFLICTS  (1)                                   │
│  Cannot be published until the conflicts are fixed                  │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Submitted by Dr. Carol Davis  ·  2 hours ago                │   │
│  │  "Rescheduling CHEM301 to free up the lab on Fridays"         │   │
│  │  ⚠️ 3 scheduling conflicts detected                          │   │
│  │                                    [Review Details →]        │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Note on submitter name:** The username (`userId`) provided at simulation creation is used as the display name. The raw simulation ID (`sim-alice-a1b2c3d4`) is never shown to Admin users.

**Sections:**
- **READY TO PUBLISH** — PRs with `ci:ready` label; subtitle explains what "ready" means in plain English
- **HAS SCHEDULING CONFLICTS** — PRs with `ci:blocked` label; subtitle explains why they cannot be published (requires new backend filter — see [Section 11](#11-backend-gaps-required-for-full-ui))

**Key components:**

| Component | MUI | Notes |
|---|---|---|
| Section header | `Typography` variant="h6" + status `Chip` | Plain labels: "Ready to Publish" (green) / "Has Scheduling Conflicts" (amber) |
| Section subtitle | `Typography` variant="body2" color="text.secondary" | One sentence explaining the status in plain English |
| Proposal card | `Card` | Shows submitter name, time, first line of reasoning — not the raw simulation ID |
| "Review & Publish →" button | `Button` variant="contained" | Full label; navigates to S7 |
| "Review Details →" button | `Button` variant="outlined" | Used for BLOCKED proposals |
| Refresh button | `Button` variant="text" startIcon={RefreshIcon} | Full text label "Refresh List" — not an icon-only button |

**Empty state (all clear):** Centred illustration + *"No proposals waiting for review."*

---

### 6.7 Diff Review Screen

**Purpose:** The Admin's deep-dive into a single proposal. Presents a human-readable summary of what changed, the user's reasoning, and the CI result — with Approve and Reject actions.

**Layout:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Back to Proposals    Proposal by Dr. Alice Brown    ✅ Checked   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  REASON FOR CHANGE                                                  │
│  "Moving my Biology lecture to Wednesday reduces the back-to-back   │
│   scheduling for Year 1 Biology students on Monday mornings."       │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  WHAT WILL CHANGE  (2 classes affected)                             │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Intro to Biology — Section A                                │   │
│  │    Room:  Room 101  →  Room 102                              │   │
│  │    Time:  Monday, Period 1  →  Wednesday, Period 1           │   │
│  └──────────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Modern History — Section A                                  │   │
│  │    Lecturer:  Prof. Jones  →  Dr. Smith                      │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ⓘ System check passed — no scheduling conflicts detected.          │
│                                                                     │
│  [Show technical details ▼]   (collapsed raw diff — for IT use)    │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                [Close This Proposal]   [✅ Approve & Publish]       │
└─────────────────────────────────────────────────────────────────────┘
```

**Human-readable diff:**
The raw diff returned by `GET /proposals/:id` is a JSON diff string. The frontend must parse this into a list of changed class entries and render each as a plain English change card. Field labels use scheduling vocabulary: "Lecturer" not "professorId", "Time" not "timeSlotIds", "Room" not "roomId".

Parsing strategy:
- Diff lines starting with `-` for `"classes"` array entries → old values
- Diff lines starting with `+` for `"classes"` array entries → new values
- Pair them by `"id"` to produce "before → after" comparison rows
- Translate all IDs to their names using the schedule's master data (e.g. `PRF_SMITH` → "Dr. Jane Smith")

**CI status badge:**
- `ci:ready` → green `Chip` "✅ Checked — no conflicts"
- `ci:blocked` → amber `Chip` "⚠️ Has scheduling conflicts" + plain English conflict list below

> Note: include a small disclaimer below the status: *"This check was run when the proposal was submitted. It does not re-check against changes made to the published schedule after that date."*

**Approve action:**
1. Opens a confirmation `Dialog`: *"You are about to publish these changes to the live timetable. This will affect students and lecturers. Are you sure?"* with [Cancel] and [Yes, Publish Changes] buttons.
2. On confirm: `POST /proposals/:id/merge`
3. On success: navigate back to S6; show snackbar *"Changes published to the live timetable ✓"*
4. On error (409 — not ready): show `Alert` — *"This proposal cannot be published because it has unresolved scheduling conflicts."*

**Reject (Close) action:**
1. Button labelled **"Close This Proposal"** — avoids the word "reject" which can feel harsh
2. Opens a confirmation `Dialog`: *"Are you sure you want to close this proposal? The lecturer's draft will be kept and they can make adjustments and resubmit."*
3. Confirm buttons: [Cancel] and [Yes, Close Proposal]
4. On confirm: `POST /proposals/:id/reject` ← **requires new backend endpoint** (see [Section 11](#11-backend-gaps-required-for-full-ui))
5. On success: navigate back to S6; show snackbar *"Proposal closed. The lecturer has been notified."*

**Key components:**

| Component | MUI | Notes |
|---|---|---|
| Back navigation | `Button` startIcon={ArrowBackIcon} "Back to Proposals" | Full text label — not an icon only |
| CI status chip | `Chip` | Plain English labels — never shows raw status code |
| Change card | `Card` + field rows | Human-readable field names; names resolved from IDs |
| Technical diff | `Accordion` | Collapsed by default; labelled "Show technical details (for IT use)" |
| Close Proposal button | `Button` variant="outlined" | Full text label; opens confirmation dialog |
| Approve & Publish button | `Button` variant="contained" color="success" size="large" | Prominent; also opens confirmation dialog |

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
│  Add a New Metric                    │
│                                      │
│  Name:                               │
│  [e.g. Room Utilisation         ]    │
│                                      │
│  What to measure:                    │
│  [Rooms                        ▼]    │
│                                      │
│  How to measure it:                  │
│  [Percentage of rooms in use   ▼]    │
│                                      │
│  Target value (%):                   │
│  [80                           ]     │
│                                      │
│         [Cancel]  [Add This Metric]  │
└──────────────────────────────────────┘
```

**Supported target/condition combinations** (driven by backend's `MetricRuleTranslator`).  
Labels are human-readable — the underlying `target:condition` key is never shown to the Admin:

| "What to measure" (Target) | "How to measure it" (Condition) | Plain label shown in dropdown |
|---|---|---|
| Classes | count | Total number of classes |
| Lecturers | avg_classes_per_day | Average classes per lecturer per day |
| Lecturers | max_classes_per_day | Maximum classes any lecturer teaches in one day |
| Rooms | utilization | Percentage of rooms in use |

The "How to measure it" dropdown is filtered based on the selected "What to measure" — selecting "Classes" shows only "Total number of classes". Every option in both dropdowns has a `Tooltip` with a one-sentence plain English explanation.

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
│  ⏱ Your session has ended                │
│                                          │
│  You were away for a while and your      │
│  editing session has closed              │
│  automatically.                          │
│                                          │
│  Don't worry — any changes you saved     │
│  are still there on your draft.          │
│  Only unsaved changes from this          │
│  session were lost.                      │
│                                          │
│   [Go Back to My Simulations]            │
│   [Start a New Draft]                    │
└──────────────────────────────────────────┘
```

- This is a blocking `Dialog` (no backdrop click to dismiss)
- "Back to Dashboard" → navigates to S1
- "New Simulation" → creates a fresh simulation (the user can open the same branch manually by restoring from GitHub)

### 7.3 Inactivity Warning

To prevent surprise expiry, show a non-blocking `Alert` banner inside the simulation after **3 minutes of inactivity** (no API calls):

> *"You've been away for a while. To avoid losing any unsaved changes, save your draft now or make an edit to keep your session active."*

The banner includes a **"Save Now"** button that triggers `POST /simulations/:id/commit` and a **"Dismiss"** button. It auto-dismisses if any API call is made before the TTL elapses.

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
- Auto-dismisses after **8 seconds** (longer than default — older users need more time to read)
- Has a "Try Again" action where applicable
- All messages are in plain English — no HTTP status codes, no raw error `code` values, no stack traces

Error message examples:

| Technical error | What the user sees |
|---|---|
| `500 INTERNAL_SERVER_ERROR` | *"Something went wrong on our end. Please try again."* |
| `404 NOT_FOUND` on simulation | *"This draft is no longer available. It may have timed out."* |
| `409 CONFLICT` on merge | *"This proposal cannot be published yet — it still has scheduling conflicts."* |
| `501 NOT_IMPLEMENTED` on rules | *"This feature is not available yet. Please contact your IT department."* |

`4xx` validation errors are handled inline on the relevant screen — they are not surfaced as global snackbars.

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
