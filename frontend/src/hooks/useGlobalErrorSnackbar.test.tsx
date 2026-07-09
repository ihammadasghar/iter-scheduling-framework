import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { useGlobalErrorSnackbar } from './useGlobalErrorSnackbar';
import simulationReducer, { createSimulationThunk } from '@/store/reducers/simulationSlice';
import classReducer from '@/store/reducers/classSlice';
import conflictReducer from '@/store/reducers/conflictSlice';
import metricReducer from '@/store/reducers/metricSlice';
import proposalReducer from '@/store/reducers/proposalSlice';
import rulesReducer from '@/store/reducers/rulesSlice';
import sessionReducer from '@/store/reducers/sessionSlice';
import uiReducer from '@/store/reducers/uiSlice';

const makeStore = (simulationError: string | null = null) =>
  configureStore({
    reducer: {
      simulation: simulationReducer, class: classReducer, conflict: conflictReducer,
      metric: metricReducer, proposal: proposalReducer, rules: rulesReducer,
      session: sessionReducer, ui: uiReducer,
    },
    preloadedState: {
      simulation: { simulations: [], current: null, loading: false, error: simulationError },
    },
  });

const wrapper = (store: ReturnType<typeof makeStore>) =>
  ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );

describe('useGlobalErrorSnackbar', () => {
  it('open is false when no errors', () => {
    const store = makeStore(null);
    const { result } = renderHook(() => useGlobalErrorSnackbar(), { wrapper: wrapper(store) });
    expect(result.current.open).toBe(false);
    expect(result.current.message).toBe('');
  });

  it('opens with error message when simulationSlice has an error', () => {
    const store = makeStore('Failed to load');
    const { result } = renderHook(() => useGlobalErrorSnackbar(), { wrapper: wrapper(store) });
    expect(result.current.open).toBe(true);
    expect(result.current.message).toBe('Failed to load');
  });

  it('handleClose sets open to false', () => {
    const store = makeStore('Some error');
    const { result } = renderHook(() => useGlobalErrorSnackbar(), { wrapper: wrapper(store) });
    expect(result.current.open).toBe(true);

    act(() => { result.current.handleClose(); });
    expect(result.current.open).toBe(false);
  });

  it('opens when a new error is dispatched', async () => {
    const store = makeStore(null);
    const { result } = renderHook(() => useGlobalErrorSnackbar(), { wrapper: wrapper(store) });
    expect(result.current.open).toBe(false);

    await act(async () => {
      // Dispatch a rejected thunk — simulationSlice sets error
      await store.dispatch(
        createSimulationThunk.rejected(
          new Error('net error'),
          'reqId',
          'alice',
          { statusCode: 500, code: 'INTERNAL_SERVER_ERROR', message: 'Server error' },
        ),
      );
    });

    expect(result.current.open).toBe(true);
  });
});
