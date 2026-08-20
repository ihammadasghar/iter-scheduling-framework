import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import SuggestionsList from './SuggestionsList';
import classReducer from '@/store/reducers/classSlice';
import conflictReducer from '@/store/reducers/conflictSlice';
import metricReducer from '@/store/reducers/metricSlice';
import scoreReducer from '@/store/reducers/scoreSlice';
import scheduleReducer from '@/store/reducers/scheduleSlice';
import * as simulationService from '@/services/simulationService';
import type { RawRoom, ScheduleClass, Suggestion } from '@/types';

vi.mock('@/services/simulationService', () => ({
  simulationService: {
    updateClass: vi.fn(),
    previewClassUpdate: vi.fn(),
    getConflicts: vi.fn().mockResolvedValue([]),
    getMetrics: vi.fn().mockResolvedValue([]),
    getScore: vi.fn().mockResolvedValue({ score: 0, breakdown: [] }),
    getClassSuggestions: vi.fn(),
  },
}));

const SIM_ID = 'sim-1';
const CLASS_ID = 'CLS_001';

const currentClass: ScheduleClass = {
  id: CLASS_ID,
  courseId: 'CRS_BIO101',
  title: 'Biology 101',
  professorId: 'PRF_SMITH',
  studentGroupId: 'GRP_BIO_Y1',
  roomId: 'RM_101',
  timeSlotIds: ['TS_MON_P1'],
};

const SUGGESTION_A: Suggestion = { roomId: 'RM_204', timeSlotIds: ['TS_TUE_P2'], conflictFree: true };
const SUGGESTION_B: Suggestion = { roomId: 'RM_305', timeSlotIds: ['TS_WED_P3'], conflictFree: true };
const SUGGESTION_C: Suggestion = { roomId: 'RM_410', timeSlotIds: ['TS_THU_P4'], conflictFree: true };

const ROOMS: RawRoom[] = [
  { id: 'RM_204', name: 'Room 204', capacity: 30, building: 'Main' },
  { id: 'RM_305', name: 'Room 305', capacity: 30, building: 'Main' },
  { id: 'RM_410', name: 'Room 410', capacity: 30, building: 'Main' },
];

const makeStore = () =>
  configureStore({
    reducer: {
      class: classReducer,
      conflict: conflictReducer,
      metric: metricReducer,
      score: scoreReducer,
      schedule: scheduleReducer,
    },
    preloadedState: {
      schedule: { rooms: ROOMS, studentGroups: [], courses: [], professors: [], loading: false, error: null },
    },
  });

const renderList = (store: ReturnType<typeof makeStore>) =>
  render(
    <Provider store={store}>
      <SuggestionsList simId={SIM_ID} classId={CLASS_ID} currentClass={currentClass} />
    </Provider>,
  );

describe('SuggestionsList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(simulationService.simulationService.getConflicts).mockResolvedValue([]);
    vi.mocked(simulationService.simulationService.getMetrics).mockResolvedValue([]);
    vi.mocked(simulationService.simulationService.getScore).mockResolvedValue({ score: 0, breakdown: [] });
  });

  it('confirms exactly which combination was applied, independent of the other cards still shown', async () => {
    const user = userEvent.setup();
    vi.mocked(simulationService.simulationService.getClassSuggestions)
      .mockResolvedValueOnce([SUGGESTION_A, SUGGESTION_B, SUGGESTION_C])
      // After applying A, the refreshed list no longer offers it.
      .mockResolvedValueOnce([SUGGESTION_B, SUGGESTION_C]);
    vi.mocked(simulationService.simulationService.previewClassUpdate).mockResolvedValue({
      metrics: [], score: { score: 0, breakdown: [] },
    });
    vi.mocked(simulationService.simulationService.updateClass).mockResolvedValue({
      ...currentClass, roomId: SUGGESTION_A.roomId, timeSlotIds: [...SUGGESTION_A.timeSlotIds],
    });

    const store = makeStore();
    renderList(store);

    await screen.findByRole('button', { name: /move biology 101 to room 204/i });

    await user.click(screen.getByRole('button', { name: /move biology 101 to room 204/i }));

    // Persistent confirmation names Room 204 — the one actually clicked —
    // not derived from a "Currently" line shared by every card.
    expect(await screen.findByText(/moved to room 204/i)).toBeInTheDocument();

    // The list was refreshed, not left stale.
    await waitFor(() => {
      expect(simulationService.simulationService.getClassSuggestions).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /move biology 101 to room 204/i })).not.toBeInTheDocument();
    });

    // Confirmation is still there and still names Room 204, even after the
    // refreshed grid renders different cards (Room 305 / Room 410).
    expect(screen.getByText(/moved to room 204/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /move biology 101 to room 305/i })).toBeInTheDocument();
  });

  it('shows no confirmation and keeps the error alert when applying fails', async () => {
    const user = userEvent.setup();
    vi.mocked(simulationService.simulationService.getClassSuggestions).mockResolvedValue([SUGGESTION_A]);
    vi.mocked(simulationService.simulationService.previewClassUpdate).mockRejectedValue(new Error('graph down'));

    const store = makeStore();
    renderList(store);

    await user.click(await screen.findByRole('button', { name: /move biology 101 to room 204/i }));

    expect(await screen.findByText(/failed to apply suggestion/i)).toBeInTheDocument();
    expect(screen.queryByText(/moved to room 204/i)).not.toBeInTheDocument();
    // Not refreshed — nothing was actually applied.
    expect(simulationService.simulationService.getClassSuggestions).toHaveBeenCalledTimes(1);
  });

  it('clears the confirmation once a different class is selected', async () => {
    const user = userEvent.setup();
    vi.mocked(simulationService.simulationService.getClassSuggestions)
      .mockResolvedValueOnce([SUGGESTION_A])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([SUGGESTION_B]);
    vi.mocked(simulationService.simulationService.previewClassUpdate).mockResolvedValue({
      metrics: [], score: { score: 0, breakdown: [] },
    });
    vi.mocked(simulationService.simulationService.updateClass).mockResolvedValue({
      ...currentClass, roomId: SUGGESTION_A.roomId, timeSlotIds: [...SUGGESTION_A.timeSlotIds],
    });

    const store = makeStore();
    const { rerender } = renderList(store);

    await user.click(await screen.findByRole('button', { name: /move biology 101 to room 204/i }));
    expect(await screen.findByText(/moved to room 204/i)).toBeInTheDocument();

    rerender(
      <Provider store={store}>
        <SuggestionsList simId={SIM_ID} classId="CLS_002" currentClass={{ ...currentClass, id: 'CLS_002' }} />
      </Provider>,
    );

    await waitFor(() => {
      expect(screen.queryByText(/moved to room 204/i)).not.toBeInTheDocument();
    });
  });
});
