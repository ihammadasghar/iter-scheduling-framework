# Cognitive-walkthrough session runbook

Operational checklist for running the sessions in
`thesis/cognitive-walkthrough-protocol.md` (this repo,
`iter-scheduling-framework`) against this app. That document is the CW
methodology, task scripts, and facilitator script; this one is "how to get
the machine and data into the state that document assumes." Six sessions
are booked across three personas — Professor, Student, and Admin (2 each) —
covering tasks T0 (onboarding, all personas), T1/T2/T5 (Admin), T3/T4
(Professor), and T3s (Student). Remote participants join via screen-share /
remote control — nobody installs anything on their own machine — so this is
really a checklist for the facilitator's own PC, repeated identically
whether the session is in person or remote.

Sessions run against the **default mock fixture** (`mock-schedule.json`,
`MOCK_FIXTURE_SET` unset or `mock`) — not real ISCTE data. Since commit
`e509456`, this fixture's rooms/courses/student groups are real ISCTE
2022/23 entities (room 2E02, course "Arquitetura de Redes", group EI-A1,
etc.), giving it a realistic feel without ISCTE's full-scale roster
(1,464 professors, 472 student groups), which is both too large to onboard
a participant through live and doesn't match the protocol's task prompts
(§7), which are written around a small, fully scripted cast of three
professors (Dr. Jane Smith, Prof. Alan Jones, Dr. Bob Chen).

## 1. One-time machine setup

Follow `README.md`'s Quick Start:

```bash
make install                          # once, or after a dependency change
cp backend/.env.example backend/.env  # only if backend/.env doesn't exist yet
```

**Critical: check `backend/.env` has `GITHUB_PROVIDER=mock` and
`MOCK_FIXTURE_SET` unset or `mock` (not `iscte`) before every session, not
just the first time.** It's easy for `GITHUB_PROVIDER` to drift to `github`
mode during unrelated dev work (e.g. capturing screenshots against a real
repo), or for `MOCK_FIXTURE_SET` to be left at `iscte` from other
dev/demo work — neither matches what the protocol's task prompts (§7) now
assume.

```bash
grep -E '^(GITHUB_PROVIDER|MOCK_FIXTURE_SET)=' backend/.env
# want: GITHUB_PROVIDER=mock
# want: MOCK_FIXTURE_SET=mock  (or the line absent/commented out)
```

**Windows:** `make` isn't installed by default — use WSL, or install it via
GnuWin32 (both linked in `README.md`'s Prerequisites table). Node ≥22,
pnpm, and Docker are needed either way.

## 2. Start the stack

```bash
make dev   # Memgraph + backend (port 3000) + frontend (port 5173), Ctrl+C stops all
```

Confirm the backend log line reads:

```
[server] GitHub provider: mock (in-memory, no real GitHub account used)
```

If it says `github` instead, `backend/.env` has the wrong provider — fix it
and restart (`nodemon` won't pick up `.env` changes on its own; stop and
re-run `make dev`). The log doesn't distinguish `mock`/`iscte` fixture sets,
so also spot-check the roster once the frontend is up (§3 below, or `curl
localhost:3000/api/v1/schedule/roster` — should show 3 professors, not 8 or
1,464).

## 3. Pre-session data seeding

Maps 1:1 to protocol §5, points 3–5 (point 5 below is this runbook's own
addition, covering the Student persona's T3s task that protocol §5 folds
into the same "confirm the resolvable clash" point 5). Do this once per
session day, before the first participant — not per participant (see §5
below for what *does* reset between participants).

1. **One metric rule.** Rule Builder → "+ Add Metric" → e.g. target
   *Lecturers*, condition *Share of a lecturer's classes scheduled
   back-to-back*, any threshold, any weight. (The fixture ships with two
   metrics already defined in `mock-rules.json` — Room Utilization and
   Average Classes per Professor per Day — so T1 can instead be framed as
   "add a *second* rule" if you'd rather test that; pick one and note which
   in the session log, per protocol §5.3.)

2. **One policy constraint.** Rule Builder → "+ Add Constraint" → target
   *Lecturers*, condition *Lecturer teaches more than allowed consecutive
   periods* (`consecutive_limit`) or *Gap between a lecturer's classes
   exceeds the allowed maximum* (`gap_limit`) — these two are the only
   conditions with a numeric **Limit** field. Any limit value.

3. **One BLOCKED proposal, for T5.** Run:

   ```bash
   TARGET_CLASS_ID=CLS_000002 CONFLICTING_ROOM_ID=RM_0003 \
     CONFLICTING_TIME_SLOT_ID=TS_MON_1030_1215 make seed-blocked-proposal
   ```

   This talks to the already-running `make dev` server (it can't work
   standalone — see the comment at the top of
   `backend/src/scripts/seedBlockedProposal.ts` for why) and creates a real
   proposal that moves `CLS_000002` (Prof. Alan Jones, "Empreendedorismo
   Lecture - Section A") into a room another class already occupies at the
   same time (`CLS_000009`, Dr. Bob Chen, "Contabilidade Avançada Tutorial -
   Section A", Room 2E03/RM_0003, Monday 10:30–12:15) — one clean new
   `ROOM_DOUBLE_BOOK` conflict, deliberately independent of `CLS_000001`
   (T3's target class, also involved in the separate `CLS_000001`/
   `CLS_000004` clash baked into the fixture for T3) and the
   `CLS_000007`/`CLS_000011` clash baked into the fixture for T3s. Confirm
   the script prints `status BLOCKED` — if it doesn't, `mock-schedule.json`
   has likely changed since this runbook was written; see the script's own
   warning message for what to check.

   Why this needs a dedicated script rather than "just submit a bad
   proposal" the way the protocol used to describe: the normal Submit
   Proposal flow (`POST /proposals`) rejects any candidate that would come
   out worse than the published baseline *before* it ever becomes a
   reviewable proposal — the same check that decides `READY`/`BLOCKED`
   status also gates submission, so a genuinely BLOCKED proposal can't
   otherwise be created through the UI. `make seed-blocked-proposal` calls a
   facilitator-only endpoint (`POST /proposals/seed`) that skips that gate;
   it only exists when `GITHUB_PROVIDER=mock`, so it's inert in any
   real-repo deployment.

4. **The resolvable clash for T3 is already baked in — just confirm it's
   there.** Unlike the metric/constraint/BLOCKED-proposal steps above, this
   one isn't something you seed each session: `mock-schedule.json` ships
   with `CLS_000001` (Dr. Jane Smith, "Arquitetura de Redes Lecture -
   Section A") and `CLS_000004` (Prof. Alan Jones, "Finanças de Empresa
   Lecture - Section A") already double-booked into the same room
   (RM_0001/2E02) at the same time (Monday 08:30–10:15), with genuine
   conflict-free Smart Suggestions available. Sanity-check once per
   session day:
   ```bash
   curl -s localhost:3000/api/v1/simulations -X POST -H 'Content-Type: application/json' -d '{"userId":"dry-run"}' \
     | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])"
   # then, with that id:
   curl -s localhost:3000/api/v1/simulations/<id>/conflicts
   # want: a ROOM_DOUBLE_BOOK for CLS_000001/CLS_000004 in the list
   ```

5. **The resolvable clash for T3s (Student persona) is also already baked
   in — same "nothing to seed, just confirm" treatment.** `mock-schedule.json`
   ships with `CLS_000007` (Prof. Alan Jones, "Empreendedorismo Seminar -
   Section A") and `CLS_000011` (Dr. Jane Smith, "Bases de Dados Seminar -
   Section A") already double-booked for the same student group (`GRP_00002`/
   `GA1`) at the same time (Tuesday 09:00–11:30, different rooms), with
   genuine conflict-free Smart Suggestions available. It's independent of
   T3's `CLS_000001`/`CLS_000004` clash and T5's seeded `CLS_000002`/
   `CLS_000009` conflict — check the same conflicts endpoint from point 4
   above and confirm the list also contains a `GROUP_OVERLAP` for
   `CLS_000007`/`CLS_000011`.

## 4. Day-of dry run

Before the *first real participant* of a session day, walk T0–T5 yourself
end to end once: onboard (T0) as each of the three roles — Professor,
Student, Admin — via the "Welcome — who's using ITER?" dialog (3 professors
/ 3 student groups in the picker — see protocol §5.2 for the full roster);
as Professor, open Rule Builder, open `CLS_000001` (Dr. Jane Smith) and
check a suggestion appears (T3), then submit a proposal (T4); as Student,
open GA1's My Schedule, confirm the `CLS_000007`/`CLS_000011` overlap
renders with conflict styling and a Smart Suggestion resolves it (T3s); as
Admin, open the seeded BLOCKED proposal and confirm both `WeightedScoreChip`s
and the conflict counts are populated (T5). This is a rehearsal, not the
recorded data — the state it seeds (identity, any drafts) gets reset via
"Change Identity" (§5) before the first participant starts, and re-run the
seed-blocked-proposal command from §3 afterward if your rehearsal consumed
the seeded proposal by merging or closing it.

## 5. Between participants

- Click **"Change Identity"** (top app bar, carries a "DEMO ONLY" chip) to
  reopen the onboarding dialog for the next participant — this is the
  supported reset path (protocol §6, §8: the old same-screen role-switch
  toggle no longer exists).
- A hard reload works too and is no longer unsafe on `/admin/**` routes
  specifically (an existing hydration race that could drop a proposal's
  `:id` on reload has been fixed) — but prefer "Change Identity" or
  click-through navigation as the default habit regardless, since it's the
  path the protocol's own script assumes.
- Re-seed anything a participant consumed: if a Professor session actually
  submitted `CLS_000001`'s move, that class won't have a fresh suggestion
  story for the next Professor — moving it back, or just re-running
  `make dev` fresh (which reloads the fixture from disk) is the simplest
  reset between the two Professor sessions specifically. The seeded
  BLOCKED proposal, metric, and constraint from §3 persist across
  participants (they're not consumed by being viewed), so only redo those
  if an Admin participant actually merges/closes the seeded proposal or
  deletes the rule.

## 6. Known, disclosed gaps (not bugs to report mid-session)

Per protocol §8, plus a few more confirmed while preparing this runbook —
log if a participant hits any of these, don't treat them as new findings:

- "Change Identity" reopens onboarding, not a role toggle (protocol §8).
- The metric catalog is closed at 8 `target:condition` pairs (protocol §8).
- Policy vs. structural constraints share one dropdown with no visual
  distinction beyond the `Limit` field (protocol §8).
- The `EditAssignmentDialog` for a class edit shows an integrated
  Room/Professor/Group/Day/Period overlay tool *above* the Smart
  Suggestions list, not a separate "Or Choose It Yourself" section below it
  — the protocol's T3 section describes the earlier design; the underlying
  mechanism (manual override alongside Smart Suggestions) is unchanged.
- Course titles are real, untranslated Portuguese (protocol §8) — this is
  ISCTE's real 2022/23 export, not a display bug.
