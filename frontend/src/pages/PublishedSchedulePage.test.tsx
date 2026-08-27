import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { combineReducers, configureStore } from '@reduxjs/toolkit';
import PublishedSchedulePage from './PublishedSchedulePage';
import classReducer from '@/store/reducers/classSlice';
import scheduleReducer from '@/store/reducers/scheduleSlice';
import uiReducer from '@/store/reducers/uiSlice';
import identityReducer from '@/store/reducers/identitySlice';
import { scheduleService } from '@/services/scheduleService';

vi.mock('@/organisms/TimetableGrid', () => ({
  default: (props: { excludedDays?: ReadonlySet<string> }) => (
    <div>Grid View Content — excludedDays: {[...(props.excludedDays ?? [])].join(',')}</div>
  ),
}));
vi.mock('@/organisms/BrowseSchedulePanel', () => ({
  default: () => <div>Browse Content</div>,
}));
vi.mock('@/organisms/Inspector', () => ({ default: () => null }));
vi.mock('@/services/scheduleService', () => ({
  scheduleService: {
    getPublishedClasses: vi.fn().mockResolvedValue({ data: [], total: 0, page: 1 }),
    getPublishedRoster: vi.fn().mockResolvedValue({
      metadata: {
        semesterId: 'sem-1', semesterName: 'Fall 2026', academicYear: '2026-2027',
        timeline: {
          semesterStartDate: '2026-09-07', semesterEndDate: '2026-12-18',
          exclusionDates: [{ date: '2026-11-26', reason: 'Thanksgiving Break' }],
        },
      },
      courses: [], professors: [], studentGroups: [], rooms: [], timeSlots: [],
    }),
  },
}));

const rootReducer = combineReducers({
  class: classReducer,
  schedule: scheduleReducer,
  ui: uiReducer,
  identity: identityReducer,
});

type RootState = ReturnType<typeof rootReducer>;

const makeStore = (preloadedState?: Partial<RootState>) =>
  configureStore({ reducer: rootReducer, preloadedState });

const renderPage = (preloadedState?: Partial<RootState>) => {
  const store = makeStore(preloadedState);
  const utils = render(
    <Provider store={store}>
      <MemoryRouter>
        <PublishedSchedulePage />
      </MemoryRouter>
    </Provider>,
  );
  return { store, ...utils };
};

describe('PublishedSchedulePage — tabs', () => {
  it('shows Grid View content by default', () => {
    renderPage();
    expect(screen.getByText(/Grid View Content/)).toBeInTheDocument();
  });

  it('renders only Full Schedule and Browse tabs, not My Schedule or Overview', () => {
    renderPage();
    expect(screen.getByRole('tab', { name: 'Full Schedule' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Browse' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'My Schedule' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Overview' })).not.toBeInTheDocument();
  });

  it('switches to Browse content when the Browse tab is clicked, and hides ViewBySelector', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('tab', { name: 'Browse' }));
    expect(screen.getByText(/Browse Content/)).toBeInTheDocument();
    expect(screen.queryByText(/Grid View Content/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('View timetable by')).not.toBeInTheDocument();
  });

  it('shows an error alert when the published class fetch failed', async () => {
    vi.mocked(scheduleService.getPublishedClasses).mockRejectedValueOnce(
      { message: 'boom', statusCode: 500 },
    );
    renderPage();
    expect(await screen.findByText(/could not load the published schedule/i)).toBeInTheDocument();
  });
});

describe('PublishedSchedulePage — week navigation', () => {
  it('shows the WeekNavigator once metadata has loaded, clamped to the semester start', async () => {
    renderPage();
    expect(await screen.findByText('Sep 7 – Sep 13, 2026')).toBeInTheDocument();
  });

  it('clicking Next week advances the week and passes the new excludedDays down to TimetableGrid', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Sep 7 – Sep 13, 2026');

    for (let i = 0; i < 11; i++) {
      // eslint-disable-next-line no-await-in-loop
      await user.click(screen.getByLabelText('Next week'));
    }

    expect(await screen.findByText('Nov 23 – Nov 29, 2026')).toBeInTheDocument();
    expect(screen.getByText('Grid View Content — excludedDays: Thursday')).toBeInTheDocument();
  });

  it('preserves the selected week when switching from Full Schedule to Browse', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Sep 7 – Sep 13, 2026');
    await user.click(screen.getByLabelText('Next week'));
    await screen.findByText('Sep 14 – Sep 20, 2026');

    await user.click(screen.getByRole('tab', { name: 'Browse' }));
    await user.click(screen.getByRole('tab', { name: 'Full Schedule' }));

    expect(screen.getByText('Sep 14 – Sep 20, 2026')).toBeInTheDocument();
  });
});
