import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import scheduleReducer, { fetchScheduleThunk } from './scheduleSlice';
import { simulationService } from '@/services/simulationService';
import type { RawRoom, RawStudentGroup } from '@/types';

vi.mock('@/services/simulationService', () => ({
  simulationService: {
    getSchedule: vi.fn(),
  },
}));

const ROOM: RawRoom = { id: 'RM_101', name: 'Room 101', capacity: 40, building: 'Building A' };
const GROUP: RawStudentGroup = { id: 'GRP_BIO_Y1', name: 'Bio Year 1', size: 32 };

const makeStore = () => configureStore({ reducer: { schedule: scheduleReducer } });

describe('scheduleSlice', () => {
  beforeEach(() => vi.clearAllMocks());

  it('starts with empty rooms/studentGroups and loading=false', () => {
    const store = makeStore();
    expect(store.getState().schedule).toEqual({
      rooms: [], studentGroups: [], loading: false, error: null,
    });
  });

  it('sets loading=true while fetchScheduleThunk is pending', () => {
    vi.mocked(simulationService.getSchedule).mockReturnValue(new Promise(() => {}));
    const store = makeStore();
    void store.dispatch(fetchScheduleThunk('sim-1'));
    expect(store.getState().schedule.loading).toBe(true);
  });

  it('stores rooms and studentGroups on fulfilled', async () => {
    vi.mocked(simulationService.getSchedule).mockResolvedValue({
      metadata: {}, courses: [], professors: [], timeSlots: [], classes: [],
      rooms: [ROOM], studentGroups: [GROUP],
    });
    const store = makeStore();
    await store.dispatch(fetchScheduleThunk('sim-1'));

    expect(store.getState().schedule).toEqual({
      rooms: [ROOM], studentGroups: [GROUP], loading: false, error: null,
    });
  });

  it('sets an error message on rejected', async () => {
    vi.mocked(simulationService.getSchedule).mockRejectedValue({ message: 'Failed to load schedule' });
    const store = makeStore();
    await store.dispatch(fetchScheduleThunk('sim-1'));

    expect(store.getState().schedule.loading).toBe(false);
    expect(store.getState().schedule.error).toBe('Failed to load schedule');
  });
});
