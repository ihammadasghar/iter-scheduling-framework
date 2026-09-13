import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Provider } from 'react-redux';
import { IntlProvider } from 'react-intl';
import { combineReducers, configureStore } from '@reduxjs/toolkit';
import TimetablePage from './TimetablePage';
import { simulationService } from '@/services/simulationService';
import classReducer from '@/store/reducers/classSlice';
import conflictReducer from '@/store/reducers/conflictSlice';
import metricReducer from '@/store/reducers/metricSlice';
import scheduleReducer from '@/store/reducers/scheduleSlice';
import sessionReducer from '@/store/reducers/sessionSlice';
import uiReducer from '@/store/reducers/uiSlice';
import identityReducer from '@/store/reducers/identitySlice';
import languageReducer from '@/store/reducers/languageSlice';
import type { ConflictType } from '@/types';

vi.mock('@/hooks/useHeartbeat', () => ({ useHeartbeat: vi.fn() }));
vi.mock('@/hooks/useInactivityWarning', () => ({
  useInactivityWarning: vi.fn().mockReturnValue({ showWarning: false, dismiss: vi.fn() }),
}));
vi.mock('@/organisms/TimetableGrid', () => ({
  default: (props: { conflictedClassIds?: ReadonlySet<string>; excludedDays?: ReadonlySet<string> }) => (
    <>
      <div>Grid View Content — conflictedClassIds: {[...(props.conflictedClassIds ?? [])].join(',')}</div>
      <div>excludedDays: {[...(props.excludedDays ?? [])].join(',')}</div>
    </>
  ),
}));
vi.mock('@/organisms/MyScheduleCalendar', () => ({
  default: () => <div>My Schedule Content</div>,
}));
vi.mock('@/organisms/BrowseSchedulePanel', () => ({
  default: () => <div>Browse Content</div>,
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
vi.mock('@/organisms/ScheduleUpdatedModal', () => ({ default: () => null }));
vi.mock('@/organisms/SubmitProposalModal', () => ({ default: () => null }));
vi.mock('@/services/simulationService', () => ({
  simulationService: {
    getSimulationClasses: vi.fn().mockResolvedValue({ data: [], total: 0, page: 1 }),
    getSchedule: vi.fn().mockResolvedValue({
      metadata: {
        semesterId: 'sem-1', semesterName: 'Fall 2026', academicYear: '2026-2027',
        timeline: {
          semesterStartDate: '2026-09-07', semesterEndDate: '2026-12-18',
          exclusionDates: [{ date: '2026-11-26', reason: 'Thanksgiving Break' }],
        },
      },
      courses: [], professors: [], studentGroups: [], rooms: [], timeSlots: [], classes: [],
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
  identity: identityReducer,
  language: languageReducer,
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
      <IntlProvider locale="en" messages={{}}>
        <MemoryRouter initialEntries={['/simulations/sim-1']}>
          <Routes>
            <Route path="/simulations/:id" element={<TimetablePage />} />
          </Routes>
        </MemoryRouter>
      </IntlProvider>
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

  it('switches to Browse content when the Browse tab is clicked', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('tab', { name: 'Browse' }));
    expect(screen.getByText(/Browse Content/)).toBeInTheDocument();
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

  it('marks the session expired immediately when the initial classes fetch 404s (no waiting for the next heartbeat)', async () => {
    const notFound = { statusCode: 404, code: 'NOT_FOUND', message: 'Simulation not found or expired' };
    (simulationService.getSimulationClasses as ReturnType<typeof vi.fn>).mockRejectedValueOnce(notFound);

    const { store } = renderPage();

    await waitFor(() => expect(store.getState().session.expired).toBe(true));
  });

  it('marks the session expired immediately when the initial schedule fetch 404s', async () => {
    const notFound = { statusCode: 404, code: 'NOT_FOUND', message: 'Simulation not found or expired' };
    (simulationService.getSchedule as ReturnType<typeof vi.fn>).mockRejectedValueOnce(notFound);

    const { store } = renderPage();

    await waitFor(() => expect(store.getState().session.expired).toBe(true));
  });
});

describe('TimetablePage — default tab by identity', () => {
  it('defaults to My Schedule for a professor', () => {
    renderPage({
      identity: {
        identity: { role: 'professor', professorId: 'PRF_SMITH', studentGroupId: null },
        hydrated: true,
      },
    });
    expect(screen.getByText(/My Schedule Content/)).toBeInTheDocument();
    expect(screen.queryByText(/Grid View Content/)).not.toBeInTheDocument();
  });

  it('defaults to My Schedule for a student', () => {
    renderPage({
      identity: {
        identity: { role: 'student', professorId: null, studentGroupId: 'GRP_BIO_Y1' },
        hydrated: true,
      },
    });
    expect(screen.getByText(/My Schedule Content/)).toBeInTheDocument();
  });

  it('defaults to the Full Schedule grid for an admin', () => {
    renderPage({
      identity: {
        identity: { role: 'admin', professorId: null, studentGroupId: null },
        hydrated: true,
      },
    });
    expect(screen.getByText(/Grid View Content/)).toBeInTheDocument();
  });

  it('defaults to the Full Schedule grid when no identity is set', () => {
    renderPage();
    expect(screen.getByText(/Grid View Content/)).toBeInTheDocument();
  });
});

describe('TimetablePage — week navigation', () => {
  it('shows the WeekNavigator once the roster metadata has loaded, clamped to the semester start', async () => {
    renderPage();
    // Real "today" is well before this fixture's Sep 7 2026 semester start,
    // so the initial week should clamp to the semester's first week.
    expect(await screen.findByText('Sep 7 – Sep 13, 2026')).toBeInTheDocument();
  });

  it('does not show the WeekNavigator on the Overview tab', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Sep 7 – Sep 13, 2026');

    await user.click(screen.getByRole('tab', { name: 'Overview' }));

    expect(screen.queryByText('Sep 7 – Sep 13, 2026')).not.toBeInTheDocument();
  });

  it('clicking Next week advances the week and passes the new excludedDays down to TimetableGrid', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Sep 7 – Sep 13, 2026');

    // Step from the semester's first week to the Thanksgiving week (Nov 23–29).
    for (let i = 0; i < 11; i++) {
      // eslint-disable-next-line no-await-in-loop
      await user.click(screen.getByLabelText('Next week'));
    }

    expect(await screen.findByText('Nov 23 – Nov 29, 2026')).toBeInTheDocument();
    expect(screen.getByText('excludedDays: Thursday')).toBeInTheDocument();
  });

  it('preserves the selected week when switching from Full Schedule to My Schedule', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Sep 7 – Sep 13, 2026');
    await user.click(screen.getByLabelText('Next week'));
    await screen.findByText('Sep 14 – Sep 20, 2026');

    await user.click(screen.getByRole('tab', { name: 'My Schedule' }));
    await user.click(screen.getByRole('tab', { name: 'Full Schedule' }));

    expect(screen.getByText('Sep 14 – Sep 20, 2026')).toBeInTheDocument();
  });
});
