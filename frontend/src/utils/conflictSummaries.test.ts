import { describe, it, expect } from 'vitest';
import { createIntl } from 'react-intl';
import { buildConflictSummaries } from './conflictSummaries';
import { FORMATTER_NAMES } from './scheduleNames';
import type { Conflict, ScheduleClass } from '@/types';

const intl = createIntl({ locale: 'en', messages: {} });

const classA: ScheduleClass = {
  id: 'CLS_001', courseId: 'CRS_BIO101', title: 'Biology', professorId: 'PRF_SMITH',
  studentGroupId: 'GRP_BIO_Y1', roomId: 'RM_101', timeSlotIds: ['TS_MON_P1'],
};
const classB: ScheduleClass = {
  id: 'CLS_002', courseId: 'CRS_HIS201', title: 'History', professorId: 'PRF_JONES',
  studentGroupId: 'GRP_HIS_Y1', roomId: 'RM_101', timeSlotIds: ['TS_MON_P1'],
};

describe('buildConflictSummaries', () => {
  it('produces a plain-English summary for each conflicted class', () => {
    const conflict: Conflict = {
      id: 'c1', type: 'ROOM_DOUBLE_BOOK', classIds: ['CLS_001', 'CLS_002'], message: '',
    };
    const summaries = buildConflictSummaries(intl, [conflict], [classA, classB], FORMATTER_NAMES);
    expect(summaries.get('CLS_001')).toMatch(/booked for two classes/i);
    expect(summaries.get('CLS_002')).toMatch(/booked for two classes/i);
  });

  it('appends a "+N more" suffix when a class has multiple conflicts', () => {
    const conflicts: Conflict[] = [
      { id: 'c1', type: 'ROOM_DOUBLE_BOOK', classIds: ['CLS_001', 'CLS_002'], message: '' },
      { id: 'c2', type: 'PROFESSOR_OVERLAP', classIds: ['CLS_001', 'CLS_002'], message: '' },
    ];
    const summaries = buildConflictSummaries(intl, conflicts, [classA, classB], FORMATTER_NAMES);
    expect(summaries.get('CLS_001')).toContain('+1 more');
  });

  it('returns an empty map for no conflicts', () => {
    expect(buildConflictSummaries(intl, [], [classA], FORMATTER_NAMES).size).toBe(0);
  });
});
