import { describe, it, expect } from 'vitest';
import { buildClassChanges } from './buildClassChanges';
import { buildScheduleNames } from './scheduleNames';
import type { ChangedClass, RawClass } from '@/types';

const BEFORE: RawClass = {
  id: 'CLS_001',
  courseId: 'CRS_001',
  title: 'Intro to Biology',
  professorId: 'PRF_001',
  studentGroupId: 'GRP_001',
  roomId: 'RM_101',
  timeSlotIds: ['TS_MON_P1'],
};

const NAMES = buildScheduleNames(
  [{ id: 'RM_101', name: 'Room 101', capacity: 50, building: 'Science Hall' },
    { id: 'RM_102', name: 'Room 102', capacity: 40, building: 'Science Hall' }],
  [{ id: 'PRF_001', name: 'Dr. Smith', department: 'Biology' },
    { id: 'PRF_002', name: 'Dr. Jones', department: 'Biology' }],
  [{ id: 'CRS_001', code: 'BIO101', name: 'Biology 101', department: 'Biology' },
    { id: 'CRS_002', code: 'BIO102', name: 'Biology 102', department: 'Biology' }],
  [{ id: 'GRP_001', name: 'Bio Year 1', size: 40 }, { id: 'GRP_002', name: 'Bio Year 2', size: 35 }],
);

describe('buildClassChanges', () => {
  it('returns empty array for no changes', () => {
    expect(buildClassChanges([], NAMES)).toEqual([]);
  });

  it('resolves a roomId change to human-readable room names', () => {
    const changed: ChangedClass[] = [{
      classId: 'CLS_001',
      before: BEFORE,
      after: { ...BEFORE, roomId: 'RM_102' },
      fieldChanges: [{ field: 'roomId', before: 'RM_101', after: 'RM_102' }],
    }];

    const result = buildClassChanges(changed, NAMES);

    expect(result).toEqual([{
      classId: 'CLS_001',
      className: 'Intro to Biology',
      changes: [{ field: 'Room', from: 'Room 101', to: 'Room 102' }],
    }]);
  });

  it('resolves every field type, not just the old 3-field whitelist', () => {
    const after: RawClass = {
      ...BEFORE,
      courseId: 'CRS_002',
      title: 'Advanced Biology',
      professorId: 'PRF_002',
      studentGroupId: 'GRP_002',
    };
    const changed: ChangedClass[] = [{
      classId: 'CLS_001',
      before: BEFORE,
      after,
      fieldChanges: [
        { field: 'courseId', before: 'CRS_001', after: 'CRS_002' },
        { field: 'title', before: BEFORE.title, after: after.title },
        { field: 'professorId', before: 'PRF_001', after: 'PRF_002' },
        { field: 'studentGroupId', before: 'GRP_001', after: 'GRP_002' },
      ],
    }];

    const result = buildClassChanges(changed, NAMES);

    expect(result[0]?.changes).toEqual([
      { field: 'Course', from: 'Biology 101', to: 'Biology 102' },
      { field: 'Title', from: 'Intro to Biology', to: 'Advanced Biology' },
      { field: 'Lecturer', from: 'Dr. Smith', to: 'Dr. Jones' },
      { field: 'Group', from: 'Bio Year 1', to: 'Bio Year 2' },
    ]);
  });

  it('resolves timeSlotIds to a joined, human-readable list', () => {
    const changed: ChangedClass[] = [{
      classId: 'CLS_001',
      before: BEFORE,
      after: { ...BEFORE, timeSlotIds: ['TS_TUE_P2'] },
      fieldChanges: [{ field: 'timeSlotIds', before: ['TS_MON_P1'], after: ['TS_TUE_P2'] }],
    }];

    const result = buildClassChanges(changed, NAMES);

    expect(result[0]?.changes).toEqual([{ field: 'Time', from: 'Monday Period 1', to: 'Tuesday Period 2' }]);
  });

  it('uses className from the after (candidate) class', () => {
    const changed: ChangedClass[] = [{
      classId: 'CLS_001',
      before: BEFORE,
      after: { ...BEFORE, title: 'Renamed Class', roomId: 'RM_102' },
      fieldChanges: [{ field: 'roomId', before: 'RM_101', after: 'RM_102' }],
    }];

    const result = buildClassChanges(changed, NAMES);

    expect(result[0]?.className).toBe('Renamed Class');
  });
});
