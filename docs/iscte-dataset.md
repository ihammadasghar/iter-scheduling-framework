# ISCTE 2022/23 Dataset

*Real schedule data from ISCTE-IUL (1st semester, 2022/2023), used as an
opt-in alternative to the framework's synthetic/mock data.*

## 1. Source files

| File | What it is |
| --- | --- |
| `docs/ISCTE-1st-Semester-22-23-Schedule-rooms-assigned.csv` | Every class session ISCTE held, Sep 2022–Jun 2023 (overwhelmingly Sep–Dec 2022 — 1st semester), with rooms assigned on most rows. Semicolon-delimited, UTF-8 BOM, 26,019 rows. **This is what the importer reads.** |
| `docs/ISCTE-Typology-Rooms.xls` | The room catalog: 131 rooms with capacity and type tags. Three sheets: `Salas` ("Rooms"), `Características` ("Characteristics"), `Classificações` ("Classifications"). Still used as-is — its room names resolve cleanly against the CSV (see §3). |
| `docs/ISCTE-2nd-Semester-22-23-Schedule.xlsx` | The *previous* source (2nd semester, Jan–Jul 2023, `Turnos` sheet, 23,490 rows), where only ~15% of classes had a real room. **No longer read by the importer** — kept on disk for reference/history only. |

The CSV is the **source of truth** the importer (`backend/src/scripts/importIsteDataset.ts`)
reads directly — nothing about it is hand-transcribed elsewhere. Despite its filename
("2nd-Semester"), its `Dia` dates are actually 1st-semester (confirmed by direct inspection:
96% of dated rows fall Sep–Dec 2022); this is a known mislabel in the source export, not a bug
in the importer.

## 2. Schedule CSV — column glossary

The critical thing to understand: **each row is one calendar occurrence of a
class**, not a weekly template. A shift that meets every Monday for several weeks appears as
that many rows.

| Column (PT) | Meaning (EN) | Notes |
| --- | --- | --- |
| `Curso` | Program(s) | Comma-list when several programs share a shift (e.g. `LG, LGM, LGRH, LGIL`) |
| `Unidade de execução` | Course name | |
| `Turno` | Shift/section code | e.g. `01789TP01` — suffix encodes type (`TP`=Teórico-Prático, `PL`=Prático-Laboratorial, `T`=Teórica, `S`=Seminário, …) |
| `Turma` | Student group/cohort(s) | Comma-list when a shift is shared by several cohorts |
| `Inscritos no turno` | Enrolled count | Used to estimate group size. This CSV has **no shift-capacity column** at all (the older xlsx's `Lotação total` doesn't exist here) — group size is derived from `Inscritos no turno` alone; the importer's `resolveScheduleCols` tolerates `Lotação total`'s absence and falls back cleanly |
| `Dia da Semana` | Weekday (PT abbrev.) | `Seg/Ter/Qua/Qui/Sex/Sáb/Dom` — Dom (Sunday) rows treated as noise |
| `Início` / `Fim` | Start/end time | Exact `HH:MM:SS`, not period-aligned |
| `Dia` | Specific calendar date | Format is `DD/MM/YYYY` in this CSV (the older xlsx source rendered `M/D/YY`) — only the min/max across all rows is used, to derive `metadata.timeline` bounds |
| `Características da sala pedida para a aula` | Requested room type | e.g. `Laboratório de Informática` |
| `Sala da aula` | **Assigned room** | Populated on most rows — see §3 for the residual gap and a data-quality artifact |
| `Lotação` | Capacity of the **assigned room** (not shift capacity!) | Constant per room name, blank exactly when `Sala da aula` is blank — verified by inspection. **Deliberately not used** for group sizing (it would silently substitute room capacity for enrolled headcount); not currently consumed by the importer at all |
| `Características reais da sala` | Actual room's type | Compare against the requested type — a genuine requested-vs-actual mismatch signal, not currently used by the importer |

## 3. Data-quality findings

These are facts, confirmed by direct inspection of the file, not assumptions:

- **No professor/instructor column exists anywhere in the export.** ISCTE's
  data simply doesn't include who's teaching a shift.
- **Room assignment is now mostly populated**, a major improvement over the previous xlsx
  source: running the importer against this CSV produces **4,631 of 5,710 classes (81%)**
  with a real assigned room.
- **~21% of the CSV's "room-assigned" rows actually hold corrupted scientific-notation junk**
  in `Sala da aula` (e.g. `1,00E+02`, `2,00E+07` — 4,943 of 23,765 non-blank rows) instead of a
  real room code. This is an artifact of however the export was produced, not a parsing bug.
  The importer's `pickModeRoom()` only accepts a room name that resolves in the `Salas`
  catalog, so these junk values are silently discarded as candidates — a shift whose only
  room mentions are junk correctly ends up with `roomId: ""` rather than a bogus room. This is
  why the *class-level* 81% coverage above is lower than the raw "91% of CSV rows have some
  value in `Sala da aula`" figure.
- Of the 83 distinct, non-junk room names appearing in the schedule, 82 resolve cleanly into
  the 131-room `Salas` catalog (only `0S08` doesn't match; negligible).
- `Turma` and `Curso` are sometimes comma-lists — one shift taught jointly to
  several cohorts, or counted under several programs.

## 4. `Salas` sheet (room catalog)

Columns used: `Edifício` (building), `Nome sala` (room name), `Activa`
(active flag — all 131 rooms are active), `Capacidade Normal` (normal
capacity). ~30 additional binary columns tag each room's type/characteristics
(`Anfiteatro aulas`, `Laboratório de Informática`, `BYOD`, …) — not currently
consumed by the importer, but a good source for a future room-type-match
constraint given §2's requested-vs-actual signal.

## 5. Mapping to `ScheduleJson`

Implemented in `backend/src/scripts/importIsteDataset.ts`. Summary:

| `ScheduleJson` field | Derived from | Notes |
| --- | --- | --- |
| `timeSlots` | Unique `(Dia da Semana, Início, Fim)` triples, PT weekday → EN | 309 distinct slots |
| `rooms` | `Salas` sheet, active rooms only | 131 rooms, `capacity` = Capacidade Normal |
| `professors` | **Synthesized**, one per `Turno` | ISCTE's export has none — see §6 |
| `studentGroups` | Unique `Turma` tokens (comma-split) | `size` = max observed `Inscritos` for that token (this CSV has no shift-capacity column — see §2) |
| `courses` | Unique `Unidade de execução` | `department` = first `Curso` token (a program-code proxy, not a real department — ISCTE's data has no department field either). `code` is **synthesized** — a short acronym from the course name's significant words + a disambiguating number (e.g. "A Europa e o Mundo Após 1945" → `EMA101`) — since ISCTE's export has no course-code column at all. The frontend's calendar/chip cells display `course.code`, not `course.name` (see `frontend/src/atoms/ClassChip.tsx`), so this needs to be a real, recognizable label, not an id remnant. |
| `classes` | Rows grouped by `(Turno, day, start, end)` | `roomId` = the most-frequently-seen *valid* room for that group (junk scientific-notation values are ignored — see §3), or `""` if the shift never got one. A shift shared by several `Turma` groups is exploded into one class per group (same room/time/professor, different `studentGroupId`), since the schema allows only one group per class. |

Running the importer on the current source files produces: **5,710 classes**,
131 rooms, 1,725 professors, 529 student groups, 758 courses, 309 time slots
— with **4,631/5,710 classes (81%) carrying a real assigned room**, the rest
`roomId: ""`. This is the full, uncurated output — see §8 for why the
*committed* `backend/src/fixtures/iscte-schedule.json` is a smaller,
hand-curated subset of the *previous* (sparse-room) import, not this one.

## 6. Decisions and caveats (know before you use this data)

- **Professors are fabricated.** One is synthesized per shift, deterministically,
  reusing the name pool in `backend/src/scripts/nameCatalog.ts`. `schedule.json`'s
  `metadata.professorsAreSynthetic` is always `true` for this dataset — check it
  before treating professor identity/load as real.
- **A residual ~19% of classes have no room** (`roomId: ""`) — either the shift genuinely never
  got one in ISCTE's export, or its only room mentions were the scientific-notation junk values
  described in §3. This is not a bug in the importer, and these remain realistic "needs
  scheduling" cases. Downstream, an unresolved `roomId` is already handled gracefully:
  `ScheduleHydrator`'s `MATCH (r:Room {id: e.roomId})` simply matches nothing and skips the
  `HELD_IN` edge (see `GraphService`'s `coalesce(c.roomId, r.id)`).
- **`department` is a proxy, not real data.** Both course and professor
  `department` come from the first `Curso` (program) token — ISCTE's export
  has no department concept.
- **This data has real-world imperfections**, including the residual room-coverage gap and
  scientific-notation corruption above, and possibly genuine double-bookings in the 81% that do
  have a real room. Unlike the synthetic generators, the importer does not guarantee
  conflict-free output — `importIsteDataset.test.ts` checks structural
  validity (every foreign key resolves), not zero-conflict.

## 7. Regenerating / using this dataset

```bash
# Regenerate schedule.json + rules.json from the source CSV/xls files.
# (Note: no `--` before the outDir — pnpm forwards it to tsx literally,
# which the script would then read as the outDir itself.)
cd backend && pnpm import:iscte /path/to/outDir
```

Three ways to actually run against it, in increasing order of fidelity:

1. **In-memory mock mode** — no regeneration needed, the output above is
   already committed as `backend/src/fixtures/iscte-schedule.json`/
   `iscte-rules.json`. Add to `backend/.env` (alongside `GITHUB_PROVIDER=mock`):
   ```
   MOCK_FIXTURE_SET=iscte
   ```
   `backend/src/fixtures/mock-schedule.json`/`mock-rules.json` (the small,
   hand-written fixture `mockFixtures.test.ts` and most unit tests assume)
   are untouched — `MOCK_FIXTURE_SET` defaults to `mock`, so this is purely
   opt-in.

2. **Real GitHub repo, real branch/PR flow** — `make setup-github-iscte`
   creates/reuses a dedicated repo (`iter-scheduling-iscte-data` by default)
   and pushes the converted data to it. This is a *separate* repo from
   whatever `make setup-github` uses for the mock dataset — nothing here
   touches that one.

3. **Switching between the two real repos** — once both exist, flip
   `backend/.env` between them without re-cloning or re-pushing anything:
   ```bash
   make use-mock-repo
   make use-iscte-repo
   ```
   Restart the backend after switching either way (env vars are read once at
   startup; nodemon doesn't watch `.env`).

## 8. Curated for cognitive-walkthrough sessions

**The committed `backend/src/fixtures/iscte-schedule.json` is not a
straight import** — as of 2026-09-15 it's a hand-curated subset, built for
running `thesis/cognitive-walkthrough-protocol.md`'s live sessions against
real ISCTE data. Re-running `pnpm import:iscte` and copying its output over
this file would **discard the curation** (see `schedule.metadata.curationNote`
in the file itself, which also documents this).

**This fixture is deliberately frozen against the *old*, sparse-room 2nd-semester xlsx
source** (§1), even though the importer itself now reads a different, room-richer
1st-semester CSV. The six already-booked cognitive-walkthrough sessions and their runbook
depend on this fixture's exact entity IDs and room-conflict scenarios below — swapping the
underlying source out from under it would silently change or remove those scenarios. Re-curating
against the new CSV (if ever wanted) is separate, deliberate future work, not a side effect of
this source change.

**Why curate at all:** the straight import's 1,464 professors / 472 student
groups make `OnboardingFlow`'s identity picker (a plain, unsearchable MUI
`Select`, not an autocomplete) unusable — nobody can find their name in a
1,464-entry dropdown. The protocol's task prompts also need specific,
demoable entities (a professor with a real room assignment and a genuine
free alternative, a group with a resolvable clash, etc.), which the raw
import doesn't hand you deterministically.

**What was changed, concretely:**
- `professors`/`studentGroups` trimmed to **8 each**, hand-picked for real
  room assignments and clean course titles. `classes` trimmed to those 8
  professors' own real classes, plus ~180 additional real classes
  (authentic course/room/timeSlot untouched) with `professorId`/
  `studentGroupId` reassigned onto the 8/8 roster — conflict-checked
  (professor/group/room double-booking, room capacity) so the padding
  doesn't manufacture accidental conflicts on top of the deliberate ones
  below. `courses`/`rooms`/`timeSlots` are untouched (full catalogs).
- **Two deliberate scenarios**, both real ISCTE courses/rooms, matching the
  precedent `mock-schedule.json` already sets with its own single
  deliberate `CLS_00001`/`CLS_00004` conflict:
  - `CLS_000001` was moved onto `CLS_000002`'s time slot — both belong to
    student group `MCTRLA1` (`GRP_00337`), producing one `GROUP_OVERLAP`
    baked into the baseline, for the Student persona's T3s task.
  - `CLS_000049` (Dr. John Jones, "Projecto Empresarial em Finanças", Room
    2E02, Monday 08:00–09:30) is the Professor persona's T3/T4 target class
    — unmodified, chosen for having a real room assignment and genuine
    conflict-free alternatives.
  - `CLS_000093`/`CLS_000076` are deliberately left conflict-free in this
    file — `backend/src/scripts/seedBlockedProposal.ts` (`make
    seed-blocked-proposal`) forces them together *live*, at submit time,
    for the Admin persona's T5 task. Not baked into the baseline, so it
    doesn't pollute every other proposal's conflict count.
- Two remaining baseline `ROOM_CAPACITY_EXCEEDED` conflicts
  (`CLS_000231`/`CLS_000233`, Prof. Aisha Kim's real, unmodified
  `HMCC1`/room `2E03` assignment) are genuine, untouched ISCTE data — left
  as authentic "real-world imperfection" texture, unrelated to any task.

If this ever needs regenerating against the current CSV source,
redo this curation by hand (or write a proper script) rather than
re-running the plain importer — the entity names above
(`CLS_000049`/`CLS_000001`/`CLS_000002`/`CLS_000093`/`CLS_000076`,
professor/group ids) are referenced directly by
`thesis/cognitive-walkthrough-protocol.md`, `docs/cw-session-runbook.md`,
and `seedBlockedProposal.ts`.
