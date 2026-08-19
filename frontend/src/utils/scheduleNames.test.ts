import { describe, it, expect } from 'vitest';
import { buildScheduleNames, FORMATTER_NAMES } from './scheduleNames';
import type { RawRoom, RawProfessor, RawCourse, RawStudentGroup } from '@/types';

const ROOM: RawRoom = { id: 'RM_101', name: 'Room 101', capacity: 40, building: 'Main' };
const PROFESSOR: RawProfessor = { id: 'PRF_00001', name: 'Dr. Jane Smith', department: 'Biology' };
const COURSE: RawCourse = { id: 'CRS_0001', code: 'BIO101', name: 'Introduction to Biology', department: 'Biology' };
const GROUP: RawStudentGroup = { id: 'GRP_BIO_Y1', name: 'Bio Year 1', size: 30 };

describe('buildScheduleNames', () => {
  it('resolves the real name from the roster for each entity type', () => {
    const names = buildScheduleNames([ROOM], [PROFESSOR], [COURSE], [GROUP]);

    expect(names.roomName('RM_101')).toBe('Room 101');
    expect(names.professorName('PRF_00001')).toBe('Dr. Jane Smith');
    expect(names.courseName('CRS_0001')).toBe('Introduction to Biology');
    expect(names.courseCode('CRS_0001')).toBe('BIO101');
    expect(names.groupName('GRP_BIO_Y1')).toBe('Bio Year 1');
  });

  it('is exactly what fixes the reported bug — an opaque generated ID resolves to a real name, not a number', () => {
    const names = buildScheduleNames([], [PROFESSOR], [COURSE], []);

    // Without the roster, formatProfessorLabel('PRF_00001') would be "00001".
    expect(names.professorName('PRF_00001')).toBe('Dr. Jane Smith');
    expect(names.professorName('PRF_00001')).not.toBe('00001');
  });

  it('falls back to the ID-parsing formatter for an ID not in the roster (stale reference)', () => {
    const names = buildScheduleNames([ROOM], [PROFESSOR], [COURSE], [GROUP]);

    expect(names.roomName('RM_999')).toBe('Room 999');
    expect(names.professorName('PRF_DOE')).toBe('Doe');
    expect(names.courseCode('CRS_UNKNOWN')).toBe('UNKNOWN');
  });

  it('degrades to exactly the formatter fallback when the roster is entirely empty', () => {
    const empty = buildScheduleNames([], [], [], []);

    expect(empty.roomName('RM_101')).toBe(FORMATTER_NAMES.roomName('RM_101'));
    expect(empty.professorName('PRF_SMITH')).toBe(FORMATTER_NAMES.professorName('PRF_SMITH'));
    expect(empty.courseName('CRS_BIO101')).toBe(FORMATTER_NAMES.courseName('CRS_BIO101'));
    expect(empty.courseCode('CRS_BIO101')).toBe(FORMATTER_NAMES.courseCode('CRS_BIO101'));
    expect(empty.groupName('GRP_BIO_Y1')).toBe(FORMATTER_NAMES.groupName('GRP_BIO_Y1'));
  });
});
