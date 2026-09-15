# Cognitive-walkthrough session runbook

Operational checklist for running the sessions in
`thesis/cognitive-walkthrough-protocol.md` (repo: `ihammadasghar/literature-review`)
against this app. That document is the CW methodology, task scripts, and
facilitator script; this one is "how to get the machine and data into the
state that document assumes." Remote participants join via screen-share /
remote control — nobody installs anything on their own machine — so this is
really a checklist for the facilitator's own PC, repeated identically
whether the session is in person or remote.

## 1. One-time machine setup

Follow `README.md`'s Quick Start:

```bash
make install                          # once, or after a dependency change
cp backend/.env.example backend/.env  # only if backend/.env doesn't exist yet
```

**Critical: check `backend/.env` has `GITHUB_PROVIDER=mock` before every
session, not just the first time.** It's easy for this to drift to `github`
mode during unrelated dev work (e.g. capturing screenshots against a real
repo) — the protocol (§5.1) is explicit that sessions must run against the
default mock fixture, not a real GitHub repo or the ISCTE dataset, since the
task prompts name specific professors/rooms/groups that only exist in
`backend/src/fixtures/mock-schedule.json`. Also confirm `MOCK_FIXTURE_SET`
is unset or `mock`, never `iscte` — the ISCTE fixture set is ~4,900 classes
with no small named roster and has known, unfixed performance problems
(suggestions/diff-review endpoints can take 60–230s+ under it) that don't
affect the small default fixture at all.

```bash
grep -E '^(GITHUB_PROVIDER|MOCK_FIXTURE_SET)=' backend/.env
# want: GITHUB_PROVIDER=mock
# want: MOCK_FIXTURE_SET absent or commented out
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
re-run `make dev`).

## 3. Pre-session data seeding

Maps 1:1 to protocol §5, points 3–5. Do this once per session day, before
the first participant — not per participant (see §5 below for what *does*
reset between participants).

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
   make seed-blocked-proposal
   ```

   This talks to the already-running `make dev` server (it can't work
   standalone — see the comment at the top of
   `backend/src/scripts/seedBlockedProposal.ts` for why) and creates a real
   proposal that moves `CLS_00002` (Prof. Alan Jones, Modern History) into a
   room another professor's class already occupies at the same time
   (`CLS_00009`, Dr. Bob Chen, Room 103, Monday Period 2) — one clean new
   `ROOM_DOUBLE_BOOK` conflict, on top of the fixture's own pre-existing
   `CLS_00001`/`CLS_00004` conflict, deliberately not touching `CLS_00001`
   itself (T3/T4's target class, for the professor sessions). Confirm the
   script prints `status BLOCKED` — if it doesn't, `mock-schedule.json` has
   likely changed since this runbook was written; see the script's own
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

4. **One resolvable clash for `GRP_BIO_Y1`, for T3s.** Open a simulation,
   move one of Biology Year 1's classes onto another `GRP_BIO_Y1` class's
   room+time slot (e.g. via the Contextual Inspector's manual overlay tool),
   confirm the Smart Suggestions panel offers at least one conflict-free fix
   for it, then leave it uncommitted/unsubmitted so the student participant
   finds it fresh.

## 4. Day-of dry run

Before the *first real participant* of a session day, walk T0–T5 yourself
end to end once: onboard as each of the three roles, open Rule Builder, open
`CLS_00001` and check a suggestion appears, submit a proposal, and open the
seeded BLOCKED proposal as Admin and confirm both `WeightedScoreChip`s and
the conflict counts are populated. This is a rehearsal, not the recorded
data — the state it seeds (identity, any drafts) gets reset via "Change
Identity" (§5) before the first participant starts, and re-run
`make seed-blocked-proposal` afterward if your rehearsal consumed the seeded
proposal by merging or closing it.

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
  submitted CLS_00001's move, `CLS_00001` won't have the pre-existing
  conflict to notice anymore for the next Professor — moving it back, or
  just re-running `make dev` fresh (which reloads the fixture from disk) is
  the simplest reset between the two Professor sessions specifically. The
  seeded BLOCKED proposal and constraint from §3 persist across
  participants (they're not consumed by being viewed), so only redo those
  if an Admin participant actually merges/closes the seeded proposal or
  deletes the constraint.

## 6. Known, disclosed gaps (not bugs to report mid-session)

Per protocol §8, plus two more confirmed while preparing this runbook — log
if a participant hits any of these, don't treat them as new findings:

- "Change Identity" reopens onboarding, not a role toggle (protocol §8).
- The metric catalog is closed at 8 `target:condition` pairs (protocol §8).
- Policy vs. structural constraints share one dropdown with no visual
  distinction beyond the `Limit` field (protocol §8).
- The `EditAssignmentDialog` for a class edit shows an integrated
  Room/Professor/Group/Day/Period overlay tool *above* the Smart
  Suggestions list, not a separate "Or Choose It Yourself" section below it
  — the protocol's T3 section describes the earlier design; the underlying
  mechanism (manual override alongside Smart Suggestions) is unchanged.
