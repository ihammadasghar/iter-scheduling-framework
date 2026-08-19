import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createAppWithContainer } from '../app.js';
import type { Container } from '../container.js';

describe('simulation flow (e2e, mock GitHub + real Memgraph)', () => {
  let app: Express;
  let container: Container;

  beforeAll(() => {
    process.env['GITHUB_PROVIDER'] = 'mock';
    ({ app, container } = createAppWithContainer());
  });

  afterAll(async () => {
    await container.shutdown();
  });

  it('creates a simulation, resolves the seeded conflict, commits, and merges a ready proposal', async () => {
    // 1. Create a simulation — hydrates the mock schedule.json into Memgraph
    const createRes = await request(app)
      .post('/api/v1/simulations')
      .send({ userId: 'e2e-test' })
      .expect(201);

    const simulationId = createRes.body.id as string;
    expect(simulationId).toMatch(/^sim-e2e-test-/);

    // 2. Confirm the seeded classes are visible
    const classesRes = await request(app)
      .get(`/api/v1/simulations/${simulationId}/classes`)
      .expect(200);
    expect(classesRes.body.total).toBe(10);

    // 3. Confirm the deliberate seeded conflict (CLS_00001 vs CLS_00004 in RM_101) is detected
    const conflictsBeforeRes = await request(app)
      .get(`/api/v1/simulations/${simulationId}/conflicts`)
      .expect(200);
    expect(conflictsBeforeRes.body).toHaveLength(1);
    expect(conflictsBeforeRes.body[0]).toMatchObject({
      type: 'ROOM_DOUBLE_BOOK',
      classIds: ['CLS_00001', 'CLS_00004'],
    });

    // 4. Move CLS_00004 to a free room (RM_104 is unused at TS_MON_P1) to resolve the conflict
    await request(app)
      .patch(`/api/v1/simulations/${simulationId}/classes/CLS_00004`)
      .send({ roomId: 'RM_104' })
      .expect(200);

    // 5. Confirm the conflict is gone
    const conflictsAfterRes = await request(app)
      .get(`/api/v1/simulations/${simulationId}/conflicts`)
      .expect(200);
    expect(conflictsAfterRes.body).toHaveLength(0);

    // 6. Commit the change back to the simulation's mock branch
    await request(app)
      .post(`/api/v1/simulations/${simulationId}/commit`)
      .expect(200);

    // 7. Submit as a proposal — runs the CI pipeline against the mock GitHub branch
    const proposalRes = await request(app)
      .post('/api/v1/proposals')
      .send({ simulationId, description: 'Resolved the Room 101 double-booking' })
      .expect(201);
    expect(proposalRes.body.status).toBe('READY');
    const proposalId = proposalRes.body.id as string;

    // 8. Merge the ready proposal
    const mergeRes = await request(app)
      .post(`/api/v1/proposals/${proposalId}/merge`)
      .expect(200);
    expect(mergeRes.body.status).toBe('MERGED');
  });
});
