import { describe, it, expect } from 'vitest';
import {
  sortTimeSlotIds,
  formatTimeSlotLabel,
  formatRoomLabel,
  formatProfessorLabel,
  formatGroupLabel,
  formatCourseLabel,
} from './scheduleFormatters';

describe('sortTimeSlotIds', () => {
  it('sorts Monday before Tuesday', () => {
    const result = sortTimeSlotIds(['TS_TUE_P1', 'TS_MON_P2', 'TS_MON_P1']);
    expect(result).toEqual(['TS_MON_P1', 'TS_MON_P2', 'TS_TUE_P1']);
  });

  it('sorts periods numerically within same day', () => {
    const result = sortTimeSlotIds(['TS_MON_P10', 'TS_MON_P2', 'TS_MON_P1']);
    expect(result).toEqual(['TS_MON_P1', 'TS_MON_P2', 'TS_MON_P10']);
  });

  it('sorts full week in correct order', () => {
    const ids = ['TS_FRI_P1', 'TS_MON_P1', 'TS_WED_P1', 'TS_TUE_P1', 'TS_THU_P1'];
    const result = sortTimeSlotIds(ids);
    expect(result[0]).toBe('TS_MON_P1');
    expect(result[4]).toBe('TS_FRI_P1');
  });

  it('does not mutate the input array', () => {
    const ids = ['TS_TUE_P1', 'TS_MON_P1'];
    const frozen = Object.freeze([...ids]);
    expect(() => sortTimeSlotIds(frozen)).not.toThrow();
  });
});

describe('formatTimeSlotLabel', () => {
  it('formats TS_MON_P1 → "Mon P1"', () => {
    expect(formatTimeSlotLabel('TS_MON_P1')).toBe('Mon P1');
  });

  it('formats TS_WED_P3 → "Wed P3"', () => {
    expect(formatTimeSlotLabel('TS_WED_P3')).toBe('Wed P3');
  });
});

describe('formatRoomLabel', () => {
  it('formats numeric room RM_101 → "Room 101"', () => {
    expect(formatRoomLabel('RM_101')).toBe('Room 101');
  });

  it('formats named room RM_LAB_A → "Lab A"', () => {
    expect(formatRoomLabel('RM_LAB_A')).toBe('Lab A');
  });
});

describe('formatProfessorLabel', () => {
  it('formats PRF_SMITH → "Smith"', () => {
    expect(formatProfessorLabel('PRF_SMITH')).toBe('Smith');
  });
});

describe('formatGroupLabel', () => {
  it('formats GRP_BIO_Y1 → "Bio Y1"', () => {
    expect(formatGroupLabel('GRP_BIO_Y1')).toBe('Bio Y1');
  });
});

describe('formatCourseLabel', () => {
  it('formats CRS_BIO101 → "BIO101"', () => {
    expect(formatCourseLabel('CRS_BIO101')).toBe('BIO101');
  });
});
