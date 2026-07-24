import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import TimetablePage from './TimetablePage';
import classReducer from '@/store/reducers/classSlice';
import conflictReducer from '@/store/reducers/conflictSlice';
import metricReducer from '@/store/reducers/metricSlice';
import scheduleReducer from '@/store/reducers/scheduleSlice';
import sessionReducer from '@/store/reducers/sessionSlice';
import uiReducer from '@/store/reducers/uiSlice';

vi.mock('@/hooks/useHeartbeat', () => ({ useHeartbeat: vi.fn() }));
vi.mock('@/hooks/useInactivityWarning', () => ({
  useInactivityWarning: vi.fn().mockReturnValue({ showWarning: false, dismiss: vi.fn() }),
}));
vi.mock('@/organisms/TimetableGrid', () => ({ default: () => <div>Grid View Content</div> }));
vi.mock('@/organisms/SimulationOverview', () => ({ default: () => <div>Overview Content</div> }));
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

const makeStore = () =>
  configureStore({
    reducer: {
      class: classReducer,
      conflict: conflictReducer,
      metric: metricReducer,
      schedule: scheduleReducer,
      session: sessionReducer,
      ui: uiReducer,
    },
  });

const renderPage = () =>
  render(
    <Provider store={makeStore()}>
      <MemoryRouter initialEntries={['/simulations/sim-1']}>
        <Routes>
          <Route path="/simulations/:id" element={<TimetablePage />} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );

describe('TimetablePage — workspace tabs', () => {
  it('shows Grid View content by default', () => {
    renderPage();
    expect(screen.getByText('Grid View Content')).toBeInTheDocument();
  });

  it('switches to Overview content when the Overview tab is clicked', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('tab', { name: 'Overview' }));
    expect(screen.getByText('Overview Content')).toBeInTheDocument();
    expect(screen.queryByText('Grid View Content')).not.toBeInTheDocument();
  });
});
