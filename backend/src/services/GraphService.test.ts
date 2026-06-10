import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GraphService } from './GraphService.js';
import type { IMemgraphClient } from '../clients/IMemgraphClient.js';

const BRANCH_ID = 'sim-test-1';

const VALID_SCHEDULE_JSON = JSON.stringify({
  metadata: {},
  courses: [{ id: 'CRS_001', code: 'BIO101', name: 'Intro to Biology', department: 'Biology' }],
  professors: [{ id: 'PRF_001', name: 'Dr. Smith', department: 'Biology' }],
  studentGroups: [{ id: 'GRP_001', name: 'Bio Year 1', size: 40 }],
  rooms: [{ id: 'RM_101', name: 'Room 101', capacity: 50, building: 'Science Hall' }],
  timeSlots: [
    { id: 'TS_MON_P1', day: 'Monday', name: 'Period 1', startTime: '08:30', endTime: '10:15' },
  ],
  classes: [
    {
      id: 'CLS_001',
      courseId: 'CRS_001',
      title: 'Biology Lecture',
      professorId: 'PRF_001',
      studentGroupId: 'GRP_001',
      roomId: 'RM_101',
      timeSlotIds: ['TS_MON_P1'],
    },
  ],
});

describe('GraphService', () => {
  let mockClient: IMemgraphClient;
  let service: GraphService;

  beforeEach(() => {
    mockClient = { run: vi.fn().mockResolvedValue([]), close: vi.fn() };
    service = new GraphService(mockClient);
  });

  // ── hydrate ────────────────────────────────────────────────────────────────

  it('hydrate() calls client.run() once per batch (12 total)', async () => {
    await service.hydrate(BRANCH_ID, VALID_SCHEDULE_JSON);
    expect(mockClient.run).toHaveBeenCalledTimes(12);
  });

  it('hydrate() passes branchId in params of every batch', async () => {
    await service.hydrate(BRANCH_ID, VALID_SCHEDULE_JSON);
    const calls = (mockClient.run as ReturnType<typeof vi.fn>).mock.calls as Array<
      [string, Record<string, unknown>]
    >;
    calls.forEach(([, params]) => {
      expect(params['branchId']).toBe(BRANCH_ID);
    });
  });

  it('hydrate() throws a 400 ApiError when scheduleJson is invalid', async () => {
    await expect(service.hydrate(BRANCH_ID, 'bad-json{')).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(mockClient.run).not.toHaveBeenCalled();
  });

  // ── flush ──────────────────────────────────────────────────────────────────

  it('flush() runs a DETACH DELETE query scoped to the branchId', async () => {
    await service.flush(BRANCH_ID);
    expect(mockClient.run).toHaveBeenCalledOnce();
    const [cypher, params] = (mockClient.run as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(cypher).toContain('DETACH DELETE');
    expect(params['branchId']).toBe(BRANCH_ID);
  });
});
