import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import simulationReducer, {
  loadSimulationsFromStorage,
  setCurrentSimulation,
  clearCurrentSimulation,
  createSimulationThunk,
  deleteSimulationThunk,
} from './simulationSlice';
import type { Simulation } from '@/types';

const fakeSimulation: Simulation = {
  id: 'sim-alice-a1b2c3d4',
  branchId: 'sim-alice-a1b2c3d4',
  createdAt: '2026-06-11T10:00:00Z',
};

// Stub localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

const makeStore = () =>
  configureStore({ reducer: { simulation: simulationReducer } });

describe('simulationSlice', () => {
  beforeEach(() => localStorageMock.clear());

  it('initialises with empty simulations', () => {
    const store = makeStore();
    expect(store.getState().simulation.simulations).toEqual([]);
    expect(store.getState().simulation.loading).toBe(false);
  });

  it('loadSimulationsFromStorage populates state from localStorage', () => {
    localStorageMock.setItem('unisched_simulations', JSON.stringify([fakeSimulation]));
    const store = makeStore();
    store.dispatch(loadSimulationsFromStorage());
    expect(store.getState().simulation.simulations).toHaveLength(1);
    expect(store.getState().simulation.simulations[0].id).toBe('sim-alice-a1b2c3d4');
  });

  it('loadSimulationsFromStorage handles missing key gracefully', () => {
    const store = makeStore();
    store.dispatch(loadSimulationsFromStorage());
    expect(store.getState().simulation.simulations).toEqual([]);
  });

  it('setCurrentSimulation sets the current simulation', () => {
    const store = makeStore();
    store.dispatch(setCurrentSimulation(fakeSimulation));
    expect(store.getState().simulation.current?.id).toBe('sim-alice-a1b2c3d4');
  });

  it('clearCurrentSimulation nulls out current', () => {
    const store = makeStore();
    store.dispatch(setCurrentSimulation(fakeSimulation));
    store.dispatch(clearCurrentSimulation());
    expect(store.getState().simulation.current).toBeNull();
  });

  it('createSimulationThunk.pending sets loading true', () => {
    const store = makeStore();
    store.dispatch(createSimulationThunk.pending('req-id', 'alice'));
    expect(store.getState().simulation.loading).toBe(true);
    expect(store.getState().simulation.error).toBeNull();
  });

  it('createSimulationThunk.fulfilled adds simulation and sets current', () => {
    const store = makeStore();
    store.dispatch(createSimulationThunk.fulfilled(fakeSimulation, 'req-id', 'alice'));
    const state = store.getState().simulation;
    expect(state.loading).toBe(false);
    expect(state.simulations).toHaveLength(1);
    expect(state.current?.id).toBe('sim-alice-a1b2c3d4');
  });

  it('createSimulationThunk.fulfilled persists to localStorage', () => {
    const store = makeStore();
    store.dispatch(createSimulationThunk.fulfilled(fakeSimulation, 'req-id', 'alice'));
    const stored = JSON.parse(localStorageMock.getItem('unisched_simulations') ?? '[]') as Simulation[];
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe('sim-alice-a1b2c3d4');
  });

  it('createSimulationThunk.rejected sets error message', () => {
    const store = makeStore();
    const error = { statusCode: 500, code: 'INTERNAL_SERVER_ERROR', message: 'Server error' };
    store.dispatch(createSimulationThunk.rejected(null, 'req-id', 'alice', error));
    expect(store.getState().simulation.loading).toBe(false);
    expect(store.getState().simulation.error).toBe('Server error');
  });

  it('deleteSimulationThunk.fulfilled removes simulation from state', () => {
    const store = makeStore();
    store.dispatch(createSimulationThunk.fulfilled(fakeSimulation, 'req-id', 'alice'));
    store.dispatch(deleteSimulationThunk.fulfilled('sim-alice-a1b2c3d4', 'del-id', 'sim-alice-a1b2c3d4'));
    expect(store.getState().simulation.simulations).toHaveLength(0);
  });

  it('deleteSimulationThunk.fulfilled clears current if it matches', () => {
    const store = makeStore();
    store.dispatch(setCurrentSimulation(fakeSimulation));
    store.dispatch(deleteSimulationThunk.fulfilled('sim-alice-a1b2c3d4', 'del-id', 'sim-alice-a1b2c3d4'));
    expect(store.getState().simulation.current).toBeNull();
  });

  describe('createSimulationThunk (async)', () => {
    let mockCreate: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      // Dynamically import and mock the service
      mockCreate = vi.fn();
    });

    afterEach(() => vi.restoreAllMocks());

    it('dispatches fulfilled with returned simulation', async () => {
      const { simulationService } = await import('@/services/simulationService');
      vi.spyOn(simulationService, 'createSimulation').mockResolvedValue(fakeSimulation);

      const store = makeStore();
      await store.dispatch(createSimulationThunk('alice'));
      const state = store.getState().simulation;
      expect(state.simulations).toHaveLength(1);
      expect(state.current?.id).toBe('sim-alice-a1b2c3d4');
      void mockCreate;
    });

    it('dispatches rejected when service throws', async () => {
      const { simulationService } = await import('@/services/simulationService');
      vi.spyOn(simulationService, 'createSimulation').mockRejectedValue({
        statusCode: 500,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Server exploded',
      });

      const store = makeStore();
      await store.dispatch(createSimulationThunk('alice'));
      expect(store.getState().simulation.error).toBe('Server exploded');
    });
  });
});
