# Cognitive-walkthrough session runbook

Operational checklist for running the sessions in
`thesis/cognitive-walkthrough-protocol.md` (repo: `ihammadasghar/literature-review`)
against this app. That document is the CW methodology, task scripts, and
facilitator script; this one is "how to get the machine and data into the
state that document assumes." Remote participants join via screen-share /
remote control — nobody installs anything on their own machine — so this is
really a checklist for the facilitator's own PC, repeated identically
whether the session is in person or remote.

Sessions run against **real ISCTE 2022/23 data** (`MOCK_FIXTURE_SET=iscte`),
curated down to a small, demo-usable roster — see
[docs/iscte-dataset.md](./iscte-dataset.md) §8 for exactly what was curated
and why. Not the plain mock fixture (`mock-schedule.json`) — protocol §5.1–5.2
has the full rationale.

## 1. One-time machine setup

Follow `README.md`'s Quick Start:

```bash
make install                          # once, or after a dependency change
cp backend/.env.example backend/.env  # only if backend/.env doesn't exist yet
```

**Critical: check `backend/.env` has `GITHUB_PROVIDER=mock` and
`MOCK_FIXTURE_SET=iscte` before every session, not just the first time.**
It's easy for `GITHUB_PROVIDER` to drift to `github` mode during unrelated
dev work (e.g. capturing screenshots against a real repo), and
`MOCK_FIXTURE_SET` defaults to the plain mock fixture if unset/commented —
neither matches what the protocol's task prompts (§7) now assume.

```bash
grep -E '^(GITHUB_PROVIDER|MOCK_FIXTURE_SET)=' backend/.env
# want: GITHUB_PROVIDER=mock
# want: MOCK_FIXTURE_SET=iscte
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
localhost:3000/api/v1/schedule/roster` — should show 8 professors, not 3 or
1,464).

## 3. Pre-session data seeding

Maps 1:1 to protocol §5, points 3–5. Do this once per session day, before
the first participant — not per participant (see §5 below for what *does*
reset between participants).

1. **One metric rule.** Rule Builder → "+ Add Metric" → e.g. target
   *Lecturers*, condition *Share of a lecturer's classes scheduled
   back-to-back*, any threshold, any weight. (The fixture ships with two
   metrics already defined in `iscte-rules.json` — Room Utilization and
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
   make seed-blocked-proposal
   ```

   This talks to the already-running `make dev` server (it can't work
   standalone — see the comment at the top of
   `backend/src/scripts/seedBlockedProposal.ts` for why) and creates a real
   proposal that moves `CLS_000093` (Prof. Maria Chen, "Análise e Modelos de
   Dados Financeiros") into a room another class already occupies at the
   same time (`CLS_000076`, Dr. Liam Jones, "Serviço Social com Adultos e
   Idosos", Room 2E07/RM_0124, Friday 16:30–18:00) — one clean new
   `ROOM_DOUBLE_BOOK` conflict, deliberately independent of `CLS_000049`
   (T3/T4's target class) and the `CLS_000001`/`CLS_000002` clash baked into
   the fixture for T3s. Confirm the script prints `status BLOCKED` — if it
   doesn't, `iscte-schedule.json` has likely changed since this runbook was
   written; see the script's own warning message for what to check.

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

4. **The resolvable clash for T3s is already baked in — just confirm it's
   there.** Unlike the metric/constraint/BLOCKED-proposal steps above, this
   one isn't something you seed each session: the curated
   `iscte-schedule.json` ships with `CLS_000001` and `CLS_000002` (both
   student group `MCTRLA1`) already double-booked Monday 18:00–20:00, with
   genuine conflict-free Smart Suggestions available. Sanity-check once per
   session day:
   ```bash
   curl -s localhost:3000/api/v1/simulations -X POST -H 'Content-Type: application/json' -d '{"userId":"dry-run"}' \
     | python3 -c "import json,sys; print(json.load(sys.stdin)['id'])"
   # then, with that id:
   curl -s localhost:3000/api/v1/simulations/<id>/conflicts
   # want: a GROUP_OVERLAP for CLS_000001/CLS_000002 in the list
   ```

## 4. Day-of dry run

Before the *first real participant* of a session day, walk T0–T5 yourself
end to end once: onboard as each of the three roles (8 professors / 8
student groups now in the picker — see protocol §5.2 for the full roster),
open Rule Builder, open `CLS_000049` (Dr. John Jones) and check a suggestion
appears, submit a proposal, and open the seeded BLOCKED proposal as Admin
and confirm both `WeightedScoreChip`s and the conflict counts are
populated. This is a rehearsal, not the recorded data — the state it seeds
(identity, any drafts) gets reset via "Change Identity" (§5) before the
first participant starts, and re-run `make seed-blocked-proposal` afterward
if your rehearsal consumed the seeded proposal by merging or closing it.

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
  submitted `CLS_000049`'s move, that class won't have a fresh suggestion
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
- Two genuine `ROOM_CAPACITY_EXCEEDED` conflicts (Prof. Aisha Kim's `HMCC1`
  classes) sit in the baseline from real, unmodified ISCTE data, unrelated
  to any task — expect them to show up in conflict counts/lists a
  participant might notice in passing.
