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
// It moves CLS_00002 (Prof. Alan Jones, Modern History Lecture) into
// RM_103 — already occupied at the same time slot (TS_MON_P2) by CLS_00009
// (Dr. Bob Chen, different professor and student group) — producing
// exactly one clean, new ROOM_DOUBLE_BOOK conflict and nothing else (no
// professor/group overlap, since the two classes share neither), left
// deliberately unrelated to CLS_00001/CLS_00004's pre-existing seeded
// conflict (the T3/T4 professor tasks target CLS_00001; this leaves it
// untouched) and posts it via POST /proposals/seed, which — unlike the
// normal POST /proposals a professor uses — skips the "must not make the
// published schedule worse" gate (see ProposalService.submitUnchecked for
// why that gate makes a genuinely BLOCKED proposal otherwise unreachable
// through the app).
//
// Usage:
//   pnpm run seed:blocked-proposal
// Requires `make dev` (or `make dev-backend`) already running with
// GITHUB_PROVIDER=mock (the default).

const API_BASE = process.env['API_BASE'] ?? 'http://localhost:3000/api/v1';

const TARGET_CLASS_ID = 'CLS_00002';
const CONFLICTING_ROOM_ID = 'RM_103';

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
  });
  console.log(`Moved ${TARGET_CLASS_ID} into ${CONFLICTING_ROOM_ID} (same time slot, now double-booked)`);

  await postJson(`/simulations/${simulation.id}/commit`, {});

  const proposal = await postJson<ProposalResponse>('/proposals/seed', {
    simulationId: simulation.id,
    description:
      'Demo: moved Organic Chemistry Lab into a room/time already used by Cell Biology Lab, for cognitive-walkthrough T5 setup.',
    baseScheduleVersion: simulation.baseScheduleVersion,
  });

  console.log(`Created proposal ${proposal.id} with status ${proposal.status}`);
  if (proposal.status !== 'BLOCKED') {
    console.warn(
      'Expected status BLOCKED — got something else. The baseline schedule may have changed; ' +
        'check backend/src/fixtures/mock-schedule.json still has CLS_00009 in RM_103 at TS_MON_P2.',
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
