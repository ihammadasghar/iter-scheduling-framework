import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createAppWithContainer } from '../app.js';
import type { Container } from '../container.js';

// This suite complements simulationFlow.e2e.test.ts (the baseline happy-path
// smoke test) by proving two things that test doesn't touch:
//
//  1. The RQ2/G2 institution-defined weighted score (GraphService.scoreTimetable,
//     driven by backend/src/fixtures/mock-rules.json) is computed consistently
//     across all three places it's exposed over HTTP — the live simulation
//     session, a BLOCKED proposal, and a READY proposal — and is unaffected by
//     an edit that only resolves a hard conflict (informational, not gating).
//  2. The CI-blocked branch of the pipeline: submitting a proposal while a
//     conflict is still present yields status BLOCKED, merging a BLOCKED
//     proposal is rejected with 409, and fixing + resubmitting reaches READY
//     and merges successfully.
//  3. ProposalService's submission gate (conflicts must reduce vs. `main`,
//     or — with conflicts unchanged — the weighted score must change): the
//     BLOCKED submission above only clears the gate because step 3b changes
//     the score while deliberately leaving the seeded conflict untouched;
//     leaving both conflicts *and* score identical to `main` would be
//     rejected with 409 before a PR is even opened.
//  4. GET /proposals/:id's `comparison` field (ProposalService.
//     computeScheduleComparison): baseline (main) vs. candidate score and
//     conflicts, the conflict delta, and the class-level diff, computed
//     against the real seeded fixture rather than mocks.
//
// Note on "resubmit": there is no endpoint to re-run CI on an existing PR
// (routes/proposals.ts only has POST /, GET /, GET /:id, POST /:id/merge,
// POST /:id/reject), so "fix and resubmit" here opens a second, independent
// PR for the same simulation branch — the first (BLOCKED) PR is left open.
// This mirrors the real API today, not docs/sequence-diagram.md's "same PR"
// re-run framing.
//
// The fixture also carries a second, permanent conflict unrelated to this
// test's own scenario — a GROUP_OVERLAP (CLS_000007/CLS_000011, group GA1)
// seeded for the cognitive-walkthrough Student persona's task (T3s in
// thesis/cognitive-walkthrough-protocol.md). This test never fixes it, so it
// shows up unchanged in every conflicts/comparison assertion below —
// asserted on explicitly so a future fixture change that accidentally
// resolves or removes it doesn't pass silently.
//
// Out of scope here (already-known, lower-priority gaps): PROFESSOR_OVERLAP
// and capacity conflict types, and the proposal-reject flow — neither is
// part of this pass.

describe('scoring + CI-blocked/fixed proposal loop (e2e, mock GitHub + real Memgraph)', () => {
  let app: Express;
  let container: Container;

  beforeAll(() => {
    process.env['GITHUB_PROVIDER'] = 'mock';
    ({ app, container } = createAppWithContainer());
  });

  afterAll(async () => {
    await container.shutdown();
  });

  it('exposes a consistent RQ2 weighted score across the session, a BLOCKED proposal, and a READY proposal, and enforces the blocked -> fix -> ready -> merge loop', async () => {
    // 1. Create a simulation — hydrates the mock schedule.json into Memgraph
    const createRes = await request(app)
      .post('/api/v1/simulations')
      .send({ userId: 'e2e-scoring' })
      .expect(201);
    const simulationId = createRes.body.id as string;
    const baseScheduleVersion = createRes.body.baseScheduleVersion as string;
    expect(simulationId).toMatch(/^sim-e2e-scoring-/);

    // 2. RQ2 score for the seeded fixture, computed from mock-rules.json against
    //    mock-schedule.json: Room Utilization = 11 occupied / (4 rooms * 5 slots)
    //    = 55% (threshold 80 -> normalizedScore 68.75); Average Classes per
    //    Professor per Day = 11 classes / 8 distinct (professor, day) pairs =
    //    1.38 (threshold 4 -> normalizedScore 34.5); weighted average (both
    //    weight 1) = (68.75 + 34.5) / 2 = 51.625 -> rounded to 51.63.
    const scoreBeforeRes = await request(app)
      .get(`/api/v1/simulations/${simulationId}/score`)
      .expect(200);
    expect(scoreBeforeRes.body.score).toBe(51.63);
    expect(scoreBeforeRes.body.breakdown).toEqual([
      {
        name: 'Room Utilization',
        value: 55,
        unit: '%',
        weight: 1,
        threshold: 80,
        normalizedScore: 68.75,
      },
      {
        name: 'Average Classes per Professor per Day',
        value: 1.38,
        unit: 'classes/day',
        weight: 1,
        threshold: 4,
        normalizedScore: 34.5,
      },
    ]);

    // 3. Confirm the deliberate seeded conflicts are present — the room
    //    double-booking this test drives through the BLOCKED -> fix -> READY
    //    loop, plus a second, unrelated, permanent GROUP_OVERLAP
    //    (CLS_000007/CLS_000011, group GA1) that this test never touches and
    //    that therefore persists through every step below. Do NOT fix the
    //    room conflict yet, so the next proposal submission exercises the
    //    BLOCKED branch.
    const conflictsBeforeRes = await request(app)
      .get(`/api/v1/simulations/${simulationId}/conflicts`)
      .expect(200);
    expect(conflictsBeforeRes.body).toHaveLength(2);
    expect(conflictsBeforeRes.body[0]).toMatchObject({
      type: 'ROOM_DOUBLE_BOOK',
      classIds: ['CLS_000001', 'CLS_000004'],
    });
    expect(conflictsBeforeRes.body[1]).toMatchObject({
      type: 'GROUP_OVERLAP',
      classIds: ['CLS_000007', 'CLS_000011'],
    });

    // 3b. Submission is now gated (see ProposalService.assertImprovesOnPublished):
    //     a proposal is only accepted if it reduces conflicts vs. `main`, or
    //     — with conflicts unchanged — moves the weighted metric score. Leaving
    //     the seeded conflict untouched wouldn't satisfy either branch, so
    //     move CLS_000009 to PRF_00001: it doesn't touch CLS_000001/CLS_000004
    //     or CLS_000007/CLS_000011 (both conflicting pairs stay exactly as-is)
    //     or create any new conflict (PRF_00001 has no class at MON_1030_1215),
    //     but it does change the professor/day grouping — PRF_00003 loses
    //     their only Monday class, PRF_00001 already teaches Monday, so
    //     distinct (professor, day) pairs drops from 8 to 7 and the "Average
    //     Classes per Professor per Day" metric moves from 1.38 to 1.57 —
    //     satisfying the gate's "conflicts unchanged, score changed" branch
    //     without touching either conflict this step is meant to exercise.
    await request(app)
      .patch(`/api/v1/simulations/${simulationId}/classes/CLS_000009`)
      .send({ professorId: 'PRF_00001' })
      .expect(200);

    const conflictsStillPresentRes = await request(app)
      .get(`/api/v1/simulations/${simulationId}/conflicts`)
      .expect(200);
    expect(conflictsStillPresentRes.body).toHaveLength(2);
    expect(conflictsStillPresentRes.body[0]).toMatchObject({
      type: 'ROOM_DOUBLE_BOOK',
      classIds: ['CLS_000001', 'CLS_000004'],
    });
    expect(conflictsStillPresentRes.body[1]).toMatchObject({
      type: 'GROUP_OVERLAP',
      classIds: ['CLS_000007', 'CLS_000011'],
    });

    const scoreAfterReassignRes = await request(app)
      .get(`/api/v1/simulations/${simulationId}/score`)
      .expect(200);
    expect(scoreAfterReassignRes.body).not.toEqual(scoreBeforeRes.body);
    expect(scoreAfterReassignRes.body).toEqual({
      score: 54,
      breakdown: [
        {
          name: 'Room Utilization',
          value: 55,
          unit: '%',
          weight: 1,
          threshold: 80,
          normalizedScore: 68.75,
        },
        {
          name: 'Average Classes per Professor per Day',
          value: 1.57,
          unit: 'classes/day',
          weight: 1,
          threshold: 4,
          normalizedScore: 39.25,
        },
      ],
    });

    // 4. Commit the still-conflicted (but now score-changed) schedule to the
    //    simulation's mock branch
    await request(app).post(`/api/v1/simulations/${simulationId}/commit`).expect(200);

    // 5. Submit as a proposal while the conflict is still present — CI must
    //    block it. The submission itself is allowed by the gate because the
    //    metric score above changed even though conflicts didn't.
    const blockedProposalRes = await request(app)
      .post('/api/v1/proposals')
      .send({ simulationId, description: 'Still has the 2E02 double-booking', baseScheduleVersion })
      .expect(201);
    expect(blockedProposalRes.body.status).toBe('BLOCKED');
    const blockedProposalId = blockedProposalRes.body.id as string;

    // 6. The score is still computed and surfaced on a BLOCKED proposal — it's
    //    informational and doesn't depend on conflict status. It reflects the
    //    professor reassignment from step 3b, not the original baseline score.
    const blockedDetailRes = await request(app)
      .get(`/api/v1/proposals/${blockedProposalId}`)
      .expect(200);
    expect(blockedDetailRes.body.status).toBe('BLOCKED');
    expect(blockedDetailRes.body.score).toEqual(scoreAfterReassignRes.body);

    // 6b. `comparison` compares this candidate against `main`, which hasn't
    //     been touched by anything yet (no proposal has merged). Baseline
    //     score/conflicts equal the very first values read in step 2/3;
    //     candidate score/conflicts equal the reassigned-but-still-conflicted
    //     values from step 3b — both seeded conflicts are present on both
    //     sides, so neither shows up in `added` nor `resolved`.
    expect(blockedDetailRes.body.comparison.baselineScore).toEqual(scoreBeforeRes.body);
    expect(blockedDetailRes.body.comparison.candidateScore).toEqual(scoreAfterReassignRes.body);
    expect(blockedDetailRes.body.comparison.baselineConflicts).toHaveLength(2);
    expect(blockedDetailRes.body.comparison.candidateConflicts).toHaveLength(2);
    expect(blockedDetailRes.body.comparison.conflictDelta).toEqual({ added: [], resolved: [] });

    // 6c. The class-level diff surfaces the step 3b reassignment — including
    //     the professorId field change that diffParser.ts's old 3-field
    //     whitelist already covered, now computed from parsed JSON rather
    //     than git-text diffing.
    const cls9Change = blockedDetailRes.body.comparison.classDiff.changed.find(
      (c: { classId: string }) => c.classId === 'CLS_000009',
    );
    expect(cls9Change).toBeDefined();
    expect(cls9Change.fieldChanges).toContainEqual({
      field: 'professorId', before: 'PRF_00003', after: 'PRF_00001',
    });
    expect(blockedDetailRes.body.comparison.classDiff.added).toEqual([]);
    expect(blockedDetailRes.body.comparison.classDiff.removed).toEqual([]);

    // 7. Merging a BLOCKED proposal must be rejected
    const rejectedMergeRes = await request(app)
      .post(`/api/v1/proposals/${blockedProposalId}/merge`)
      .expect(409);
    expect(rejectedMergeRes.body.error.code).toBe('CONFLICT');
    expect(rejectedMergeRes.body.error.message).toMatch(/not READY to merge/);

    // 8. Fix the conflict — move CLS_000004 to a free room
    await request(app)
      .patch(`/api/v1/simulations/${simulationId}/classes/CLS_000004`)
      .send({ roomId: 'RM_0004' })
      .expect(200);

    // 9. Confirm the room conflict is gone — the unrelated, permanent
    //    GROUP_OVERLAP (CLS_000007/CLS_000011) is untouched by this room-only
    //    edit and remains.
    const conflictsAfterRes = await request(app)
      .get(`/api/v1/simulations/${simulationId}/conflicts`)
      .expect(200);
    expect(conflictsAfterRes.body).toHaveLength(1);
    expect(conflictsAfterRes.body[0]).toMatchObject({
      type: 'GROUP_OVERLAP',
      classIds: ['CLS_000007', 'CLS_000011'],
    });

    // 10. The score is unchanged by this step — a room-only edit doesn't
    //     affect utilization (still 11 occupied slots) or professor/day
    //     counts. It stays at the value from the step 3b reassignment, not
    //     the original pre-reassignment baseline.
    const scoreAfterRes = await request(app)
      .get(`/api/v1/simulations/${simulationId}/score`)
      .expect(200);
    expect(scoreAfterRes.body).toEqual(scoreAfterReassignRes.body);

    // 11. Commit the fix
    await request(app).post(`/api/v1/simulations/${simulationId}/commit`).expect(200);

    // 12. Resubmit — opens a second, independent PR for the same simulation
    //     branch (see top-of-file note); this one should be READY
    const readyProposalRes = await request(app)
      .post('/api/v1/proposals')
      .send({ simulationId, description: 'Resolved the 2E02 double-booking', baseScheduleVersion })
      .expect(201);
    expect(readyProposalRes.body.status).toBe('READY');
    const readyProposalId = readyProposalRes.body.id as string;

    // 13. Score is consistent across the session, the BLOCKED proposal, and
    //     this READY proposal — three independently-computed call sites
    //     converging on the same number.
    const readyDetailRes = await request(app)
      .get(`/api/v1/proposals/${readyProposalId}`)
      .expect(200);
    expect(readyDetailRes.body.status).toBe('READY');
    expect(readyDetailRes.body.score).toEqual(scoreAfterReassignRes.body);

    // 13b. `main` is still untouched (no proposal has merged yet), so the
    //      baseline side of the comparison still carries both original seeded
    //      conflicts — while the candidate side has fixed the room
    //      double-booking and still carries the unrelated, unresolved
    //      GROUP_OVERLAP. This is the "resolved" half of the conflict delta.
    expect(readyDetailRes.body.comparison.baselineConflicts).toHaveLength(2);
    expect(readyDetailRes.body.comparison.candidateConflicts).toHaveLength(1);
    expect(readyDetailRes.body.comparison.candidateConflicts[0]).toMatchObject({
      type: 'GROUP_OVERLAP',
      classIds: ['CLS_000007', 'CLS_000011'],
    });
    expect(readyDetailRes.body.comparison.conflictDelta.added).toEqual([]);
    expect(readyDetailRes.body.comparison.conflictDelta.resolved).toHaveLength(1);
    expect(readyDetailRes.body.comparison.conflictDelta.resolved[0]).toMatchObject({
      type: 'ROOM_DOUBLE_BOOK',
      classIds: ['CLS_000001', 'CLS_000004'],
    });

    // 14. Merge the ready proposal
    const mergeRes = await request(app)
      .post(`/api/v1/proposals/${readyProposalId}/merge`)
      .expect(200);
    expect(mergeRes.body.status).toBe('MERGED');

    // 15. The first (BLOCKED) proposal was never silently mutated by the
    //     second submission
    const blockedStillRes = await request(app)
      .get(`/api/v1/proposals/${blockedProposalId}`)
      .expect(200);
    expect(blockedStillRes.body.status).toBe('BLOCKED');
  });
});
