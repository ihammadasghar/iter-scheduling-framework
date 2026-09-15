# ISCTE 2022/23 Dataset

*Real schedule data from ISCTE-IUL (2nd semester, 2022/2023), used as an
opt-in alternative to the framework's synthetic/mock data.*

## 1. Source files

Two files, checked into `docs/`, both exports from ISCTE's own systems:

| File | What it is |
| --- | --- |
| `docs/ISCTE-2nd-Semester-22-23-Schedule.xlsx` | Every class session ISCTE held, Jan–Jul 2023. One sheet, `Turnos` ("Shifts"), 23,490 rows. |
| `docs/ISCTE-Typology-Rooms.xls` | The room catalog: 131 rooms with capacity and type tags. Three sheets: `Salas` ("Rooms"), `Características` ("Characteristics"), `Classificações` ("Classifications"). |

These are the **source of truth** the importer (`backend/src/scripts/importIsteDataset.ts`)
reads directly — nothing about them is hand-transcribed elsewhere.

## 2. `Turnos` sheet — column glossary

The critical thing to understand: **each row is one calendar occurrence of a
class** (a specific date between 2023-01-06 and 2023-07-14), not a weekly
template. A shift that meets every Monday for 14 weeks appears as 14 rows.

| Column (PT) | Meaning (EN) | Notes |
| --- | --- | --- |
| `Ano lectivo` | Academic year | Always `2022/2023` |
| `Semestre` | Semester | Always `2` |
| `Curso` | Program(s) | Comma-list when several programs share a shift (e.g. `LG, LGM, LGRH, LGIL`) — 112 distinct programs |
| `Unidade de execução` | Course name | 648 distinct |
| `Turno` | Shift/section code | e.g. `01151TP01` — suffix encodes type (`TP`=Teórico-Prático, `PL`=Prático-Laboratorial, `T`=Teórica, `S`=Seminário, …). 1,465 distinct |
| `Turma` | Student group/cohort(s) | Comma-list when a shift is shared by several cohorts — 472 distinct tokens |
| `Lotação total` / `Inscritos no turno` | Shift capacity / enrolled count | Used to estimate group size |
| `Dia da Semana` | Weekday (PT abbrev.) | `Seg/Ter/Qua/Qui/Sex/Sáb/Dom` — Dom (Sunday) had only 2 rows, treated as noise |
| `Início` / `Fim` | Start/end time | Exact `HH:MM:SS`, not period-aligned |
| `Dia` | Specific calendar date | Not used by the importer — only the weekday + time matter for a recurring weekly schedule |
| `Características da sala pedida para a aula` | Requested room type | e.g. `Laboratório de Informática` |
| `Sala da aula` | **Assigned room** | Blank on most rows — see §3 |
| `Características reais da sala` | Actual room's type | Compare against the requested type — a genuine requested-vs-actual mismatch signal, not currently used by the importer |

## 3. Data-quality findings

These are facts, confirmed by direct inspection of the file, not assumptions:

- **No professor/instructor column exists anywhere in the export.** ISCTE's
  data simply doesn't include who's teaching a shift.
- **Room assignment is sparse.** Only 5,401 of 23,490 rows (23%) have a room
  at all. Worse: only 261 of 1,465 shifts (18%) ever get *any* room across
  the entire semester — the other 82% are blank on every single occurrence.
- Most shifts recur at one consistent (day, start, end); some meet on 2+
  distinct weekly patterns (561 shifts have exactly 2; a handful go up to 12
  for complex/irregular schedules).
- All 41 room names that appear in the schedule resolve cleanly into the
  131-room `Salas` catalog.
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
| `timeSlots` | Unique `(Dia da Semana, Início, Fim)` triples, PT weekday → EN | 280 distinct slots |
| `rooms` | `Salas` sheet, active rooms only | 131 rooms, `capacity` = Capacidade Normal |
| `professors` | **Synthesized**, one per `Turno` | ISCTE's export has none — see §6 |
| `studentGroups` | Unique `Turma` tokens (comma-split) | `size` = max observed `Lotação total`/`Inscritos` for that token |
| `courses` | Unique `Unidade de execução` | `department` = first `Curso` token (a program-code proxy, not a real department — ISCTE's data has no department field either). `code` is **synthesized** — a short acronym from the course name's significant words + a disambiguating number (e.g. "A Europa e o Mundo Após 1945" → `EMA101`) — since ISCTE's export has no course-code column at all. The frontend's calendar/chip cells display `course.code`, not `course.name` (see `frontend/src/atoms/ClassChip.tsx`), so this needs to be a real, recognizable label, not an id remnant. |
| `classes` | Rows grouped by `(Turno, day, start, end)` | `roomId` = the most-frequently-seen room for that group, or `""` if the shift never got one. A shift shared by several `Turma` groups is exploded into one class per group (same room/time/professor, different `studentGroupId`), since the schema allows only one group per class. |

Running the importer on the current source files produces: **4,894 classes**,
131 rooms, 1,464 professors, 472 student groups, 646 courses, 280 time slots
— with **746/4,894 classes (15%) carrying a real assigned room**, the rest
`roomId: ""`. This is the full, uncurated output — see §8 for why the
*committed* `backend/src/fixtures/iscte-schedule.json` is a smaller,
hand-curated subset of it, not this straight import.

## 6. Decisions and caveats (know before you use this data)

- **Professors are fabricated.** One is synthesized per shift, deterministically,
  reusing the name pool in `backend/src/scripts/nameCatalog.ts`. `schedule.json`'s
  `metadata.professorsAreSynthetic` is always `true` for this dataset — check it
  before treating professor identity/load as real.
- **Most classes have no room** (`roomId: ""`). This is not a bug in the
  importer — it's what ISCTE's own export contains. These are realistic
  "needs scheduling" cases and arguably the most useful part of this dataset
  for exercising the tool's actual purpose. Downstream, an unresolved
  `roomId` is already handled gracefully: `ScheduleHydrator`'s
  `MATCH (r:Room {id: e.roomId})` simply matches nothing and skips the
  `HELD_IN` edge (see `GraphService`'s `coalesce(c.roomId, r.id)`).
- **`department` is a proxy, not real data.** Both course and professor
  `department` come from the first `Curso` (program) token — ISCTE's export
  has no department concept.
- **This data has real-world imperfections**, including the room-coverage gap
  above and possibly genuine double-bookings in the 15% that do have rooms.
  Unlike the synthetic generators, the importer does not guarantee
  conflict-free output — `importIsteDataset.test.ts` checks structural
  validity (every foreign key resolves), not zero-conflict.

## 7. Regenerating / using this dataset

```bash
# Regenerate schedule.json + rules.json from the source xlsx/xls files.
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

If the source `.xlsx`/`.xls` files ever change and this needs regenerating,
redo this curation by hand (or write a proper script) rather than
re-running the plain importer — the entity names above
(`CLS_000049`/`CLS_000001`/`CLS_000002`/`CLS_000093`/`CLS_000076`,
professor/group ids) are referenced directly by
`thesis/cognitive-walkthrough-protocol.md`, `docs/cw-session-runbook.md`,
and `seedBlockedProposal.ts`.
