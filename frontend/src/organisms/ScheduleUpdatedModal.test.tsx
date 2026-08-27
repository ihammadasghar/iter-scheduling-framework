import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import ScheduleUpdatedModal from './ScheduleUpdatedModal';
import proposalReducer from '@/store/reducers/proposalSlice';
import simulationReducer from '@/store/reducers/simulationSlice';
import { simulationService } from '@/services/simulationService';

vi.mock('@/services/simulationService', () => ({
  simulationService: {
    rebaseSimulation: vi.fn(),
  },
}));

const makeStore = (staleDraft: { simulationId: string } | null) =>
  configureStore({
    reducer: { proposal: proposalReducer, simulation: simulationReducer },
    preloadedState: {
      proposal: {
        proposals: [], blocked: [], current: null, loading: false, error: null,
        lastSubmission: null, staleDraft,
      },
      simulation: {
        simulations: [
          { id: 'sim-test', branchId: 'sim-test', createdAt: '2026-06-11T10:00:00Z', baseScheduleVersion: 'main-sha-1' },
        ],
        current: null,
        loading: false,
        error: null,
      },
    },
  });

const renderModal = (staleDraft: { simulationId: string } | null) => {
  const store = makeStore(staleDraft);
  return { store, ...render(<Provider store={store}><ScheduleUpdatedModal /></Provider>) };
};

describe('ScheduleUpdatedModal', () => {
  it('is not shown when there is no stale draft', () => {
    renderModal(null);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the dialog in plain, non-technical language when a draft has gone stale', () => {
    renderModal({ simulationId: 'sim-test' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /the published schedule has changed/i })).toBeInTheDocument();
    expect(screen.getByText(/scheduling office published updates/i)).toBeInTheDocument();
    // No raw technical terms like "sha", "version", "409", "conflict" in the copy.
    expect(screen.queryByText(/\bsha\b/i)).not.toBeInTheDocument();
  });

  it('"Cancel" clears the stale draft without calling rebaseSimulation', () => {
    const { store } = renderModal({ simulationId: 'sim-test' });
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(store.getState().proposal.staleDraft).toBeNull();
    expect(simulationService.rebaseSimulation).not.toHaveBeenCalled();
  });

  it('"Update My Draft" calls rebaseSimulation with the simulation\'s stored baseScheduleVersion', async () => {
    vi.mocked(simulationService.rebaseSimulation).mockResolvedValue({ baseScheduleVersion: 'main-sha-2' });
    renderModal({ simulationId: 'sim-test' });

    fireEvent.click(screen.getByRole('button', { name: /update my draft/i }));

    await waitFor(() =>
      expect(simulationService.rebaseSimulation).toHaveBeenCalledWith('sim-test', 'main-sha-1'),
    );
  });

  it('clears the stale draft and updates the stored baseScheduleVersion on success', async () => {
    vi.mocked(simulationService.rebaseSimulation).mockResolvedValue({ baseScheduleVersion: 'main-sha-2' });
    const { store } = renderModal({ simulationId: 'sim-test' });

    fireEvent.click(screen.getByRole('button', { name: /update my draft/i }));

    await waitFor(() => expect(store.getState().proposal.staleDraft).toBeNull());
    expect(store.getState().simulation.simulations[0]?.baseScheduleVersion).toBe('main-sha-2');
  });

  it('shows a plain-English confirmation after a successful update', async () => {
    vi.mocked(simulationService.rebaseSimulation).mockResolvedValue({ baseScheduleVersion: 'main-sha-2' });
    renderModal({ simulationId: 'sim-test' });

    fireEvent.click(screen.getByRole('button', { name: /update my draft/i }));

    await waitFor(() =>
      expect(screen.getByText(/updated with the latest published schedule/i)).toBeInTheDocument(),
    );
  });

  it('still clears the stale draft even when rebaseSimulation fails, leaving the error for the global snackbar', async () => {
    vi.mocked(simulationService.rebaseSimulation).mockRejectedValue({
      statusCode: 404, code: 'NOT_FOUND', message: 'Simulation not found or expired',
    });
    const { store } = renderModal({ simulationId: 'sim-test' });

    fireEvent.click(screen.getByRole('button', { name: /update my draft/i }));

    await waitFor(() => expect(store.getState().proposal.staleDraft).toBeNull());
    expect(store.getState().simulation.error).toBe('Simulation not found or expired');
    expect(screen.queryByText(/updated with the latest published schedule/i)).not.toBeInTheDocument();
  });
});
