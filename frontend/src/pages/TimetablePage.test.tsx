import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Provider } from 'react-redux';
import { combineReducers, configureStore } from '@reduxjs/toolkit';
import TimetablePage from './TimetablePage';
import classReducer from '@/store/reducers/classSlice';
import conflictReducer from '@/store/reducers/conflictSlice';
import metricReducer from '@/store/reducers/metricSlice';
import scheduleReducer from '@/store/reducers/scheduleSlice';
import sessionReducer from '@/store/reducers/sessionSlice';
import uiReducer from '@/store/reducers/uiSlice';
import type { ConflictType } from '@/types';

vi.mock('@/hooks/useHeartbeat', () => ({ useHeartbeat: vi.fn() }));
vi.mock('@/hooks/useInactivityWarning', () => ({
  useInactivityWarning: vi.fn().mockReturnValue({ showWarning: false, dismiss: vi.fn() }),
}));
vi.mock('@/organisms/TimetableGrid', () => ({
  default: (props: { conflictedClassIds?: ReadonlySet<string> }) => (
    <div>Grid View Content — conflictedClassIds: {[...(props.conflictedClassIds ?? [])].join(',')}</div>
  ),
}));
vi.mock('@/organisms/SimulationOverview', () => ({
  default: (props: { onSelectConflictType: (type: ConflictType) => void }) => (
    <div>
      Overview Content
      <button onClick={() => props.onSelectConflictType('ROOM_DOUBLE_BOOK')}>
        Trigger Conflict Select
      </button>
    </div>
  ),
}));
vi.mock('@/organisms/Inspector', () => ({ default: () => null }));
vi.mock('@/organisms/HUD', () => ({ default: () => null }));
vi.mock('@/organisms/SessionExpiryModal', () => ({ default: () => null }));
vi.mock('@/organisms/SubmitProposalModal', () => ({ default: () => null }));
vi.mock('@/services/simulationService', () => ({
  simulationService: {
    getSimulationClasses: vi.fn().mockResolvedValue({ data: [], total: 0, page: 1 }),
    getSchedule: vi.fn().mockResolvedValue({
      metadata: {}, courses: [], professors: [], studentGroups: [], rooms: [], timeSlots: [], classes: [],
    }),
    getConflicts: vi.fn().mockResolvedValue([]),
    getMetrics: vi.fn().mockResolvedValue([]),
  },
}));

const rootReducer = combineReducers({
  class: classReducer,
  conflict: conflictReducer,
  metric: metricReducer,
  schedule: scheduleReducer,
  session: sessionReducer,
  ui: uiReducer,
});

type RootState = ReturnType<typeof rootReducer>;

const makeStore = (preloadedState?: Partial<RootState>) =>
  configureStore({
    reducer: rootReducer,
    preloadedState,
  });

const renderPage = (preloadedState?: Partial<RootState>) => {
  const store = makeStore(preloadedState);
  const utils = render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/simulations/sim-1']}>
        <Routes>
          <Route path="/simulations/:id" element={<TimetablePage />} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
  return { store, ...utils };
};

describe('TimetablePage — workspace tabs', () => {
  it('shows Grid View content by default', () => {
    renderPage();
    expect(screen.getByText(/Grid View Content/)).toBeInTheDocument();
  });

  it('switches to Overview content when the Overview tab is clicked', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('tab', { name: 'Overview' }));
    expect(screen.getByText(/Overview Content/)).toBeInTheDocument();
    expect(screen.queryByText(/Grid View Content/)).not.toBeInTheDocument();
  });

  it('computes conflictedClassIds from the conflict slice and passes it to TimetableGrid', () => {
    renderPage({
      conflict: {
        conflicts: [
          { id: 'c1', type: 'ROOM_DOUBLE_BOOK', classIds: ['CLS_001', 'CLS_002'], message: '' },
        ],
        loading: false,
        lastFetchedAt: null,
        error: null,
      },
    });
    expect(
      screen.getByText('Grid View Content — conflictedClassIds: CLS_001,CLS_002'),
    ).toBeInTheDocument();
  });

  it('handleSelectConflictType selects the class, opens the inspector, and switches to the grid tab', async () => {
    const user = userEvent.setup();
    const { store } = renderPage({
      conflict: {
        conflicts: [
          { id: 'c1', type: 'ROOM_DOUBLE_BOOK', classIds: ['CLS_001', 'CLS_002'], message: '' },
        ],
        loading: false,
        lastFetchedAt: null,
        error: null,
      },
    });

    await user.click(screen.getByRole('tab', { name: 'Overview' }));
    expect(screen.getByText(/Overview Content/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Trigger Conflict Select' }));

    expect(store.getState().ui.selectedClassId).toBe('CLS_001');
    expect(store.getState().ui.inspectorOpen).toBe(true);
    expect(screen.getByText(/Grid View Content/)).toBeInTheDocument();
    expect(screen.queryByText(/Overview Content/)).not.toBeInTheDocument();
  });
});
