import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import scheduleReducer, { fetchScheduleThunk, fetchPublishedScheduleThunk } from './scheduleSlice';
import { simulationService } from '@/services/simulationService';
import { scheduleService } from '@/services/scheduleService';
import type { RawRoom, RawStudentGroup, RawCourse, RawProfessor, RawTimeSlot } from '@/types';

vi.mock('@/services/simulationService', () => ({
  simulationService: {
    getSchedule: vi.fn(),
  },
}));
vi.mock('@/services/scheduleService', () => ({
  scheduleService: {
    getPublishedRoster: vi.fn(),
  },
}));

const ROOM: RawRoom = { id: 'RM_101', name: 'Room 101', capacity: 40, building: 'Building A' };
const GROUP: RawStudentGroup = { id: 'GRP_BIO_Y1', name: 'Bio Year 1', size: 32 };
const COURSE: RawCourse = { id: 'CRS_BIO101', code: 'BIO101', name: 'Intro to Biology', department: 'Biology' };
const PROFESSOR: RawProfessor = { id: 'PRF_SMITH', name: 'Dr. Jane Smith', department: 'Biology' };
const TIME_SLOT: RawTimeSlot = { id: 'TS_MON_P1', day: 'Monday', name: 'Period 1', startTime: '08:30', endTime: '10:15' };

const makeStore = () => configureStore({ reducer: { schedule: scheduleReducer } });

describe('scheduleSlice', () => {
  beforeEach(() => vi.clearAllMocks());

  it('starts with empty rooms/studentGroups/courses/professors and loading=false', () => {
    const store = makeStore();
    expect(store.getState().schedule).toEqual({
      rooms: [], studentGroups: [], courses: [], professors: [], timeSlots: [], loading: false, error: null,
    });
  });

  describe('fetchScheduleThunk (simulation roster)', () => {
    it('sets loading=true while pending', () => {
      vi.mocked(simulationService.getSchedule).mockReturnValue(new Promise(() => {}));
      const store = makeStore();
      void store.dispatch(fetchScheduleThunk('sim-1'));
      expect(store.getState().schedule.loading).toBe(true);
    });

    it('stores rooms, studentGroups, courses, professors, and timeSlots on fulfilled', async () => {
      vi.mocked(simulationService.getSchedule).mockResolvedValue({
        metadata: { semesterId: 'sem-1', semesterName: 'Fall 2026', academicYear: '2026-2027' },
        timeSlots: [TIME_SLOT], classes: [],
        rooms: [ROOM], studentGroups: [GROUP], courses: [COURSE], professors: [PROFESSOR],
      });
      const store = makeStore();
      await store.dispatch(fetchScheduleThunk('sim-1'));

      expect(store.getState().schedule).toEqual({
        rooms: [ROOM], studentGroups: [GROUP], courses: [COURSE], professors: [PROFESSOR],
        timeSlots: [TIME_SLOT],
        loading: false, error: null,
      });
    });

    // Regression guard: courses/professors/timeSlots were previously
    // destructured out and discarded here, which is exactly what caused real
    // names (and calendar geometry) to never reach the UI even though the
    // backend already returned them.
    it('does not discard courses/professors/timeSlots from the response', async () => {
      vi.mocked(simulationService.getSchedule).mockResolvedValue({
        metadata: { semesterId: 'sem-1', semesterName: 'Fall 2026', academicYear: '2026-2027' },
        timeSlots: [TIME_SLOT], classes: [], rooms: [], studentGroups: [],
        courses: [COURSE], professors: [PROFESSOR],
      });
      const store = makeStore();
      await store.dispatch(fetchScheduleThunk('sim-1'));

      expect(store.getState().schedule.courses).toEqual([COURSE]);
      expect(store.getState().schedule.professors).toEqual([PROFESSOR]);
      expect(store.getState().schedule.timeSlots).toEqual([TIME_SLOT]);
    });

    it('sets an error message on rejected', async () => {
      vi.mocked(simulationService.getSchedule).mockRejectedValue({ message: 'Failed to load schedule' });
      const store = makeStore();
      await store.dispatch(fetchScheduleThunk('sim-1'));

      expect(store.getState().schedule.loading).toBe(false);
      expect(store.getState().schedule.error).toBe('Failed to load schedule');
    });
  });

  describe('fetchPublishedScheduleThunk (published/read-only roster)', () => {
    it('sets loading=true while pending', () => {
      vi.mocked(scheduleService.getPublishedRoster).mockReturnValue(new Promise(() => {}));
      const store = makeStore();
      void store.dispatch(fetchPublishedScheduleThunk());
      expect(store.getState().schedule.loading).toBe(true);
    });

    it('stores rooms, studentGroups, courses, professors, and timeSlots on fulfilled', async () => {
      vi.mocked(scheduleService.getPublishedRoster).mockResolvedValue({
        metadata: { semesterId: 'sem-1', semesterName: 'Fall 2026', academicYear: '2026-2027' },
        timeSlots: [TIME_SLOT],
        rooms: [ROOM], studentGroups: [GROUP], courses: [COURSE], professors: [PROFESSOR],
      });
      const store = makeStore();
      await store.dispatch(fetchPublishedScheduleThunk());

      expect(store.getState().schedule).toEqual({
        rooms: [ROOM], studentGroups: [GROUP], courses: [COURSE], professors: [PROFESSOR],
        timeSlots: [TIME_SLOT],
        loading: false, error: null,
      });
    });

    it('sets an error message on rejected', async () => {
      vi.mocked(scheduleService.getPublishedRoster).mockRejectedValue({ message: 'Failed to load schedule' });
      const store = makeStore();
      await store.dispatch(fetchPublishedScheduleThunk());

      expect(store.getState().schedule.loading).toBe(false);
      expect(store.getState().schedule.error).toBe('Failed to load schedule');
    });
  });
});
