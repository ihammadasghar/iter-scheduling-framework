import { describe, it, expect, vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import scoreReducer, {
  fetchScoreThunk,
  clearScore,
} from './scoreSlice';
import * as simulationService from '@/services/simulationService';

vi.mock('@/services/simulationService', () => ({
  simulationService: {
    getScore: vi.fn(),
    sendHeartbeat: vi.fn(),
    createSimulation: vi.fn(),
    getSimulationClasses: vi.fn(),
    updateClass: vi.fn(),
    getClassSuggestions: vi.fn(),
    getConflicts: vi.fn(),
    getMetrics: vi.fn(),
    commitSimulation: vi.fn(),
    deleteSimulation: vi.fn(),
  },
}));

const makeStore = () => configureStore({ reducer: { score: scoreReducer } });

describe('scoreSlice', () => {
  it('initialises with a null current score', () => {
    const store = makeStore();
    expect(store.getState().score.current).toBeNull();
    expect(store.getState().score.loading).toBe(false);
    expect(store.getState().score.error).toBeNull();
  });

  it('fetchScoreThunk.pending sets loading=true', () => {
    const store = makeStore();
    store.dispatch(fetchScoreThunk.pending('', 'sim-1'));
    expect(store.getState().score.loading).toBe(true);
    expect(store.getState().score.error).toBeNull();
  });

  it('fetchScoreThunk.fulfilled stores the score', () => {
    const store = makeStore();
    const score = { score: 82, breakdown: [] };
    store.dispatch(fetchScoreThunk.fulfilled(score, '', 'sim-1'));
    expect(store.getState().score.current).toEqual(score);
    expect(store.getState().score.loading).toBe(false);
  });

  it('fetchScoreThunk.rejected sets error message', () => {
    const store = makeStore();
    store.dispatch(
      fetchScoreThunk.rejected(null, '', 'sim-1', {
        statusCode: 500,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Server error',
      }),
    );
    expect(store.getState().score.loading).toBe(false);
    expect(store.getState().score.error).toBe('Server error');
  });

  it('clearScore resets the state', () => {
    const store = makeStore();
    store.dispatch(fetchScoreThunk.fulfilled({ score: 50, breakdown: [] }, '', 'sim-1'));
    store.dispatch(clearScore());
    expect(store.getState().score.current).toBeNull();
    expect(store.getState().score.error).toBeNull();
  });

  it('fetchScoreThunk async — calls service and stores result', async () => {
    vi.mocked(simulationService.simulationService.getScore).mockResolvedValueOnce({
      score: 91,
      breakdown: [],
    });
    const store = makeStore();
    await store.dispatch(fetchScoreThunk('sim-1'));
    expect(store.getState().score.current?.score).toBe(91);
  });
});
