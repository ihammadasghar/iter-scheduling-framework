import { describe, it, expect } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import sessionReducer, {
  setSession,
  clearSession,
  markExpired,
  markHeartbeat,
  setHasUnsavedChanges,
} from './sessionSlice';
import classReducer, { updateClassThunk, commitSimulationThunk } from './classSlice';
import type { ScheduleClass } from '@/types';

const fakeClass: ScheduleClass = {
  id: 'CLS_001',
  courseId: 'CRS_BIO101',
  title: 'Biology',
  professorId: 'PRF_SMITH',
  studentGroupId: 'GRP_BIO_Y1',
  roomId: 'RM_102',
  timeSlotIds: ['TS_MON_P1'],
};

// Store must include both slices so extraReducers can react to class actions
const makeStore = () =>
  configureStore({ reducer: { session: sessionReducer, class: classReducer } });

describe('sessionSlice', () => {
  it('initialises with no session', () => {
    const store = makeStore();
    const state = store.getState().session;
    expect(state.simulationId).toBeNull();
    expect(state.expired).toBe(false);
    expect(state.hasUnsavedChanges).toBe(false);
  });

  it('setSession stores simulationId and resets flags', () => {
    const store = makeStore();
    store.dispatch(setSession('sim-alice-a1b2c3d4'));
    const state = store.getState().session;
    expect(state.simulationId).toBe('sim-alice-a1b2c3d4');
    expect(state.expired).toBe(false);
    expect(state.hasUnsavedChanges).toBe(false);
  });

  it('clearSession nulls out simulationId and flags', () => {
    const store = makeStore();
    store.dispatch(setSession('sim-1'));
    store.dispatch(markExpired());
    store.dispatch(clearSession());
    const state = store.getState().session;
    expect(state.simulationId).toBeNull();
    expect(state.expired).toBe(false);
  });

  it('markExpired sets expired to true', () => {
    const store = makeStore();
    store.dispatch(markExpired());
    expect(store.getState().session.expired).toBe(true);
  });

  it('markHeartbeat updates lastHeartbeat timestamp', () => {
    const store = makeStore();
    const before = Date.now();
    store.dispatch(markHeartbeat());
    expect(store.getState().session.lastHeartbeat).toBeGreaterThanOrEqual(before);
  });

  it('setHasUnsavedChanges can set and unset the flag', () => {
    const store = makeStore();
    store.dispatch(setHasUnsavedChanges(true));
    expect(store.getState().session.hasUnsavedChanges).toBe(true);
    store.dispatch(setHasUnsavedChanges(false));
    expect(store.getState().session.hasUnsavedChanges).toBe(false);
  });

  it('updateClassThunk.fulfilled sets hasUnsavedChanges to true', () => {
    const store = makeStore();
    store.dispatch(
      updateClassThunk.fulfilled(fakeClass, 'r', {
        simId: 'sim-1',
        classId: 'CLS_001',
        params: { roomId: 'RM_102' },
      }),
    );
    expect(store.getState().session.hasUnsavedChanges).toBe(true);
  });

  it('commitSimulationThunk.fulfilled sets hasUnsavedChanges to false', () => {
    const store = makeStore();
    // First mark as having changes
    store.dispatch(setHasUnsavedChanges(true));
    expect(store.getState().session.hasUnsavedChanges).toBe(true);

    // Commit clears it
    store.dispatch(commitSimulationThunk.fulfilled(undefined, 'r', 'sim-1'));
    expect(store.getState().session.hasUnsavedChanges).toBe(false);
  });

  it('PATCH → hasUnsavedChanges=true; commit → hasUnsavedChanges=false (full lifecycle)', () => {
    const store = makeStore();
    store.dispatch(setSession('sim-1'));

    store.dispatch(
      updateClassThunk.fulfilled(fakeClass, 'r1', {
        simId: 'sim-1',
        classId: 'CLS_001',
        params: { roomId: 'RM_102' },
      }),
    );
    expect(store.getState().session.hasUnsavedChanges).toBe(true);

    store.dispatch(commitSimulationThunk.fulfilled(undefined, 'r2', 'sim-1'));
    expect(store.getState().session.hasUnsavedChanges).toBe(false);
  });
});
