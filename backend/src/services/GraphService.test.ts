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

  // ── updateClass ───────────────────────────────────────────────────────────

  describe('updateClass()', () => {
    const CLASS_ID = 'CLS_001';
    const UPDATED_CLASS = {
      id: CLASS_ID,
      courseId: 'CRS_001',
      title: 'Biology Lecture',
      professorId: 'PRF_001',
      studentGroupId: 'GRP_001',
      roomId: 'RM_102',
      timeSlotIds: ['TS_MON_P2'],
    };

    it('runs a HELD_IN mutation when roomId is patched', async () => {
      mockClient = {
        run: vi.fn()
          .mockResolvedValueOnce([]) // room mutation
          .mockResolvedValueOnce([{ class: UPDATED_CLASS }]), // re-fetch
        close: vi.fn(),
      };
      service = new GraphService(mockClient);

      await service.updateClass(BRANCH_ID, CLASS_ID, { roomId: 'RM_102' });

      const calls = (mockClient.run as ReturnType<typeof vi.fn>).mock.calls as Array<[string, Record<string, unknown>]>;
      expect(calls).toHaveLength(2);
      expect(calls[0]![0]).toContain('HELD_IN');
      expect(calls[0]![1]).toMatchObject({ classId: CLASS_ID, roomId: 'RM_102', branchId: BRANCH_ID });
    });

    it('runs a SCHEDULED_AT mutation when timeSlotIds is patched', async () => {
      mockClient = {
        run: vi.fn()
          .mockResolvedValueOnce([]) // timeslot mutation
          .mockResolvedValueOnce([{ class: UPDATED_CLASS }]), // re-fetch
        close: vi.fn(),
      };
      service = new GraphService(mockClient);

      await service.updateClass(BRANCH_ID, CLASS_ID, { timeSlotIds: ['TS_MON_P2'] });

      const calls = (mockClient.run as ReturnType<typeof vi.fn>).mock.calls as Array<[string, Record<string, unknown>]>;
      expect(calls).toHaveLength(2);
      expect(calls[0]![0]).toContain('SCHEDULED_AT');
      expect(calls[0]![1]).toMatchObject({ classId: CLASS_ID, timeSlotIds: ['TS_MON_P2'], branchId: BRANCH_ID });
    });

    it('runs a TAUGHT_BY mutation when professorId is patched', async () => {
      mockClient = {
        run: vi.fn()
          .mockResolvedValueOnce([]) // professor mutation
          .mockResolvedValueOnce([{ class: UPDATED_CLASS }]), // re-fetch
        close: vi.fn(),
      };
      service = new GraphService(mockClient);

      await service.updateClass(BRANCH_ID, CLASS_ID, { professorId: 'PRF_002' });

      const calls = (mockClient.run as ReturnType<typeof vi.fn>).mock.calls as Array<[string, Record<string, unknown>]>;
      expect(calls).toHaveLength(2);
      expect(calls[0]![0]).toContain('TAUGHT_BY');
      expect(calls[0]![1]).toMatchObject({ classId: CLASS_ID, professorId: 'PRF_002', branchId: BRANCH_ID });
    });

    it('runs all three mutations when all fields are patched', async () => {
      mockClient = {
        run: vi.fn()
          .mockResolvedValueOnce([]) // room mutation
          .mockResolvedValueOnce([]) // timeslot mutation
          .mockResolvedValueOnce([]) // professor mutation
          .mockResolvedValueOnce([{ class: UPDATED_CLASS }]), // re-fetch
        close: vi.fn(),
      };
      service = new GraphService(mockClient);

      await service.updateClass(BRANCH_ID, CLASS_ID, {
        roomId: 'RM_102',
        timeSlotIds: ['TS_MON_P2'],
        professorId: 'PRF_002',
      });

      expect(mockClient.run).toHaveBeenCalledTimes(4);
    });

    it('returns the updated ScheduleClass after mutations', async () => {
      mockClient = {
        run: vi.fn()
          .mockResolvedValueOnce([]) // room mutation
          .mockResolvedValueOnce([{ class: UPDATED_CLASS }]), // re-fetch
        close: vi.fn(),
      };
      service = new GraphService(mockClient);

      const result = await service.updateClass(BRANCH_ID, CLASS_ID, { roomId: 'RM_102' });

      expect(result).toMatchObject({ id: CLASS_ID, roomId: 'RM_102' });
    });

    it('throws 404 ApiError if class is not found after update', async () => {
      mockClient = {
        run: vi.fn()
          .mockResolvedValueOnce([]) // room mutation
          .mockResolvedValueOnce([]), // re-fetch returns empty
        close: vi.fn(),
      };
      service = new GraphService(mockClient);

      await expect(
        service.updateClass(BRANCH_ID, 'NON_EXISTENT', { roomId: 'RM_102' }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  // ── exportScheduleJson ────────────────────────────────────────────────────

  describe('exportScheduleJson()', () => {
    const EXPORT_ROWS = {
      course: { course: { id: 'CRS_001', code: 'BIO101', name: 'Intro to Biology', department: 'Biology' } },
      professor: { professor: { id: 'PRF_001', name: 'Dr. Smith', department: 'Biology' } },
      studentGroup: { studentGroup: { id: 'GRP_001', name: 'Bio Year 1', size: 40 } },
      room: { room: { id: 'RM_101', name: 'Room 101', capacity: 50, building: 'Science Hall' } },
      timeSlot: { timeSlot: { id: 'TS_MON_P1', day: 'Monday', name: 'Period 1', startTime: '08:30', endTime: '10:15' } },
      class: { class: { id: 'CLS_001', courseId: 'CRS_001', title: 'Biology Lecture', professorId: 'PRF_001', studentGroupId: 'GRP_001', roomId: 'RM_101', timeSlotIds: ['TS_MON_P1'] } },
    };

    beforeEach(() => {
      mockClient = {
        run: vi.fn()
          .mockResolvedValueOnce([EXPORT_ROWS.course])        // courses
          .mockResolvedValueOnce([EXPORT_ROWS.professor])     // professors
          .mockResolvedValueOnce([EXPORT_ROWS.studentGroup])  // studentGroups
          .mockResolvedValueOnce([EXPORT_ROWS.room])          // rooms
          .mockResolvedValueOnce([EXPORT_ROWS.timeSlot])      // timeSlots
          .mockResolvedValueOnce([EXPORT_ROWS.class]),        // classes
        close: vi.fn(),
      };
      service = new GraphService(mockClient);
    });

    it('calls client.run() exactly 6 times (once per entity type)', async () => {
      await service.exportScheduleJson(BRANCH_ID);
      expect(mockClient.run).toHaveBeenCalledTimes(6);
    });

    it('passes branchId in params of every query', async () => {
      await service.exportScheduleJson(BRANCH_ID);
      const calls = (mockClient.run as ReturnType<typeof vi.fn>).mock.calls as Array<
        [string, Record<string, unknown>]
      >;
      calls.forEach(([, params]) => {
        expect(params['branchId']).toBe(BRANCH_ID);
      });
    });

    it('returns valid JSON that parses to a ScheduleJson shape', async () => {
      const result = await service.exportScheduleJson(BRANCH_ID);
      const parsed = JSON.parse(result) as Record<string, unknown>;

      expect(parsed).toHaveProperty('metadata');
      expect(parsed).toHaveProperty('courses');
      expect(parsed).toHaveProperty('professors');
      expect(parsed).toHaveProperty('studentGroups');
      expect(parsed).toHaveProperty('rooms');
      expect(parsed).toHaveProperty('timeSlots');
      expect(parsed).toHaveProperty('classes');
    });

    it('maps each entity correctly into its array', async () => {
      const result = await service.exportScheduleJson(BRANCH_ID);
      const parsed = JSON.parse(result) as {
        courses: unknown[]; professors: unknown[]; studentGroups: unknown[];
        rooms: unknown[]; timeSlots: unknown[]; classes: unknown[];
      };

      expect(parsed.courses).toHaveLength(1);
      expect(parsed.professors).toHaveLength(1);
      expect(parsed.studentGroups).toHaveLength(1);
      expect(parsed.rooms).toHaveLength(1);
      expect(parsed.timeSlots).toHaveLength(1);
      expect(parsed.classes).toHaveLength(1);
    });

    it('includes timeSlotIds on class entries', async () => {
      const result = await service.exportScheduleJson(BRANCH_ID);
      const parsed = JSON.parse(result) as { classes: Array<{ timeSlotIds: string[] }> };
      expect(parsed.classes[0]?.timeSlotIds).toEqual(['TS_MON_P1']);
    });

    it('returns empty arrays when the graph has no data', async () => {
      mockClient = {
        run: vi.fn().mockResolvedValue([]),
        close: vi.fn(),
      };
      service = new GraphService(mockClient);

      const result = await service.exportScheduleJson(BRANCH_ID);
      const parsed = JSON.parse(result) as Record<string, unknown[]>;

      expect(parsed['courses']).toHaveLength(0);
      expect(parsed['classes']).toHaveLength(0);
    });
  });

  // ── queryConflicts ────────────────────────────────────────────────────────

  describe('queryConflicts()', () => {
    const ROOM_ROW = { classId1: 'CLS_001', classId2: 'CLS_002', resourceName: 'Room 101' };
    const PROF_ROW = { classId1: 'CLS_001', classId2: 'CLS_003', resourceName: 'Dr. Smith' };
    const GROUP_ROW = { classId1: 'CLS_002', classId2: 'CLS_003', resourceName: 'Bio Year 1' };

    it('calls client.run() exactly 3 times (one per constraint type)', async () => {
      mockClient = {
        run: vi.fn().mockResolvedValue([]),
        close: vi.fn(),
      };
      service = new GraphService(mockClient);

      await service.queryConflicts(BRANCH_ID);

      expect(mockClient.run).toHaveBeenCalledTimes(3);
    });

    it('passes branchId in params of every query', async () => {
      mockClient = {
        run: vi.fn().mockResolvedValue([]),
        close: vi.fn(),
      };
      service = new GraphService(mockClient);

      await service.queryConflicts(BRANCH_ID);

      const calls = (mockClient.run as ReturnType<typeof vi.fn>).mock.calls as Array<
        [string, Record<string, unknown>]
      >;
      calls.forEach(([, params]) => {
        expect(params['branchId']).toBe(BRANCH_ID);
      });
    });

    it('returns empty array when there are no conflicts', async () => {
      mockClient = { run: vi.fn().mockResolvedValue([]), close: vi.fn() };
      service = new GraphService(mockClient);

      const result = await service.queryConflicts(BRANCH_ID);

      expect(result).toEqual([]);
    });

    it('maps a room conflict row to a ROOM_DOUBLE_BOOK Conflict', async () => {
      mockClient = {
        run: vi.fn()
          .mockResolvedValueOnce([ROOM_ROW]) // room query
          .mockResolvedValueOnce([])          // professor query
          .mockResolvedValueOnce([]),         // group query
        close: vi.fn(),
      };
      service = new GraphService(mockClient);

      const result = await service.queryConflicts(BRANCH_ID);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'ROOM_DOUBLE_BOOK_CLS_001_CLS_002',
        type: 'ROOM_DOUBLE_BOOK',
        classIds: ['CLS_001', 'CLS_002'],
      });
      expect(result[0]!.message).toContain('Room 101');
    });

    it('maps a professor conflict row to a PROFESSOR_OVERLAP Conflict', async () => {
      mockClient = {
        run: vi.fn()
          .mockResolvedValueOnce([])           // room query
          .mockResolvedValueOnce([PROF_ROW])   // professor query
          .mockResolvedValueOnce([]),           // group query
        close: vi.fn(),
      };
      service = new GraphService(mockClient);

      const result = await service.queryConflicts(BRANCH_ID);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'PROFESSOR_OVERLAP_CLS_001_CLS_003',
        type: 'PROFESSOR_OVERLAP',
        classIds: ['CLS_001', 'CLS_003'],
      });
      expect(result[0]!.message).toContain('Dr. Smith');
    });

    it('maps a group conflict row to a GROUP_OVERLAP Conflict', async () => {
      mockClient = {
        run: vi.fn()
          .mockResolvedValueOnce([])            // room query
          .mockResolvedValueOnce([])            // professor query
          .mockResolvedValueOnce([GROUP_ROW]),  // group query
        close: vi.fn(),
      };
      service = new GraphService(mockClient);

      const result = await service.queryConflicts(BRANCH_ID);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'GROUP_OVERLAP_CLS_002_CLS_003',
        type: 'GROUP_OVERLAP',
        classIds: ['CLS_002', 'CLS_003'],
      });
      expect(result[0]!.message).toContain('Bio Year 1');
    });

    it('returns conflicts from all three types in a single flat array', async () => {
      mockClient = {
        run: vi.fn()
          .mockResolvedValueOnce([ROOM_ROW])
          .mockResolvedValueOnce([PROF_ROW])
          .mockResolvedValueOnce([GROUP_ROW]),
        close: vi.fn(),
      };
      service = new GraphService(mockClient);

      const result = await service.queryConflicts(BRANCH_ID);

      expect(result).toHaveLength(3);
      const types = result.map((c) => c.type);
      expect(types).toContain('ROOM_DOUBLE_BOOK');
      expect(types).toContain('PROFESSOR_OVERLAP');
      expect(types).toContain('GROUP_OVERLAP');
    });
  });

  // ── evaluateMetrics ───────────────────────────────────────────────────────

  describe('evaluateMetrics()', () => {
    const CLASS_COUNT_RULE = {
      id: 'mr-1', name: 'Class Count', target: 'Class', condition: 'count', threshold: 0,
    };
    const PROF_AVG_RULE = {
      id: 'mr-2', name: 'Avg Classes/Day', target: 'Professor', condition: 'avg_classes_per_day', threshold: 0,
    };

    it('returns an empty array when given no rules', async () => {
      const result = await service.evaluateMetrics(BRANCH_ID, []);
      expect(result).toEqual([]);
      expect(mockClient.run).not.toHaveBeenCalled();
    });

    it('calls client.run once per rule', async () => {
      mockClient = {
        run: vi.fn()
          .mockResolvedValueOnce([{ value: 10 }])
          .mockResolvedValueOnce([{ value: 2.5 }]),
        close: vi.fn(),
      };
      service = new GraphService(mockClient);

      await service.evaluateMetrics(BRANCH_ID, [CLASS_COUNT_RULE, PROF_AVG_RULE]);

      expect(mockClient.run).toHaveBeenCalledTimes(2);
    });

    it('passes branchId in params of every query', async () => {
      mockClient = {
        run: vi.fn().mockResolvedValue([{ value: 5 }]),
        close: vi.fn(),
      };
      service = new GraphService(mockClient);

      await service.evaluateMetrics(BRANCH_ID, [CLASS_COUNT_RULE]);

      const calls = (mockClient.run as ReturnType<typeof vi.fn>).mock.calls as Array<
        [string, Record<string, unknown>]
      >;
      expect(calls[0]![1]['branchId']).toBe(BRANCH_ID);
    });

    it('returns MetricResult with correct name, value, and unit', async () => {
      mockClient = {
        run: vi.fn().mockResolvedValue([{ value: 42 }]),
        close: vi.fn(),
      };
      service = new GraphService(mockClient);

      const result = await service.evaluateMetrics(BRANCH_ID, [CLASS_COUNT_RULE]);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ name: 'Class Count', value: 42, unit: 'classes' });
    });

    it('defaults value to 0 when the query returns no rows', async () => {
      mockClient = {
        run: vi.fn().mockResolvedValue([]),
        close: vi.fn(),
      };
      service = new GraphService(mockClient);

      const result = await service.evaluateMetrics(BRANCH_ID, [CLASS_COUNT_RULE]);

      expect(result[0]?.value).toBe(0);
    });

    it('propagates 400 ApiError from translator for unsupported rule', async () => {
      const badRule = { id: 'mr-x', name: 'Bad', target: 'Unknown', condition: 'metric', threshold: 0 };

      await expect(
        service.evaluateMetrics(BRANCH_ID, [badRule]),
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  // ── getSuggestions ────────────────────────────────────────────────────────

  describe('getSuggestions()', () => {
    const CLASS_ID = 'CLS_001';
    const SUGGESTION_ROW = {
      roomId: 'RM_101',
      timeSlotIds: ['TS_MON_P1', 'TS_MON_P2'],
    };

    it('calls client.run() exactly once', async () => {
      mockClient = { run: vi.fn().mockResolvedValue([SUGGESTION_ROW]), close: vi.fn() };
      service = new GraphService(mockClient);

      await service.getSuggestions(BRANCH_ID, CLASS_ID);

      expect(mockClient.run).toHaveBeenCalledOnce();
    });

    it('passes both branchId and classId as params', async () => {
      mockClient = { run: vi.fn().mockResolvedValue([]), close: vi.fn() };
      service = new GraphService(mockClient);

      await service.getSuggestions(BRANCH_ID, CLASS_ID);

      const [, params] = (mockClient.run as ReturnType<typeof vi.fn>).mock.calls[0] as [
        string,
        Record<string, unknown>,
      ];
      expect(params['branchId']).toBe(BRANCH_ID);
      expect(params['classId']).toBe(CLASS_ID);
    });

    it('maps rows to Suggestion objects with conflictFree: true', async () => {
      mockClient = { run: vi.fn().mockResolvedValue([SUGGESTION_ROW]), close: vi.fn() };
      service = new GraphService(mockClient);

      const result = await service.getSuggestions(BRANCH_ID, CLASS_ID);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        roomId: 'RM_101',
        timeSlotIds: ['TS_MON_P1', 'TS_MON_P2'],
        conflictFree: true,
      });
    });

    it('returns an empty array when no conflict-free slots are found', async () => {
      mockClient = { run: vi.fn().mockResolvedValue([]), close: vi.fn() };
      service = new GraphService(mockClient);

      const result = await service.getSuggestions(BRANCH_ID, CLASS_ID);

      expect(result).toEqual([]);
    });

    it('returns multiple suggestions across different rooms', async () => {
      const rows = [
        { roomId: 'RM_101', timeSlotIds: ['TS_MON_P1'] },
        { roomId: 'RM_102', timeSlotIds: ['TS_TUE_P1', 'TS_TUE_P2'] },
      ];
      mockClient = { run: vi.fn().mockResolvedValue(rows), close: vi.fn() };
      service = new GraphService(mockClient);

      const result = await service.getSuggestions(BRANCH_ID, CLASS_ID);

      expect(result).toHaveLength(2);
      expect(result.every((s) => s.conflictFree)).toBe(true);
    });

    it('includes all three constraint checks in the Cypher (HELD_IN, TAUGHT_BY, ATTENDED_BY)', async () => {
      mockClient = { run: vi.fn().mockResolvedValue([]), close: vi.fn() };
      service = new GraphService(mockClient);

      await service.getSuggestions(BRANCH_ID, CLASS_ID);

      const [cypher] = (mockClient.run as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
      expect(cypher).toContain('HELD_IN');
      expect(cypher).toContain('TAUGHT_BY');
      expect(cypher).toContain('ATTENDED_BY');
    });
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
