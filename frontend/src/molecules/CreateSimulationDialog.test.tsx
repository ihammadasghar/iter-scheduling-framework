import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import CreateSimulationDialog from './CreateSimulationDialog';
import simulationReducer from '@/store/reducers/simulationSlice';
import sessionReducer from '@/store/reducers/sessionSlice';
import classReducer from '@/store/reducers/classSlice';
import * as simulationService from '@/services/simulationService';

vi.mock('@/services/simulationService', () => ({
  simulationService: {
    createSimulation: vi.fn().mockResolvedValue({
      id: 'sim-new',
      branchId: 'branch-new',
      createdAt: new Date().toISOString(),
    }),
    getSimulationClasses: vi.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 50 }),
    deleteSimulation: vi.fn(),
    updateClass: vi.fn(),
    getClassSuggestions: vi.fn(),
    getConflicts: vi.fn().mockResolvedValue([]),
    getMetrics: vi.fn().mockResolvedValue([]),
    sendHeartbeat: vi.fn(),
    commitSimulation: vi.fn(),
  },
}));

// simulationSlice.fulfilled calls localStorage.setItem — need mock in Node env
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
  });

const renderDialog = (open = true, onClose = vi.fn()) =>
  render(
    <Provider store={makeStore()}>
      <MemoryRouter>
        <CreateSimulationDialog open={open} onClose={onClose} />
      </MemoryRouter>
    </Provider>,
  );

describe('CreateSimulationDialog', () => {
  beforeEach(() => { localStorageMock.clear(); vi.clearAllMocks(); });

  it('renders name field when open', () => {
    renderDialog();
    expect(screen.getByLabelText(/your name/i)).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    renderDialog(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows validation error if name is empty when Enter is pressed', async () => {
    renderDialog();
    const input = screen.getByLabelText(/your name/i);
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() =>
      expect(screen.getByText(/please enter your name/i)).toBeInTheDocument(),
    );
  });

  it('calls createSimulation with trimmed name on submit', async () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: '  Alice  ' } });
    fireEvent.click(screen.getByRole('button', { name: /create simulation/i }));
    await waitFor(() =>
      expect(vi.mocked(simulationService.simulationService.createSimulation)).toHaveBeenCalledWith('Alice'),
    );
  });

  it('Cancel button calls onClose', () => {
    const onClose = vi.fn();
    renderDialog(true, onClose);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('Enter key submits the form', async () => {
    renderDialog();
    const input = screen.getByLabelText(/your name/i);
    fireEvent.change(input, { target: { value: 'Bob' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() =>
      expect(vi.mocked(simulationService.simulationService.createSimulation)).toHaveBeenCalledWith('Bob'),
    );
  });
});

describe('CreateSimulationDialog', () => {
  it('renders name field when open', () => {
    renderDialog();
    expect(screen.getByLabelText(/your name/i)).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    renderDialog(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows validation error if name is empty when Enter is pressed', async () => {
    renderDialog();
    const input = screen.getByLabelText(/your name/i);
    // Submit via Enter with empty field — button is disabled, Enter key triggers handleSubmit
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() =>
      expect(screen.getByText(/please enter your name/i)).toBeInTheDocument(),
    );
  });

  it('calls createSimulation with trimmed name on submit', async () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: '  Alice  ' } });
    fireEvent.click(screen.getByRole('button', { name: /create simulation/i }));
    await waitFor(() =>
      expect(vi.mocked(simulationService.simulationService.createSimulation)).toHaveBeenCalledWith('Alice'),
    );
  });

  it('Cancel button calls onClose', () => {
    const onClose = vi.fn();
    renderDialog(true, onClose);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('Enter key submits the form', async () => {
    renderDialog();
    const input = screen.getByLabelText(/your name/i);
    fireEvent.change(input, { target: { value: 'Bob' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() =>
      expect(vi.mocked(simulationService.simulationService.createSimulation)).toHaveBeenCalledWith('Bob'),
    );
  });
});
