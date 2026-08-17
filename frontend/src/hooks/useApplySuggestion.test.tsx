import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { useApplySuggestion } from './useApplySuggestion';
import classReducer from '@/store/reducers/classSlice';
import conflictReducer from '@/store/reducers/conflictSlice';
import metricReducer from '@/store/reducers/metricSlice';
import scoreReducer from '@/store/reducers/scoreSlice';
import * as simulationService from '@/services/simulationService';
import type { Suggestion } from '@/types';

vi.mock('@/services/simulationService', () => ({
  simulationService: {
    updateClass: vi.fn(),
    previewClassUpdate: vi.fn(),
    getConflicts: vi.fn().mockResolvedValue([]),
    getMetrics: vi.fn().mockResolvedValue([]),
    getScore: vi.fn().mockResolvedValue({ score: 0, breakdown: [] }),
    sendHeartbeat: vi.fn(),
    createSimulation: vi.fn(),
    getSimulationClasses: vi.fn(),
    getClassSuggestions: vi.fn(),
    commitSimulation: vi.fn(),
    deleteSimulation: vi.fn(),
  },
}));

const SIM_ID = 'sim-1';
const CLASS_ID = 'CLS_001';
const SUGGESTION: Suggestion = { roomId: 'RM_102', timeSlotIds: ['TS_MON_P2'], conflictFree: true };

const makeStore = (opts: {
  metricsBefore?: { name: string; value: number; unit: string }[];
  scoreBefore?: { score: number; breakdown: [] } | null;
} = {}) =>
  configureStore({
    reducer: {
      class: classReducer,
      conflict: conflictReducer,
      metric: metricReducer,
      score: scoreReducer,
    },
    preloadedState: {
      metric: { metrics: opts.metricsBefore ?? [], loading: false, error: null },
      score: { current: opts.scoreBefore ?? null, loading: false, error: null },
    },
  });

const wrap = (store: ReturnType<typeof makeStore>) =>
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  };

describe('useApplySuggestion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(simulationService.simulationService.getConflicts).mockResolvedValue([]);
    vi.mocked(simulationService.simulationService.getMetrics).mockResolvedValue([]);
    vi.mocked(simulationService.simulationService.getScore).mockResolvedValue({ score: 0, breakdown: [] });
  });

  it('calls previewClassUpdate with the suggestion patch before committing', async () => {
    vi.mocked(simulationService.simulationService.previewClassUpdate).mockResolvedValue({
      metrics: [], score: { score: 50, breakdown: [] },
    });
    vi.mocked(simulationService.simulationService.updateClass).mockResolvedValue({
      id: CLASS_ID, courseId: 'C', title: 'T', professorId: 'P', studentGroupId: 'G', roomId: 'RM_102', timeSlotIds: ['TS_MON_P2'],
    });

    const store = makeStore();
    const { result } = renderHook(() => useApplySuggestion(SIM_ID), { wrapper: wrap(store) });

    await act(async () => {
      await result.current.apply(CLASS_ID, SUGGESTION);
    });

    expect(simulationService.simulationService.previewClassUpdate).toHaveBeenCalledWith(
      SIM_ID, CLASS_ID, { roomId: 'RM_102', timeSlotIds: ['TS_MON_P2'] },
    );

    const previewOrder = vi.mocked(simulationService.simulationService.previewClassUpdate).mock.invocationCallOrder[0]!;
    const commitOrder = vi.mocked(simulationService.simulationService.updateClass).mock.invocationCallOrder[0]!;
    expect(previewOrder).toBeLessThan(commitOrder);
  });

  it('sets lastDelta from the preview response — not from live store state re-read after commit', async () => {
    // Redux still holds the OLD metric value even though the preview (and,
    // in a real backend, the commit) reflects a NEW one — proves the delta
    // isn't computed by re-reading a selector post-dispatch.
    vi.mocked(simulationService.simulationService.previewClassUpdate).mockResolvedValue({
      metrics: [{ name: 'Room Utilization', value: 90, unit: '%' }],
      score: { score: 0, breakdown: [] },
    });
    vi.mocked(simulationService.simulationService.updateClass).mockResolvedValue({
      id: CLASS_ID, courseId: 'C', title: 'T', professorId: 'P', studentGroupId: 'G', roomId: 'RM_102', timeSlotIds: ['TS_MON_P2'],
    });

    const store = makeStore({ metricsBefore: [{ name: 'Room Utilization', value: 70, unit: '%' }] });
    const { result } = renderHook(() => useApplySuggestion(SIM_ID), { wrapper: wrap(store) });

    await act(async () => {
      await result.current.apply(CLASS_ID, SUGGESTION);
    });

    expect(result.current.lastDelta).toEqual({
      name: 'Room Utilization', before: 70, after: 90, unit: '%',
    });
  });

  it('picks whichever metric moved the most, not just the first one', async () => {
    vi.mocked(simulationService.simulationService.previewClassUpdate).mockResolvedValue({
      metrics: [
        { name: 'A', value: 11, unit: '' }, // moved by 1
        { name: 'B', value: 20, unit: '' }, // moved by 10
      ],
      score: { score: 0, breakdown: [] },
    });
    vi.mocked(simulationService.simulationService.updateClass).mockResolvedValue({
      id: CLASS_ID, courseId: 'C', title: 'T', professorId: 'P', studentGroupId: 'G', roomId: 'RM_102', timeSlotIds: ['TS_MON_P2'],
    });

    const store = makeStore({
      metricsBefore: [{ name: 'A', value: 10, unit: '' }, { name: 'B', value: 10, unit: '' }],
    });
    const { result } = renderHook(() => useApplySuggestion(SIM_ID), { wrapper: wrap(store) });

    await act(async () => {
      await result.current.apply(CLASS_ID, SUGGESTION);
    });

    expect(result.current.lastDelta?.name).toBe('B');
  });

  it('sets lastScoreDelta from currentScore vs the preview score', async () => {
    vi.mocked(simulationService.simulationService.previewClassUpdate).mockResolvedValue({
      metrics: [], score: { score: 88, breakdown: [] },
    });
    vi.mocked(simulationService.simulationService.updateClass).mockResolvedValue({
      id: CLASS_ID, courseId: 'C', title: 'T', professorId: 'P', studentGroupId: 'G', roomId: 'RM_102', timeSlotIds: ['TS_MON_P2'],
    });

    const store = makeStore({ scoreBefore: { score: 60, breakdown: [] } });
    const { result } = renderHook(() => useApplySuggestion(SIM_ID), { wrapper: wrap(store) });

    await act(async () => {
      await result.current.apply(CLASS_ID, SUGGESTION);
    });

    expect(result.current.lastScoreDelta).toEqual({ before: 60, after: 88 });
  });

  it('leaves lastScoreDelta null when no current score is loaded yet', async () => {
    vi.mocked(simulationService.simulationService.previewClassUpdate).mockResolvedValue({
      metrics: [], score: { score: 88, breakdown: [] },
    });
    vi.mocked(simulationService.simulationService.updateClass).mockResolvedValue({
      id: CLASS_ID, courseId: 'C', title: 'T', professorId: 'P', studentGroupId: 'G', roomId: 'RM_102', timeSlotIds: ['TS_MON_P2'],
    });

    const store = makeStore({ scoreBefore: null });
    const { result } = renderHook(() => useApplySuggestion(SIM_ID), { wrapper: wrap(store) });

    await act(async () => {
      await result.current.apply(CLASS_ID, SUGGESTION);
    });

    expect(result.current.lastScoreDelta).toBeNull();
  });

  it('still commits the change after computing the preview', async () => {
    vi.mocked(simulationService.simulationService.previewClassUpdate).mockResolvedValue({
      metrics: [], score: { score: 0, breakdown: [] },
    });
    vi.mocked(simulationService.simulationService.updateClass).mockResolvedValue({
      id: CLASS_ID, courseId: 'C', title: 'T', professorId: 'P', studentGroupId: 'G', roomId: 'RM_102', timeSlotIds: ['TS_MON_P2'],
    });

    const store = makeStore();
    const { result } = renderHook(() => useApplySuggestion(SIM_ID), { wrapper: wrap(store) });

    await act(async () => {
      await result.current.apply(CLASS_ID, SUGGESTION);
    });

    expect(simulationService.simulationService.updateClass).toHaveBeenCalledWith(
      SIM_ID, CLASS_ID, { roomId: 'RM_102', timeSlotIds: ['TS_MON_P2'] },
    );
    expect(store.getState().class.error).toBeNull();
  });

  it('refreshes conflicts, metrics, and score after a successful commit', async () => {
    vi.mocked(simulationService.simulationService.previewClassUpdate).mockResolvedValue({
      metrics: [], score: { score: 0, breakdown: [] },
    });
    vi.mocked(simulationService.simulationService.updateClass).mockResolvedValue({
      id: CLASS_ID, courseId: 'C', title: 'T', professorId: 'P', studentGroupId: 'G', roomId: 'RM_102', timeSlotIds: ['TS_MON_P2'],
    });

    const store = makeStore();
    const { result } = renderHook(() => useApplySuggestion(SIM_ID), { wrapper: wrap(store) });

    await act(async () => {
      await result.current.apply(CLASS_ID, SUGGESTION);
    });

    expect(simulationService.simulationService.getConflicts).toHaveBeenCalledWith(SIM_ID);
    expect(simulationService.simulationService.getMetrics).toHaveBeenCalledWith(SIM_ID);
    expect(simulationService.simulationService.getScore).toHaveBeenCalledWith(SIM_ID);
  });

  it('sets an error and does not commit when the preview fails', async () => {
    vi.mocked(simulationService.simulationService.previewClassUpdate).mockRejectedValue(new Error('graph down'));

    const store = makeStore();
    const { result } = renderHook(() => useApplySuggestion(SIM_ID), { wrapper: wrap(store) });

    await act(async () => {
      await result.current.apply(CLASS_ID, SUGGESTION);
    });

    expect(result.current.error).toMatch(/failed to apply suggestion/i);
    expect(simulationService.simulationService.updateClass).not.toHaveBeenCalled();
    expect(result.current.lastDelta).toBeNull();
    expect(result.current.lastScoreDelta).toBeNull();
  });

  it('sets an error and does not set a delta when the commit fails after a successful preview', async () => {
    vi.mocked(simulationService.simulationService.previewClassUpdate).mockResolvedValue({
      metrics: [{ name: 'Room Utilization', value: 90, unit: '%' }],
      score: { score: 88, breakdown: [] },
    });
    vi.mocked(simulationService.simulationService.updateClass).mockRejectedValue({
      statusCode: 500, code: 'INTERNAL_SERVER_ERROR', message: 'boom',
    });

    const store = makeStore({
      metricsBefore: [{ name: 'Room Utilization', value: 70, unit: '%' }],
      scoreBefore: { score: 60, breakdown: [] },
    });
    const { result } = renderHook(() => useApplySuggestion(SIM_ID), { wrapper: wrap(store) });

    await act(async () => {
      await result.current.apply(CLASS_ID, SUGGESTION);
    });

    expect(result.current.error).toMatch(/failed to apply suggestion/i);
    expect(result.current.lastDelta).toBeNull();
    expect(result.current.lastScoreDelta).toBeNull();
  });

  it('sets deltaLoading true only while the preview is in flight', async () => {
    let resolvePreview!: (v: { metrics: []; score: { score: number; breakdown: [] } }) => void;
    vi.mocked(simulationService.simulationService.previewClassUpdate).mockReturnValue(
      new Promise((resolve) => { resolvePreview = resolve; }),
    );
    vi.mocked(simulationService.simulationService.updateClass).mockResolvedValue({
      id: CLASS_ID, courseId: 'C', title: 'T', professorId: 'P', studentGroupId: 'G', roomId: 'RM_102', timeSlotIds: ['TS_MON_P2'],
    });

    const store = makeStore();
    const { result } = renderHook(() => useApplySuggestion(SIM_ID), { wrapper: wrap(store) });

    let applyPromise!: Promise<void>;
    act(() => {
      applyPromise = result.current.apply(CLASS_ID, SUGGESTION);
    });

    expect(result.current.deltaLoading).toBe(true);

    await act(async () => {
      resolvePreview({ metrics: [], score: { score: 0, breakdown: [] } });
      await applyPromise;
    });

    expect(result.current.deltaLoading).toBe(false);
  });
});
