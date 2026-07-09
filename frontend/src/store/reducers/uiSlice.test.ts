import { describe, it, expect } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import uiReducer, {
  selectClass,
  deselectClass,
  toggleInspector,
  setRole,
  setViewBy,
} from './uiSlice';

const makeStore = () => configureStore({ reducer: { ui: uiReducer } });

describe('uiSlice', () => {
  it('initialises with default state', () => {
    const store = makeStore();
    const state = store.getState().ui;
    expect(state.selectedClassId).toBeNull();
    expect(state.inspectorOpen).toBe(false);
    expect(state.role).toBe('user');
    expect(state.viewBy).toBe('room');
  });

  it('selectClass sets selectedClassId and opens inspector', () => {
    const store = makeStore();
    store.dispatch(selectClass('CLS_001'));
    expect(store.getState().ui.selectedClassId).toBe('CLS_001');
    expect(store.getState().ui.inspectorOpen).toBe(true);
  });

  it('deselectClass clears selectedClassId and closes inspector', () => {
    const store = makeStore();
    store.dispatch(selectClass('CLS_001'));
    store.dispatch(deselectClass());
    expect(store.getState().ui.selectedClassId).toBeNull();
    expect(store.getState().ui.inspectorOpen).toBe(false);
  });

  it('toggleInspector(true) opens inspector', () => {
    const store = makeStore();
    store.dispatch(toggleInspector(true));
    expect(store.getState().ui.inspectorOpen).toBe(true);
  });

  it('toggleInspector(false) closes inspector and clears selected class', () => {
    const store = makeStore();
    store.dispatch(selectClass('CLS_001'));
    store.dispatch(toggleInspector(false));
    expect(store.getState().ui.inspectorOpen).toBe(false);
    expect(store.getState().ui.selectedClassId).toBeNull();
  });

  it('setRole switches to admin', () => {
    const store = makeStore();
    store.dispatch(setRole('admin'));
    expect(store.getState().ui.role).toBe('admin');
  });

  it('setRole switches back to user', () => {
    const store = makeStore();
    store.dispatch(setRole('admin'));
    store.dispatch(setRole('user'));
    expect(store.getState().ui.role).toBe('user');
  });

  it('setViewBy changes the view mode', () => {
    const store = makeStore();
    store.dispatch(setViewBy('professor'));
    expect(store.getState().ui.viewBy).toBe('professor');
    store.dispatch(setViewBy('studentGroup'));
    expect(store.getState().ui.viewBy).toBe('studentGroup');
  });
});
