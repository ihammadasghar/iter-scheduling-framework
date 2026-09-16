// Facilitator/demo-only: creates a real, reviewable BLOCKED proposal against
// an already-running dev server, for cognitive-walkthrough session setup
// (thesis/cognitive-walkthrough-protocol.md §5.4 in the literature-review
// repo) or any other demo that needs a genuinely blocked proposal to review.
//
// Why this exists as an HTTP client rather than talking to services
// directly: GITHUB_PROVIDER=mock keeps all schedule/PR state as in-process
// Maps (see LocalGitHubService) — a standalone script that builds its own
// container would have its own, disconnected copy of that state. This
// script instead drives the *running* `make dev` server over HTTP so the
// proposal it creates is the one the Admin Proposal Dashboard actually
// shows.
//
// By default it moves CLS_000093 (Prof. Maria Chen, "Análise e Modelos de
// Dados Financeiros") into RM_0124 at TS_FRI_1630_1800 — already occupied
// at that exact room+slot by CLS_000076 (Dr. Liam Jones, "Serviço Social
// com Adultos e Idosos", a different professor, course, and student
// group) — producing exactly one clean, new ROOM_DOUBLE_BOOK conflict and
// nothing else. Deliberately live (not baked into the curated
// iscte-schedule.json baseline): T5 needs the admin to review a
// *submitted proposal* that makes things worse than the published
// baseline, not a conflict already sitting in `main` — baking it into the
// fixture would make this script redundant and would show up in every
// unrelated proposal's conflict count. Also deliberately unrelated to
// CLS_000049 (T3/T4's target class) and CLS_000001/CLS_000002 (the
// group-overlap clash baked into the fixture for T3s). Posts via
// POST /proposals/seed, which — unlike the normal POST /proposals a
// professor uses — skips the "must not make the published schedule
// worse" gate (see ProposalService.submitUnchecked for why that gate
// makes a genuinely BLOCKED proposal otherwise unreachable through the
// app).
//
// The target class/room/time-slot are overridable via env vars so the
// same script works against any MOCK_FIXTURE_SET, not just 'iscte'. For
// the default mock fixture (MOCK_FIXTURE_SET=mock/unset), the equivalent
// independent conflict is CLS_000002 (Prof. Alan Jones, "Empreendedorismo
// Lecture - Section A") moved onto RM_0003 at TS_MON_1030_1215, already
// occupied by CLS_000009 (Dr. Bob Chen, "Contabilidade Avançada Tutorial
// - Section A") — independent of CLS_000001/CLS_000004, the room-double-
// book clash baked into that fixture for T3:
//
//   TARGET_CLASS_ID=CLS_000002 CONFLICTING_ROOM_ID=RM_0003 \
//     CONFLICTING_TIME_SLOT_ID=TS_MON_1030_1215 pnpm run seed:blocked-proposal
//
// Usage:
//   pnpm run seed:blocked-proposal
// Requires `make dev` (or `make dev-backend`) already running with
// GITHUB_PROVIDER=mock.

const API_BASE = process.env['API_BASE'] ?? 'http://localhost:3000/api/v1';

const TARGET_CLASS_ID = process.env['TARGET_CLASS_ID'] ?? 'CLS_000093';
const CONFLICTING_ROOM_ID = process.env['CONFLICTING_ROOM_ID'] ?? 'RM_0124';
const CONFLICTING_TIME_SLOT_ID = process.env['CONFLICTING_TIME_SLOT_ID'] ?? 'TS_FRI_1630_1800';

interface SimulationCreateResponse {
  readonly id: string;
  readonly baseScheduleVersion: string;
}

interface ProposalResponse {
  readonly id: string;
  readonly status: string;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${path} failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<T>;
}

async function patchJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PATCH ${path} failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<T>;
}

async function main(): Promise<void> {
  console.log(`Seeding a BLOCKED demo proposal against ${API_BASE}...`);

  const simulation = await postJson<SimulationCreateResponse>('/simulations', {
    userId: 'cw-facilitator-seed',
  });
  console.log(`Created simulation ${simulation.id}`);

  await patchJson(`/simulations/${simulation.id}/classes/${TARGET_CLASS_ID}`, {
    roomId: CONFLICTING_ROOM_ID,
    timeSlotIds: [CONFLICTING_TIME_SLOT_ID],
  });
  console.log(`Moved ${TARGET_CLASS_ID} onto ${CONFLICTING_ROOM_ID}/${CONFLICTING_TIME_SLOT_ID} (now double-booked)`);

  await postJson(`/simulations/${simulation.id}/commit`, {});

  const proposal = await postJson<ProposalResponse>('/proposals/seed', {
    simulationId: simulation.id,
    description:
      'Demo: moved a Financial Data Analysis class into a room/time already used by a Social Work class, for cognitive-walkthrough T5 setup.',
    baseScheduleVersion: simulation.baseScheduleVersion,
  });

  console.log(`Created proposal ${proposal.id} with status ${proposal.status}`);
  if (proposal.status !== 'BLOCKED') {
    console.warn(
      'Expected status BLOCKED — got something else. The active fixture may have changed, or ' +
        `TARGET_CLASS_ID/CONFLICTING_ROOM_ID/CONFLICTING_TIME_SLOT_ID don't match a real ` +
        `occupied slot; check the fixture named by MOCK_FIXTURE_SET still has another class in ` +
        `${CONFLICTING_ROOM_ID} at ${CONFLICTING_TIME_SLOT_ID}.`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(`Done. Open the Admin Proposal Dashboard and look for proposal ${proposal.id}.`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
