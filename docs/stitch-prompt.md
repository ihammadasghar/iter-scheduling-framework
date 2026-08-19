# Google Stitch UI Generation Prompt
## UniSchedule — University Scheduling System Web Application

---

## OVERVIEW

Build a desktop web application prototype called **UniSchedule** — a university timetable change-management tool. Think of it as "Google Docs Track Changes" applied to academic scheduling: university staff and professors can propose timetable edits in a private sandbox ("draft"), check for scheduling conflicts, then submit them for an administrator to review and publish to the live timetable.

The visual language should feel like a **professional, calm administrative tool** — not a developer dashboard. Closer to a polished internal HR or university portal (think Workday or a modern student information system). The aesthetic should be clean, spacious, and trustworthy. Users are primarily 50+ year old non-technical staff — the design must be generous, legible, and anxiety-free.

---

## DESIGN SYSTEM & VISUAL STYLE

### Colour Palette
- **Primary action:** Deep blue `#1565C0`
- **Secondary/accent:** Teal `#00695C`
- **Page background:** Off-white `#F8F9FA`
- **Card surface:** Pure white `#FFFFFF`
- **App bar/nav:** White with a 1px bottom border `#E0E0E0`
- **Success state:** Green `#2E7D32`
- **Warning state:** Amber `#E65100`
- **Error state:** Red `#C62828` (used sparingly)
- **Text primary:** `#212121` · **Text secondary:** `#616161`
- **Dividers / borders:** `#E0E0E0`
- **Status left-border on cards:** 4px — green for no-conflict, amber for conflicted

### Typography
- **Font:** Inter or Roboto
- **Body text minimum: 16px** — non-negotiable; users are 50+ and accessibility is required
- **Secondary/label text minimum:** 14px
- **Section labels:** 13px, all-caps, letter-spaced, `#616161`
- **Card titles:** 16–18px semi-bold
- **Page titles:** 22–24px bold

### Components & Spacing
- Material Design 3 / MUI component aesthetic
- Card border-radius: 8px · chip border-radius: 16px · button border-radius: 6px
- Cards: `box-shadow: 0 1px 4px rgba(0,0,0,0.12)`, 16–20px internal padding
- Section spacing: 24–32px between sections
- **Every interactive element: minimum 44×44px click target**
- **Every button carries a visible text label — no icon-only buttons anywhere**

---

## APPLICATION SHELL

The shell wraps every screen.

### Top App Bar
Full-width, white background, 1px bottom border, 64px tall.

```
│ 🗓 UniSchedule │  My Simulations  │ ─────────────────────── │ Switch to Admin View ○ │ DEMO │
  Logo (blue)      Nav link (User)                               MUI Switch + text label   Chip
```

- **Logo:** Calendar emoji + "UniSchedule" in 20px bold primary blue
- **User View nav:** "My Simulations" link only
- **Admin View nav:** "Proposals" link + "Rules" link (User nav hidden)
- **Role switch:** A labelled MUI Switch — label "Switch to Admin View" to its left, a small grey "DEMO ONLY" pill chip to its right
- When switching to Admin View: a 4-second amber `Alert` banner below the app bar reads *"You are now viewing as Admin. Changes you make here affect the published rules."*

---

## SCREEN 1 — Simulation Dashboard (User Home)
**Route:** `/`

**Layout:** Single-column, centred, max-width 900px

### Page Header (top of content area)
- Left: "My Simulations" — 24px bold
- Right: "＋ Create New Simulation" — large primary contained button with plus icon

### Card — Published Schedule
Section label: `PUBLISHED SCHEDULE` (small caps, grey, 13px)

A full-width card containing:
- Left: Large calendar icon (40px, blue) + "Fall Semester 2026 — Current Published Schedule" (18px bold) + "The official timetable currently in use" (14px grey)
- Right: "View Schedule" — outlined medium button

### Cards — Draft Simulations
Section label: `MY DRAFT SIMULATIONS` (small caps, grey, 13px)

**Card A (no conflicts) — green left border:**
- Title: "Draft from 2 hours ago" (18px semi-bold)
- Status row: ✅ green "No scheduling conflicts" · `·` separator · "Room Utilisation: 74%"
- Buttons (right-aligned): "Open Draft" (primary contained) + "Delete Draft" (outlined red)

**Card B (has conflicts) — amber left border:**
- Title: "Draft from yesterday" (18px semi-bold)
- Status row: ⚠️ amber "3 scheduling conflicts found" · `·` separator · "Room Utilisation: 68%"
- Buttons: "Open Draft" (primary contained) + "Delete Draft" (outlined red)

### Empty State (alternate)
Centred: empty-calendar illustration + "You haven't started any simulations yet." (18px) + "Create Your First Simulation →" (large primary button)

---

## SCREEN 2 — Timetable Grid (Simulation Workspace)
**Route:** `/simulations/:id`

**Layout:** Full viewport width — three zones: toolbar, scrollable grid, pinned bottom HUD.

### Zone 1 — Toolbar (below app bar)
- Left: "Your Draft Simulation" (20px bold) + grey subtitle "Last saved 5 minutes ago"
- Centre: "View by:" label + dropdown — current value "View by Room" (options: View by Room / View by Professor / View by Student Group)
- Right: "Save Changes" — large primary contained button with save icon

### Zone 2 — Timetable Grid (main area, horizontally scrollable)

**Sticky left column (row headers, ~200px wide, light grey background):**
- "Room 101 (50 seats)"
- "Room 102 (30 seats)"
- "Room 103 (40 seats)"
- "Lecture Hall A (120 seats)"

**Sticky top row (column headers):**
Day + period labels: "Mon P1" · "Mon P2" · "Mon P3" · "Tue P1" · "Tue P2" · "Tue P3" · "Wed P1" (etc.)

**Grid cells:**
White background, 1px `#E0E0E0` borders. Classes appear as **chips inside cells**:

- **Default chip:** Solid deep blue fill, white text. Shows course code + truncated title: "BIO101 — Intro to Bio"
- **Conflicted chip:** Amber outlined border, white fill, amber text, ⚠️ icon prefix: "⚠️ CHEM301 — Chemistry"
- **Selected chip:** Deep blue border ring, slightly darker fill, subtle elevation
- **Multi-period class:** Chip visually spans 2 columns

Empty cells: light grey `#F5F5F5`

### Zone 3 — Inspector Panel (slide-in, right side)
Appears when a class chip is clicked. Fixed ~380px wide, slides in from right, overlays grid (does not push it). Semi-transparent scrim behind it.

Panel structure:
- **Header:** ✕ "Close" button (top-right, 44px target) + "BIO101 — Intro to Biology" (18px bold) + "Section A" (14px grey)
- **Divider**
- **`CURRENT ASSIGNMENT`** label (small caps)
  - "Lecturer: Dr. Jane Smith"
  - "Room: Room 101 (50 seats)"
  - "Time: Monday, Period 1 and Period 2"
- **Divider**
- **`SMART SUGGESTIONS`** label (small caps)
  - **Suggestion Card 1:**
    - Bold: "Room 102 · Wednesday, Period 1"
    - ✅ "No conflicts"
    - Metric chip (green): "Room Utilisation: 74% → 71% (−3%)"
    - "Apply This Suggestion" button (outlined, small, full text label)
  - **Suggestion Card 2:** (same pattern, different room/time)
- **If no suggestions:** grey italic text "No conflict-free slots available for this class. Try moving a conflicting class first."

### Zone 4 — Bottom HUD (pinned to viewport bottom)
White bar, 1px top border, 60px tall, full viewport width. Three sections with vertical dividers:

1. **Conflict counter (left ~33%):**
   - 0 conflicts: "✅ No scheduling conflicts" — green chip
   - Has conflicts: "⚠️ 2 scheduling conflicts — click to see details" — red chip (clickable, opens popover)

2. **Metric chips (centre ~40%):**
   - "Room Utilisation: 74%" — teal chip
   - "Avg Classes/Lecturer/Day: 3.2" — blue chip

3. **Submit button (right ~27%):**
   - "Submit Proposal for Review →" — large primary contained button

**Conflict popover (on HUD chip click):**
Small card: title "Scheduling Conflicts" + plain-English bulleted list:
- "Dr. Smith is already teaching another class at this time"
- "Room 101 is booked for two classes at the same time"
Each item is a clickable row (hover underline), which selects that class and opens the Inspector.

---

## SCREEN 3 — Submit Proposal Modal (overlay on Screen 2)

Two-step flow layered on top of the Timetable Grid.

### Step A — Unsaved Changes Gate (shown when there are unsaved edits)
Centred Dialog, 480px wide:
- Title: "You have unsaved changes" (18px bold)
- Body (16px): "You have changes that haven't been saved yet. Save them first so nothing is lost."
- Two full-width buttons (stacked, 48px tall each):
  1. "Save My Changes First" — primary contained
  2. "Submit Without Saving" — grey text button

### Step B — Proposal Form
Centred Dialog, 520px wide:
- Title: "Submit Proposal for Review" (20px bold)
- Body: "Explain what you changed and why. The scheduling office will read this."
- Textarea (4 rows), placeholder: *"e.g. I moved my Biology lecture to Wednesday because my Year 1 students have back-to-back classes on Monday mornings…"*
- **Amber Alert box** (if conflicts > 0): "⚠️ Your draft has 2 scheduling conflicts. You can still submit, but the scheduling office may ask you to fix them first."
- Button row: "Cancel" (text, left) + "Submit for Review →" (primary contained large, right)
- Submit button shows spinner while in-flight

---

## SCREEN 4 — Admin Proposal Dashboard
**Route:** `/admin/proposals`

**Layout:** Single-column, centred, max-width 900px

### Page Header
- Left: "Proposals for Review" (24px bold)
- Right: "🔄 Refresh List" — text button with icon (full label, not icon-only)

### Section 1 — "Ready to Publish" (green)
Section header: large green chip "✅ READY TO PUBLISH" + "(2)" count badge
Subtitle (14px grey): "The system has checked these — no scheduling conflicts were found"

**Proposal Card A — green left border:**
- "Dr. Alice Brown" (16px bold) · "Submitted 1 hour ago" (14px grey)
- Reason preview: *"Moving BIO101 to Wednesday to reduce student overlap…"* (14px, 1-line truncated)
- Right: "Review & Publish →" button (primary contained)

**Proposal Card B:** (same pattern)

### Section 2 — "Has Scheduling Conflicts" (amber)
Section header: amber chip "⚠️ HAS SCHEDULING CONFLICTS" + "(1)"
Subtitle: "These cannot be published until conflicts are fixed by the submitter"

**Proposal Card — amber left border:**
- "Dr. Carol Davis" · "Submitted 2 hours ago"
- Reason preview
- Sub-row: ⚠️ amber "3 scheduling conflicts detected" (14px)
- Right: "Review Details →" button (outlined)

### Empty State
Centred: empty-inbox illustration + "No proposals waiting for review." (18px grey)

---

## SCREEN 5 — Diff Review Screen (Admin)
**Route:** `/admin/proposals/:id`

**Layout:** Single-column, centred, max-width 860px

### Navigation & Status
- "← Back to Proposals" (text button with back-arrow icon + full label)
- Below: "Proposal by Dr. Alice Brown" (22px bold) + right-aligned: "✅ Checked — no conflicts found" (green chip)

### Section — Reason for Change
Label: `REASON FOR CHANGE` (small caps, grey)
Quote box (light grey background, left border accent): *"Moving my Biology lecture to Wednesday reduces the back-to-back scheduling for Year 1 Biology students on Monday mornings."*

### Section — What Will Change
Label: `WHAT WILL CHANGE` (small caps) + grey subtitle "(2 classes affected)"

**Change Card 1:**
- Header: "Intro to Biology — Section A" (16px bold)
- Field rows (two columns — field label + change):
  - "Room: ~~Room 101~~ → **Room 102**" (red strikethrough old, green bold new)
  - "Time: ~~Monday, Period 1~~ → **Wednesday, Period 1**"

**Change Card 2:**
- Header: "Modern History — Section A"
- "Lecturer: ~~Prof. Jones~~ → **Dr. Smith**"

### Section — System Check
Light blue info callout: "ⓘ System check passed — no scheduling conflicts were detected when this proposal was submitted."
Small italic disclaimer below: "This check was run at submission time and does not re-check against changes made to the live schedule since then."

Collapsed `Accordion` (below): "Show technical details (for IT use only) ▼"

### Sticky Action Bar (bottom)
White bar, 1px top border, full width, 72px tall:
- Left: "Close This Proposal" — outlined grey button
- Right: "✅ Approve & Publish" — large success-green contained button

**Confirmation Dialog (on "Approve & Publish" click):**
- Title: "Publish these changes to the live timetable?"
- Body: "This will immediately update the schedule that students and lecturers see. This action cannot be undone."
- Buttons: "Cancel" (text) · "Yes, Publish Changes" (green contained, large)

---

## SCREEN 6 — Rule Builder (Admin)
**Route:** `/admin/rules`

**Layout:** Two equal columns side by side with a centre divider. Max-width 1100px.

### Page Header
- "Rules Configuration" (24px bold)
- Grey subtitle: "These rules are used to evaluate and approve all scheduling proposals."

### Left Column — Performance Metrics
Column header: "PERFORMANCE METRICS" (16px bold) + "＋ Add Metric" (outlined button, right)

**Existing metric cards:**
- Card 1: "Room Utilisation" (16px bold) + grey chip "Rooms" + "Percentage of rooms in use" (14px grey) + "Target: 80%" + "🗑 Remove" text-icon button
- Card 2: "Avg Classes per Lecturer" + grey chip "Lecturers" + "Average classes per lecturer per day" + "Target: 4 classes/day" + Remove button

### Right Column — Hard Constraints
Column header: "SCHEDULING CONSTRAINTS" (16px bold) + "＋ Add Constraint" (outlined button)

- Card (system): "No Room Double-Booking" + blue chip "System Rule" + "A room cannot hold two classes at the same time" (no delete option)
- Card (custom): "Maximum Daily Load" + grey chip "Lecturers" + "No lecturer can teach more than 5 classes in one day" + Remove button

### "Add Metric" Dialog (on "＋ Add Metric" click)
Dialog, 480px wide, title "Add a New Metric":
- "Name this metric" — text input, placeholder "e.g. Room Utilisation"
- "What to measure" — dropdown: Rooms · Lecturers · Classes
- "How to measure it" — dropdown (options filtered by above):
  - Rooms → "Percentage of rooms in use"
  - Lecturers → "Average classes per lecturer per day" / "Maximum classes any lecturer teaches in one day"
  - Classes → "Total number of classes"
- "Target value" — number input with dynamic label ("Target (%)" or "Target (classes)")
- Buttons: "Cancel" (text) · "Add This Metric" (primary contained)

---

## GLOBAL STATES (show for each screen)

### Loading
- Skeleton cards (grey pulsing placeholders matching card shapes)
- Full-page: centred spinner + "Loading your simulation…" (16px grey)

### Session Expiry Modal (Screen 2 only)
Blocking Dialog (no backdrop dismiss):
- Title: "⏱ Your session has ended" (20px bold)
- Body (16px): "You were away for a while and your editing session has closed automatically. Don't worry — any changes you saved are still there on your draft. Only unsaved changes from this session were lost."
- Two full-width stacked buttons: "Go Back to My Simulations" (outlined) · "Start a New Draft" (primary contained)

### Inactivity Banner (Screen 2 only)
Non-blocking yellow `Alert` at the top of the grid area:
*"You've been away for a while. Save your draft now to avoid losing any unsaved changes."* + "Save Now" inline button

---

## COPY GUIDELINES

Never use technical terms in user-facing text. Always substitute:

| Technical / Raw | User-Facing Copy |
|---|---|
| Simulation / branch | Draft |
| Commit | Save Changes |
| Merge / Pull Request | Publish / Proposal |
| ci:ready | "Checked — no conflicts found" |
| ci:blocked | "Has scheduling conflicts" |
| PROFESSOR_OVERLAP | "Dr. [Name] is already teaching at this time" |
| ROOM_DOUBLE_BOOK | "Room [Name] is booked for two classes at once" |
| GROUP_OVERLAP | "[Group name] students are in two classes at once" |
| simulationId / raw ID | "Draft from 2 hours ago" (human-readable age) |
| professorId | Lecturer's full name |
| roomId | Room name and capacity |

Error messages always state what the user should do next — never just what went wrong.
