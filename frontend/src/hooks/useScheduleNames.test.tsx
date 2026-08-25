import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { useScheduleNames } from './useScheduleNames';
import scheduleReducer from '@/store/reducers/scheduleSlice';
import classReducer from '@/store/reducers/classSlice';
import type { RawProfessor } from '@/types';

const PROFESSOR: RawProfessor = { id: 'PRF_00001', name: 'Dr. Jane Smith', department: 'Biology' };

const makeStore = () =>
  configureStore({
    reducer: { schedule: scheduleReducer, class: classReducer },
    preloadedState: {
      schedule: { rooms: [], studentGroups: [], courses: [], professors: [PROFESSOR], loading: false, error: null },
    },
  });

describe('useScheduleNames', () => {
  it('resolves real names from the store roster', () => {
    const store = makeStore();
    const { result } = renderHook(() => useScheduleNames(), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    });

    expect(result.current.professorName('PRF_00001')).toBe('Dr. Jane Smith');
  });

  // The whole point of building this through createSelector (rather than an
  // inline per-render selector) is that every one of the many ClassChip
  // instances on a large schedule shares one memoized result instead of
  // rebuilding the lookup maps on every render.
  it('returns a referentially stable object across re-renders when the roster has not changed', () => {
    const store = makeStore();
    const { result, rerender } = renderHook(() => useScheduleNames(), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    });

    const first = result.current;
    rerender();
    const second = result.current;

    expect(second).toBe(first);
  });

  it('returns a new object once the roster in the store actually changes', () => {
    const store = makeStore();
    const { result, rerender } = renderHook(() => useScheduleNames(), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    });

    const first = result.current;
    store.dispatch({
      type: 'schedule/fetchPublished/fulfilled',
      payload: { rooms: [], studentGroups: [], courses: [], professors: [] },
    });
    rerender();

    expect(result.current).not.toBe(first);
  });
});
