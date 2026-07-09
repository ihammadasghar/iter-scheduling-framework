import { describe, it, expect } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import conflictReducer, { fetchConflictsThunk, clearConflicts } from './conflictSlice';
import type { Conflict } from '@/types';

const fakeConflict: Conflict = {
  id: 'c1',
  type: 'ROOM_DOUBLE_BOOK',
  classIds: ['CLS_001', 'CLS_002'],
  message: 'Room overlap',
};

const makeStore = () => configureStore({ reducer: { conflict: conflictReducer } });

describe('conflictSlice', () => {
  it('initialises with no conflicts', () => {
    const store = makeStore();
    expect(store.getState().conflict.conflicts).toEqual([]);
    expect(store.getState().conflict.lastFetchedAt).toBeNull();
  });

  it('fetchConflictsThunk.pending sets loading true', () => {
    const store = makeStore();
    store.dispatch(fetchConflictsThunk.pending('r', 'sim-1'));
    expect(store.getState().conflict.loading).toBe(true);
  });

  it('fetchConflictsThunk.fulfilled stores conflicts and sets lastFetchedAt', () => {
    const store = makeStore();
    const before = Date.now();
    store.dispatch(fetchConflictsThunk.fulfilled([fakeConflict], 'r', 'sim-1'));
    const state = store.getState().conflict;
    expect(state.loading).toBe(false);
    expect(state.conflicts).toHaveLength(1);
    expect(state.conflicts[0].type).toBe('ROOM_DOUBLE_BOOK');
    expect(state.lastFetchedAt).toBeGreaterThanOrEqual(before);
  });

  it('fetchConflictsThunk.fulfilled with empty array clears conflicts', () => {
    const store = makeStore();
    store.dispatch(fetchConflictsThunk.fulfilled([fakeConflict], 'r', 'sim-1'));
    store.dispatch(fetchConflictsThunk.fulfilled([], 'r2', 'sim-1'));
    expect(store.getState().conflict.conflicts).toHaveLength(0);
  });

  it('fetchConflictsThunk.rejected sets error', () => {
    const store = makeStore();
    const error = { statusCode: 500, code: 'INTERNAL_SERVER_ERROR', message: 'Network failed' };
    store.dispatch(fetchConflictsThunk.rejected(null, 'r', 'sim-1', error));
    expect(store.getState().conflict.error).toBe('Network failed');
    expect(store.getState().conflict.loading).toBe(false);
  });

  it('clearConflicts resets to initial state', () => {
    const store = makeStore();
    store.dispatch(fetchConflictsThunk.fulfilled([fakeConflict], 'r', 'sim-1'));
    store.dispatch(clearConflicts());
    const state = store.getState().conflict;
    expect(state.conflicts).toHaveLength(0);
    expect(state.lastFetchedAt).toBeNull();
  });
});
