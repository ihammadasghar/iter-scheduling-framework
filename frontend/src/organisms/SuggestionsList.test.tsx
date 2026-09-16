import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { IntlProvider } from 'react-intl';
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

const ROOMS: RawRoom[] = [
  { id: 'RM_204', name: 'Room 204', capacity: 30, building: 'Main' },
  { id: 'RM_305', name: 'Room 305', capacity: 30, building: 'Main' },
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
      schedule: { rooms: ROOMS, studentGroups: [], courses: [], professors: [], timeSlots: [], metadata: null, loading: false, error: null },
    },
  });

const renderList = (
  store: ReturnType<typeof makeStore>,
  onStageSuggestion: (suggestion: Suggestion) => void = vi.fn(),
  classId: string = CLASS_ID,
  cls: ScheduleClass = currentClass,
) =>
  render(
    <Provider store={store}>
      <IntlProvider locale="en" messages={{}}>
        <SuggestionsList simId={SIM_ID} classId={classId} currentClass={cls} onStageSuggestion={onStageSuggestion} />
      </IntlProvider>
    </Provider>,
  );

describe('SuggestionsList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clicking a suggestion card stages it via onStageSuggestion instead of committing', async () => {
    const user = userEvent.setup();
    const onStageSuggestion = vi.fn();
    vi.mocked(simulationService.simulationService.getClassSuggestions).mockResolvedValue([SUGGESTION_A, SUGGESTION_B]);

    const store = makeStore();
    renderList(store, onStageSuggestion);

    await user.click(await screen.findByRole('button', { name: /move biology 101 to room 204/i }));

    expect(onStageSuggestion).toHaveBeenCalledTimes(1);
    expect(onStageSuggestion).toHaveBeenCalledWith(SUGGESTION_A);
    // Staging never commits or refetches — the list underneath is untouched.
    expect(screen.getByRole('button', { name: /move biology 101 to room 204/i })).toBeInTheDocument();
    expect(simulationService.simulationService.getClassSuggestions).toHaveBeenCalledTimes(1);
  });

  it('reloads suggestions when a different class is selected', async () => {
    vi.mocked(simulationService.simulationService.getClassSuggestions)
      .mockResolvedValueOnce([SUGGESTION_A])
      .mockResolvedValueOnce([SUGGESTION_B]);

    const store = makeStore();
    const { rerender } = renderList(store);

    await screen.findByRole('button', { name: /move biology 101 to room 204/i });

    rerender(
      <Provider store={store}>
        <IntlProvider locale="en" messages={{}}>
          <SuggestionsList
            simId={SIM_ID}
            classId="CLS_002"
            currentClass={{ ...currentClass, id: 'CLS_002' }}
            onStageSuggestion={vi.fn()}
          />
        </IntlProvider>
      </Provider>,
    );

    await waitFor(() => {
      expect(simulationService.simulationService.getClassSuggestions).toHaveBeenCalledWith(SIM_ID, 'CLS_002');
    });
    expect(await screen.findByRole('button', { name: /move biology 101 to room 305/i })).toBeInTheDocument();
  });
});
