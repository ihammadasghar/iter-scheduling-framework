import { describe, it, expect, vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import metricReducer, {
  fetchMetricsThunk,
  clearMetrics,
} from './metricSlice';
import * as simulationService from '@/services/simulationService';

vi.mock('@/services/simulationService', () => ({
  simulationService: {
    getMetrics: vi.fn(),
    sendHeartbeat: vi.fn(),
    createSimulation: vi.fn(),
    getSimulationClasses: vi.fn(),
    updateClass: vi.fn(),
    getClassSuggestions: vi.fn(),
    getConflicts: vi.fn(),
    commitSimulation: vi.fn(),
    deleteSimulation: vi.fn(),
  },
}));

const makeStore = () => configureStore({ reducer: { metric: metricReducer } });

describe('metricSlice', () => {
  it('initialises with empty metrics', () => {
    const store = makeStore();
    expect(store.getState().metric.metrics).toEqual([]);
    expect(store.getState().metric.loading).toBe(false);
    expect(store.getState().metric.error).toBeNull();
  });

  it('fetchMetricsThunk.pending sets loading=true', () => {
    const store = makeStore();
    store.dispatch(fetchMetricsThunk.pending('', 'sim-1'));
    expect(store.getState().metric.loading).toBe(true);
    expect(store.getState().metric.error).toBeNull();
  });

  it('fetchMetricsThunk.fulfilled stores metrics', () => {
    const store = makeStore();
    const metrics = [{ name: 'Room utilisation', value: 72, unit: '%' }];
    store.dispatch(fetchMetricsThunk.fulfilled(metrics, '', 'sim-1'));
    expect(store.getState().metric.metrics).toEqual(metrics);
    expect(store.getState().metric.loading).toBe(false);
  });

  it('fetchMetricsThunk.fulfilled with empty array stores no metrics', () => {
    const store = makeStore();
    store.dispatch(fetchMetricsThunk.fulfilled([], '', 'sim-1'));
    expect(store.getState().metric.metrics).toEqual([]);
  });

  it('fetchMetricsThunk.rejected sets error message', () => {
    const store = makeStore();
    store.dispatch(
      fetchMetricsThunk.rejected(null, '', 'sim-1', {
        statusCode: 500,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Server error',
      }),
    );
    expect(store.getState().metric.loading).toBe(false);
    expect(store.getState().metric.error).toBe('Server error');
  });

  it('clearMetrics resets the state', () => {
    const store = makeStore();
    store.dispatch(fetchMetricsThunk.fulfilled([{ name: 'X', value: 1, unit: '' }], '', 'sim-1'));
    store.dispatch(clearMetrics());
    expect(store.getState().metric.metrics).toEqual([]);
    expect(store.getState().metric.error).toBeNull();
  });

  it('fetchMetricsThunk async — calls service and stores result', async () => {
    vi.mocked(simulationService.simulationService.getMetrics).mockResolvedValueOnce([
      { name: 'Utilisation', value: 80, unit: '%' },
    ]);
    const store = makeStore();
    await store.dispatch(fetchMetricsThunk('sim-1'));
    expect(store.getState().metric.metrics).toHaveLength(1);
    expect(store.getState().metric.metrics[0]!.name).toBe('Utilisation');
  });
});
