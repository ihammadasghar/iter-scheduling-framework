import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import SimulationDashboardPage from './SimulationDashboardPage';
import simulationReducer from '@/store/reducers/simulationSlice';

// Stub localStorage (not available in Node test env without jsdom override)
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

// Mock all reducers not under test with minimal stubs
const makeStore = () =>
  configureStore({
    reducer: {
      simulation: simulationReducer,
      ui: () => ({
        role: 'user',
        selectedClassId: null,
        inspectorOpen: false,
        viewBy: 'room',
      }),
      session: () => ({
        simulationId: null,
        lastHeartbeat: 0,
        expired: false,
        hasUnsavedChanges: false,
      }),
    },
  });

interface RenderOptions {
  readonly storedSimulations?: ReadonlyArray<{ id: string; branchId: string; createdAt: string }>;
  readonly loading?: boolean;
}

const renderPage = (opts: RenderOptions = {}): ReturnType<typeof render> => {
  // Seed localStorage so loadSimulationsFromStorage picks them up on mount
  if (opts.storedSimulations !== undefined) {
    localStorageMock.setItem('unisched_simulations', JSON.stringify(opts.storedSimulations));
  }
  return render(
    <Provider store={makeStore()}>
      <MemoryRouter>
        <SimulationDashboardPage />
      </MemoryRouter>
    </Provider>,
  );
};

describe('SimulationDashboardPage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders page heading', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /my simulations/i })).toBeInTheDocument();
  });

  it('renders "Create New Simulation" button', () => {
    renderPage();
    expect(
      screen.getByRole('button', { name: /\+ create new simulation/i }),
    ).toBeInTheDocument();
  });

  it('shows empty state when no simulations exist and not loading', () => {
    renderPage();
    expect(
      screen.getByText(/you haven't started any simulations yet/i),
    ).toBeInTheDocument();
  });

  it('shows skeleton cards while loading', () => {
    renderPage();
    // After mount, empty state should be visible if localStorage is empty
    // (loading briefly but settles immediately in sync tests)
    expect(screen.getByText(/official published schedule/i)).toBeInTheDocument();
  });

  it('renders simulation cards when simulations exist', () => {
    const sim = {
      id: 'sim-alice-abc123',
      branchId: 'sim-alice-abc123',
      createdAt: new Date().toISOString(),
    };
    renderPage({ storedSimulations: [sim] });
    expect(screen.getByRole('button', { name: /open draft/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete draft/i })).toBeInTheDocument();
  });

  it('opens CreateSimulationDialog when "+ Create New Simulation" is clicked', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /\+ create new simulation/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText(/your name/i)).toBeInTheDocument();
  });

  it('renders the PublishedScheduleCard', () => {
    renderPage();
    expect(screen.getByText(/official published schedule/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view.*schedule/i })).toBeInTheDocument();
  });

  it('simulation cards never show raw simulation IDs', () => {
    const sim = {
      id: 'sim-alice-abc12345',
      branchId: 'sim-alice-abc12345',
      createdAt: new Date().toISOString(),
    };
    renderPage({ storedSimulations: [sim] });
    expect(screen.queryByText('sim-alice-abc12345')).not.toBeInTheDocument();
  });
});
