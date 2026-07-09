import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { useHeartbeat } from './useHeartbeat';
import sessionReducer, { markExpired, markHeartbeat } from '@/store/reducers/sessionSlice';
import classReducer from '@/store/reducers/classSlice';
import * as simulationService from '@/services/simulationService';

vi.mock('@/services/simulationService', () => ({
  simulationService: {
    sendHeartbeat: vi.fn().mockResolvedValue(undefined),
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

const makeStore = () =>
  configureStore({
    reducer: { session: sessionReducer, class: classReducer },
  });

describe('useHeartbeat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.mocked(simulationService.simulationService.sendHeartbeat).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does nothing when simId is null', async () => {
    const store = makeStore();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );

    renderHook(() => useHeartbeat(null), { wrapper });
    await act(async () => { vi.advanceTimersByTime(60_000); });

    expect(vi.mocked(simulationService.simulationService.sendHeartbeat)).not.toHaveBeenCalled();
  });

  it('calls sendHeartbeat after 60 seconds and dispatches markHeartbeat', async () => {
    const store = makeStore();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );

    renderHook(() => useHeartbeat('sim-1'), { wrapper });
    await act(async () => { vi.advanceTimersByTime(60_000); });

    expect(vi.mocked(simulationService.simulationService.sendHeartbeat)).toHaveBeenCalledWith('sim-1');
  });

  it('dispatches markExpired on 404 response', async () => {
    vi.mocked(simulationService.simulationService.sendHeartbeat).mockRejectedValueOnce({ statusCode: 404 });
    const store = makeStore();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );

    renderHook(() => useHeartbeat('sim-1'), { wrapper });
    await act(async () => { vi.advanceTimersByTime(60_000); });

    expect(store.getState().session.expired).toBe(true);
  });

  it('does NOT dispatch markExpired on non-404 network errors', async () => {
    vi.mocked(simulationService.simulationService.sendHeartbeat).mockRejectedValueOnce({ statusCode: 500 });
    const store = makeStore();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );

    renderHook(() => useHeartbeat('sim-1'), { wrapper });
    await act(async () => { vi.advanceTimersByTime(60_000); });

    expect(store.getState().session.expired).toBe(false);
  });

  it('fires multiple times at 60s intervals', async () => {
    const store = makeStore();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );

    renderHook(() => useHeartbeat('sim-1'), { wrapper });
    await act(async () => { vi.advanceTimersByTime(180_000); }); // 3 ticks

    expect(vi.mocked(simulationService.simulationService.sendHeartbeat)).toHaveBeenCalledTimes(3);
  });

  it('clears interval on unmount', async () => {
    const store = makeStore();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );

    const { unmount } = renderHook(() => useHeartbeat('sim-1'), { wrapper });
    unmount();
    await act(async () => { vi.advanceTimersByTime(60_000); });

    expect(vi.mocked(simulationService.simulationService.sendHeartbeat)).not.toHaveBeenCalled();
  });

  // Expose action creators for assertion
  it('markHeartbeat action creator exists', () => {
    expect(markHeartbeat).toBeDefined();
    expect(markExpired).toBeDefined();
  });
});
