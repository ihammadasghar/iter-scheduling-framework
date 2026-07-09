import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import SessionExpiryModal from './SessionExpiryModal';
import sessionReducer from '@/store/reducers/sessionSlice';
import simulationReducer from '@/store/reducers/simulationSlice';
import classReducer from '@/store/reducers/classSlice';
import uiReducer from '@/store/reducers/uiSlice';
import conflictReducer from '@/store/reducers/conflictSlice';
import metricReducer from '@/store/reducers/metricSlice';
import proposalReducer from '@/store/reducers/proposalSlice';
import rulesReducer from '@/store/reducers/rulesSlice';

vi.mock('@/services/simulationService', () => ({
  simulationService: {
    sendHeartbeat: vi.fn(),
    createSimulation: vi.fn().mockResolvedValue({ id: 'sim-new', branchId: 'b', createdAt: new Date().toISOString() }),
    getSimulationClasses: vi.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 50 }),
    updateClass: vi.fn(),
    getClassSuggestions: vi.fn(),
    getConflicts: vi.fn().mockResolvedValue([]),
    getMetrics: vi.fn().mockResolvedValue([]),
    commitSimulation: vi.fn(),
    deleteSimulation: vi.fn(),
  },
}));

const makeStore = (expired = false) =>
  configureStore({
    reducer: {
      session: sessionReducer, simulation: simulationReducer, class: classReducer,
      ui: uiReducer, conflict: conflictReducer, metric: metricReducer,
      proposal: proposalReducer, rules: rulesReducer,
    },
    preloadedState: {
      session: { simulationId: 'sim-1', lastHeartbeat: 0, expired, hasUnsavedChanges: false, lastPatchAt: 0 },
    },
  });

const renderModal = (expired = false) => {
  const store = makeStore(expired);
  return {
    store,
    ...render(
      <Provider store={store}>
        <MemoryRouter>
          <SessionExpiryModal />
        </MemoryRouter>
      </Provider>,
    ),
  };
};

describe('SessionExpiryModal', () => {
  it('is not shown when session is not expired', () => {
    renderModal(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the expiry dialog when expired=true', () => {
    renderModal(true);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /your session has ended/i })).toBeInTheDocument();
  });

  it('shows the body message about saved changes', () => {
    renderModal(true);
    expect(screen.getByText(/any changes you saved are still there/i)).toBeInTheDocument();
  });

  it('"Go Back to My Simulations" clears session state', () => {
    const { store } = renderModal(true);
    fireEvent.click(screen.getByRole('button', { name: /go back to my simulations/i }));
    expect(store.getState().session.simulationId).toBeNull();
    expect(store.getState().session.expired).toBe(false);
  });

  it('"Start a New Draft" opens the CreateSimulationDialog', () => {
    renderModal(true);
    fireEvent.click(screen.getByRole('button', { name: /start a new draft/i }));
    expect(screen.getByRole('heading', { name: /create new simulation/i })).toBeInTheDocument();
  });
});
