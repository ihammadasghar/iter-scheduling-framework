import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import DeleteSimulationDialog from './DeleteSimulationDialog';
import simulationReducer from '@/store/reducers/simulationSlice';
import sessionReducer from '@/store/reducers/sessionSlice';
import classReducer from '@/store/reducers/classSlice';
import * as simulationService from '@/services/simulationService';

vi.mock('@/services/simulationService', () => ({
  simulationService: {
    deleteSimulation: vi.fn().mockResolvedValue(undefined),
    createSimulation: vi.fn(),
    getSimulationClasses: vi.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 50 }),
    updateClass: vi.fn(),
    getClassSuggestions: vi.fn(),
    getConflicts: vi.fn().mockResolvedValue([]),
    getMetrics: vi.fn().mockResolvedValue([]),
    sendHeartbeat: vi.fn(),
    commitSimulation: vi.fn(),
  },
}));

// simulationSlice.fulfilled calls localStorage.removeItem — needs mock in Node env
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

const makeStore = () =>
  configureStore({
    reducer: { simulation: simulationReducer, session: sessionReducer, class: classReducer },
    preloadedState: {
      simulation: {
        simulations: [{ id: 'sim-1', branchId: 'b', createdAt: new Date().toISOString() }],
        current: null,
        loading: false,
        error: null,
      },
    },
  });

const renderDialog = (open = true, onClose = vi.fn()) =>
  render(
    <Provider store={makeStore()}>
      <DeleteSimulationDialog open={open} simulationId="sim-1" onClose={onClose} />
    </Provider>,
  );

describe('DeleteSimulationDialog', () => {
  beforeEach(() => { localStorageMock.clear(); vi.clearAllMocks(); });
  it('renders confirmation message when open', () => {
    renderDialog();
    expect(screen.getByRole('heading', { name: /delete this draft/i })).toBeInTheDocument();
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    renderDialog(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Cancel button calls onClose', () => {
    const onClose = vi.fn();
    renderDialog(true, onClose);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('confirm delete calls service and closes dialog on success', async () => {
    vi.mocked(simulationService.simulationService.deleteSimulation).mockResolvedValueOnce(undefined);
    const onClose = vi.fn();
    renderDialog(true, onClose);

    fireEvent.click(screen.getByRole('button', { name: /yes, delete draft/i }));

    await waitFor(() => {
      expect(vi.mocked(simulationService.simulationService.deleteSimulation)).toHaveBeenCalledWith('sim-1');
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('shows inline error when delete fails (Gap 4)', async () => {
    vi.mocked(simulationService.simulationService.deleteSimulation).mockRejectedValueOnce({ statusCode: 404 });
    renderDialog();

    fireEvent.click(screen.getByRole('button', { name: /yes, delete draft/i }));

    await waitFor(() =>
      expect(screen.getByText(/could not delete/i)).toBeInTheDocument(),
    );
  });
});
