import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import RulesPage from './RulesPage';
import rulesReducer from '@/store/reducers/rulesSlice';
import uiReducer from '@/store/reducers/uiSlice';
import simulationReducer from '@/store/reducers/simulationSlice';
import classReducer from '@/store/reducers/classSlice';
import conflictReducer from '@/store/reducers/conflictSlice';
import metricReducer from '@/store/reducers/metricSlice';
import proposalReducer from '@/store/reducers/proposalSlice';
import sessionReducer from '@/store/reducers/sessionSlice';
import * as rulesService from '@/services/rulesService';

vi.mock('@/services/rulesService', () => ({
  rulesService: {
    getMetricRules: vi.fn().mockResolvedValue([]),
    createMetricRule: vi.fn(),
    deleteMetricRule: vi.fn(),
    getConstraints: vi.fn().mockResolvedValue([]),
    createConstraint: vi.fn(),
    deleteConstraint: vi.fn(),
  },
}));

const fakeMetric = {
  id: 'm1',
  name: 'Max daily load',
  target: 'lecturers',
  condition: 'max_classes_per_day',
  threshold: 4,
};

const fakeConstraint = {
  id: 'c1',
  name: 'No room double booking',
  target: 'rooms',
  violationCondition: 'room_double_book',
};

const makeStore = (overrides: Record<string, unknown> = {}) =>
  configureStore({
    reducer: {
      rules: rulesReducer,
      ui: uiReducer,
      simulation: simulationReducer,
      class: classReducer,
      conflict: conflictReducer,
      metric: metricReducer,
      proposal: proposalReducer,
      session: sessionReducer,
    },
    preloadedState: {
      rules: {
        metrics: [],
        constraints: [],
        loading: false,
        unavailable: false,
        error: null,
        ...overrides,
      },
    },
  });

const renderPage = (overrides: Record<string, unknown> = {}) =>
  render(
    <Provider store={makeStore(overrides)}>
      <MemoryRouter>
        <RulesPage />
      </MemoryRouter>
    </Provider>,
  );

describe('RulesPage', () => {
  it('renders page heading', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /rules.*constraints/i })).toBeInTheDocument();
  });

  it('shows unavailable alert when service returns 501', () => {
    renderPage({ unavailable: true });
    expect(screen.getByText(/not available yet/i)).toBeInTheDocument();
  });

  it('disables Add buttons when service is unavailable', () => {
    renderPage({ unavailable: true });
    expect(screen.getByRole('button', { name: /add metric/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /add constraint/i })).toBeDisabled();
  });

  it('renders metric rule cards with human-readable labels', () => {
    renderPage({ metrics: [fakeMetric] });
    expect(screen.getByText('Max daily load')).toBeInTheDocument();
    expect(screen.getByText(/maximum classes any lecturer/i)).toBeInTheDocument();
    expect(screen.queryByText('max_classes_per_day')).not.toBeInTheDocument();
  });

  it('renders constraint cards with human-readable labels', () => {
    renderPage({ constraints: [fakeConstraint] });
    expect(screen.getByText('No room double booking')).toBeInTheDocument();
    expect(screen.getByText(/room booked for two classes/i)).toBeInTheDocument();
    expect(screen.queryByText('room_double_book')).not.toBeInTheDocument();
  });

  it('opens Add Metric dialog on button click', async () => {
    renderPage();
    const btn = await waitFor(() => {
      const b = screen.getByRole('button', { name: /add metric/i });
      expect(b).not.toBeDisabled();
      return b;
    });
    fireEvent.click(btn);
    expect(screen.getByRole('heading', { name: /add metric rule/i })).toBeInTheDocument();
  });

  it('opens Add Constraint dialog on button click', async () => {
    renderPage();
    const btn = await waitFor(() => {
      const b = screen.getByRole('button', { name: /add constraint/i });
      expect(b).not.toBeDisabled();
      return b;
    });
    fireEvent.click(btn);
    expect(screen.getByRole('heading', { name: /add hard constraint/i })).toBeInTheDocument();
  });

  it('opens delete confirmation dialog when delete icon is clicked', () => {
    renderPage({ metrics: [fakeMetric] });
    fireEvent.click(screen.getByRole('button', { name: /delete metric rule: max daily load/i }));
    expect(screen.getByRole('heading', { name: /delete metric rule/i })).toBeInTheDocument();
    // "max daily load" appears both in card and in dialog — just check the dialog heading is there
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('dispatches delete thunk and shows snackbar on confirm', async () => {
    vi.mocked(rulesService.rulesService.deleteMetricRule).mockResolvedValueOnce(undefined);
    renderPage({ metrics: [fakeMetric] });
    fireEvent.click(screen.getByRole('button', { name: /delete metric rule: max daily load/i }));
    fireEvent.click(screen.getByRole('button', { name: /yes, delete/i }));
    await waitFor(() =>
      expect(vi.mocked(rulesService.rulesService.deleteMetricRule)).toHaveBeenCalledWith('m1'),
    );
    await waitFor(() =>
      expect(screen.getByText(/rule deleted/i)).toBeInTheDocument(),
    );
  });

  it('each delete icon button has an aria-label', () => {
    renderPage({ metrics: [fakeMetric], constraints: [fakeConstraint] });
    expect(
      screen.getByRole('button', { name: /delete metric rule: max daily load/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /delete constraint: no room double booking/i }),
    ).toBeInTheDocument();
  });
});
