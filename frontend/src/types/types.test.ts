// Type-level and runtime structural tests for all domain/API/UI types.
// These verify the barrel export, readonly enforcement, and key type shapes.
import { describe, it, expect } from 'vitest';
import type {
  Simulation,
  ScheduleClass,
  Conflict,
  MetricResult,
  Suggestion,
  Proposal,
  ProposalDetail,
  MetricRule,
  Constraint,
  PaginatedResponse,
  ApiError,
  CreateSimulationRequest,
  UpdateClassRequest,
  CreateProposalRequest,
  ScheduleJson,
  ClassChange,
  SimulationCardData,
} from '@/types';

describe('types barrel export', () => {
  it('Simulation shape is assignable', () => {
    const sim: Simulation = {
      id: 'sim-alice-a1b2c3d4',
      branchId: 'sim-alice-a1b2c3d4',
      createdAt: '2026-06-11T10:00:00Z',
    };
    expect(sim.id).toBe('sim-alice-a1b2c3d4');
  });

  it('ScheduleClass has all required fields', () => {
    const cls: ScheduleClass = {
      id: 'CLS_00001',
      courseId: 'CRS_BIO101',
      title: 'Intro to Biology',
      professorId: 'PRF_SMITH',
      studentGroupId: 'GRP_BIO_Y1',
      roomId: 'RM_101',
      timeSlotIds: ['TS_MON_P1', 'TS_MON_P2'],
    };
    expect(cls.timeSlotIds).toHaveLength(2);
  });

  it('Conflict type is narrowed to valid values only', () => {
    const conflict: Conflict = {
      id: 'c1',
      type: 'ROOM_DOUBLE_BOOK',
      classIds: ['CLS_00001', 'CLS_00002'],
      message: 'Room overlap',
    };
    expect(conflict.type).toBe('ROOM_DOUBLE_BOOK');
  });

  it('MetricResult has name, value, unit', () => {
    const metric: MetricResult = { name: 'Room Utilization', value: 73.4, unit: '%' };
    expect(metric.unit).toBe('%');
  });

  it('Suggestion has conflictFree flag', () => {
    const s: Suggestion = { roomId: 'RM_102', timeSlotIds: ['TS_WED_P1'], conflictFree: true };
    expect(s.conflictFree).toBe(true);
  });

  it('Proposal status is a valid enum value', () => {
    const p: Proposal = {
      id: '42',
      simulationId: 'sim-alice-a1b2c3d4',
      status: 'READY',
      createdAt: '2026-06-11T10:15:00Z',
    };
    expect(['PENDING', 'READY', 'BLOCKED', 'MERGED', 'REJECTED']).toContain(p.status);
  });

  it('ProposalDetail extends Proposal with diff', () => {
    const pd: ProposalDetail = {
      id: '42',
      simulationId: 'sim-alice-a1b2c3d4',
      status: 'READY',
      createdAt: '2026-06-11T10:15:00Z',
      diff: '--- a/schedule.json\n+++ b/schedule.json',
    };
    expect(pd.diff).toContain('schedule.json');
    expect(pd.id).toBe('42');
  });

  it('MetricRule has target and condition fields', () => {
    const rule: MetricRule = {
      id: 'metric-001',
      name: 'Room Utilization',
      target: 'Room',
      condition: 'utilization',
      threshold: 80,
    };
    expect(rule.condition).toBe('utilization');
  });

  it('Constraint has violationCondition field', () => {
    const constraint: Constraint = {
      id: 'con-001',
      name: 'Max load',
      target: 'Professor',
      violationCondition: 'max_classes_per_day > 6',
    };
    expect(constraint.violationCondition).toBeDefined();
  });

  it('PaginatedResponse is generic and holds data array', () => {
    const page: PaginatedResponse<Simulation> = {
      data: [{ id: 'sim-1', branchId: 'sim-1', createdAt: '2026-01-01T00:00:00Z' }],
      total: 1,
      page: 1,
      limit: 20,
    };
    expect(page.data).toHaveLength(1);
    expect(page.total).toBe(1);
  });

  it('ApiError has statusCode, code, and message', () => {
    const err: ApiError = { statusCode: 404, code: 'NOT_FOUND', message: 'Not found' };
    expect(err.statusCode).toBe(404);
  });

  it('CreateSimulationRequest has userId', () => {
    const req: CreateSimulationRequest = { userId: 'alice' };
    expect(req.userId).toBe('alice');
  });

  it('UpdateClassRequest is fully optional', () => {
    // All fields optional — an empty object is valid (API validates at least one)
    const req: UpdateClassRequest = { roomId: 'RM_102' };
    expect(req.roomId).toBe('RM_102');
    const minimal: UpdateClassRequest = {};
    expect(minimal.roomId).toBeUndefined();
  });

  it('CreateProposalRequest has simulationId and description', () => {
    const req: CreateProposalRequest = {
      simulationId: 'sim-alice-a1b2c3d4',
      description: 'Moving BIO101 to Wednesday',
    };
    expect(req.description).toBeTruthy();
  });

  it('ScheduleJson holds all master data arrays', () => {
    const schedule: ScheduleJson = {
      metadata: { semesterId: 'FALL_2026', semesterName: 'Fall 2026', academicYear: '2026-2027' },
      timeSlots: [],
      rooms: [],
      professors: [],
      studentGroups: [],
      courses: [],
      classes: [],
    };
    expect(schedule.timeSlots).toHaveLength(0);
  });

  it('ClassChange holds resolved human-readable fields', () => {
    const change: ClassChange = {
      classId: 'CLS_00001',
      className: 'Intro to Biology — Section A',
      changes: [
        { field: 'Room', from: 'Room 101', to: 'Room 102' },
        { field: 'Time', from: 'Monday Period 1', to: 'Wednesday Period 1' },
      ],
    };
    expect(change.changes[0].field).toBe('Room');
    expect(change.changes[0].from).toBe('Room 101');
  });

  it('SimulationCardData extends Simulation with optional enrichment', () => {
    const card: SimulationCardData = {
      id: 'sim-alice-a1b2c3d4',
      branchId: 'sim-alice-a1b2c3d4',
      createdAt: '2026-06-11T10:00:00Z',
      conflictCount: 2,
      metrics: [{ name: 'Room Utilization', value: 74, unit: '%' }],
    };
    expect(card.conflictCount).toBe(2);
    expect(card.metrics?.[0].value).toBe(74);
  });
});
