import { describe, it, expect, vi, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import classReducer, {
  fetchClassesPage,
  updateClassThunk,
  commitSimulationThunk,
  resetClasses,
} from './classSlice';
import type { ScheduleClass } from '@/types';

const makeClass = (id: string, roomId = 'RM_101'): ScheduleClass => ({
  id,
  courseId: 'CRS_BIO101',
  title: `Class ${id}`,
  professorId: 'PRF_SMITH',
  studentGroupId: 'GRP_BIO_Y1',
  roomId,
  timeSlotIds: ['TS_MON_P1'],
});

const makeStore = () => configureStore({ reducer: { class: classReducer } });

describe('classSlice', () => {
  afterEach(() => vi.restoreAllMocks());

  it('initialises with empty classes', () => {
    const store = makeStore();
    expect(store.getState().class.classes).toEqual([]);
    expect(store.getState().class.hasMore).toBe(true);
  });

  it('fetchClassesPage.pending sets loading true', () => {
    const store = makeStore();
    store.dispatch(fetchClassesPage.pending('r', { simId: 'sim-1', page: 1 }));
    expect(store.getState().class.loading).toBe(true);
  });

  it('fetchClassesPage.fulfilled appends classes without duplicates', () => {
    const store = makeStore();
    const page1 = { classes: [makeClass('CLS_001'), makeClass('CLS_002')], total: 3, page: 1 };
    store.dispatch(fetchClassesPage.fulfilled(page1, 'r1', { simId: 'sim-1', page: 1 }));
    expect(store.getState().class.classes).toHaveLength(2);

    const page2 = { classes: [makeClass('CLS_003')], total: 3, page: 2 };
    store.dispatch(fetchClassesPage.fulfilled(page2, 'r2', { simId: 'sim-1', page: 2 }));
    expect(store.getState().class.classes).toHaveLength(3);
  });

  it('fetchClassesPage.fulfilled does not add duplicate class IDs', () => {
    const store = makeStore();
    const page = { classes: [makeClass('CLS_001')], total: 1, page: 1 };
    store.dispatch(fetchClassesPage.fulfilled(page, 'r1', { simId: 'sim-1', page: 1 }));
    store.dispatch(fetchClassesPage.fulfilled(page, 'r2', { simId: 'sim-1', page: 1 }));
    expect(store.getState().class.classes).toHaveLength(1);
  });

  it('fetchClassesPage.fulfilled sets hasMore correctly', () => {
    const store = makeStore();
    const page = { classes: [makeClass('CLS_001')], total: 1, page: 1 };
    store.dispatch(fetchClassesPage.fulfilled(page, 'r1', { simId: 'sim-1', page: 1 }));
    expect(store.getState().class.hasMore).toBe(false);
  });

  it('updateClassThunk.fulfilled replaces the updated class in state', () => {
    const store = makeStore();
    const page = { classes: [makeClass('CLS_001', 'RM_101')], total: 1, page: 1 };
    store.dispatch(fetchClassesPage.fulfilled(page, 'r', { simId: 'sim-1', page: 1 }));

    const updated = makeClass('CLS_001', 'RM_102');
    store.dispatch(
      updateClassThunk.fulfilled(updated, 'u', { simId: 'sim-1', classId: 'CLS_001', params: { roomId: 'RM_102' } }),
    );
    expect(store.getState().class.classes[0].roomId).toBe('RM_102');
  });

  it('updateClassThunk.rejected sets error', () => {
    const store = makeStore();
    const error = { statusCode: 404, code: 'NOT_FOUND', message: 'Class not found' };
    store.dispatch(
      updateClassThunk.rejected(null, 'u', { simId: 'sim-1', classId: 'CLS_001', params: {} }, error),
    );
    expect(store.getState().class.error).toBe('Class not found');
  });

  it('resetClasses clears all class state', () => {
    const store = makeStore();
    const page = { classes: [makeClass('CLS_001')], total: 1, page: 1 };
    store.dispatch(fetchClassesPage.fulfilled(page, 'r', { simId: 'sim-1', page: 1 }));
    store.dispatch(resetClasses());
    const state = store.getState().class;
    expect(state.classes).toHaveLength(0);
    expect(state.total).toBe(0);
    expect(state.hasMore).toBe(true);
  });

  it('updateClassThunk async dispatches and updates store', async () => {
    const { simulationService } = await import('@/services/simulationService');
    const updated = makeClass('CLS_001', 'RM_102');
    vi.spyOn(simulationService, 'updateClass').mockResolvedValue(updated);

    const store = makeStore();
    const page = { classes: [makeClass('CLS_001', 'RM_101')], total: 1, page: 1 };
    store.dispatch(fetchClassesPage.fulfilled(page, 'r', { simId: 'sim-1', page: 1 }));

    await store.dispatch(updateClassThunk({ simId: 'sim-1', classId: 'CLS_001', params: { roomId: 'RM_102' } }));
    expect(store.getState().class.classes[0].roomId).toBe('RM_102');
  });

  it('commitSimulationThunk async resolves without affecting classes', async () => {
    const { simulationService } = await import('@/services/simulationService');
    vi.spyOn(simulationService, 'commitSimulation').mockResolvedValue(undefined);

    const store = makeStore();
    const result = await store.dispatch(commitSimulationThunk('sim-1'));
    expect(result.type).toBe('class/commit/fulfilled');
  });
});
