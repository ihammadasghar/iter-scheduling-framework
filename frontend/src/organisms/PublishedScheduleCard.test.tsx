import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import userEvent from '@testing-library/user-event';
import PublishedScheduleCard from './PublishedScheduleCard';
import simulationReducer from '@/store/reducers/simulationSlice';
import { simulationService } from '@/services/simulationService';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/services/simulationService', () => ({
  simulationService: {
    createSimulation: vi.fn(),
  },
}));

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

const makeStore = () => configureStore({ reducer: { simulation: simulationReducer } });

const renderCard = () =>
  render(
    <Provider store={makeStore()}>
      <MemoryRouter>
        <PublishedScheduleCard />
      </MemoryRouter>
    </Provider>,
  );

describe('PublishedScheduleCard', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('renders the published schedule summary', () => {
    renderCard();
    expect(screen.getByText('Official Published Schedule')).toBeInTheDocument();
  });

  it('creates a simulation from main and navigates to it when "View Schedule" is clicked', async () => {
    vi.mocked(simulationService.createSimulation).mockResolvedValue({
      id: 'sim-viewer-abc123',
      branchId: 'sim-viewer-abc123',
      createdAt: new Date().toISOString(),
    });

    renderCard();
    await userEvent.click(screen.getByRole('button', { name: /view schedule/i }));

    await waitFor(() =>
      expect(simulationService.createSimulation).toHaveBeenCalledWith('viewer'),
    );
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/simulations/sim-viewer-abc123'));
  });

  it('does not navigate if simulation creation fails', async () => {
    vi.mocked(simulationService.createSimulation).mockRejectedValue({
      statusCode: 500, code: 'INTERNAL_SERVER_ERROR', message: 'boom',
    });

    renderCard();
    await userEvent.click(screen.getByRole('button', { name: /view schedule/i }));

    await waitFor(() => expect(simulationService.createSimulation).toHaveBeenCalled());
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('never navigates to the old /simulations/main stub route', async () => {
    vi.mocked(simulationService.createSimulation).mockResolvedValue({
      id: 'sim-viewer-abc123',
      branchId: 'sim-viewer-abc123',
      createdAt: new Date().toISOString(),
    });

    renderCard();
    await userEvent.click(screen.getByRole('button', { name: /view schedule/i }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
    expect(mockNavigate).not.toHaveBeenCalledWith('/simulations/main');
  });
});
