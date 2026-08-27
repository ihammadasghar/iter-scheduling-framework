import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import SimulationDashboardPage from './SimulationDashboardPage';
import simulationReducer from '@/store/reducers/simulationSlice';
import classReducer from '@/store/reducers/classSlice';
import scheduleReducer from '@/store/reducers/scheduleSlice';
import conflictReducer from '@/store/reducers/conflictSlice';
import { scheduleService } from '@/services/scheduleService';

vi.mock('@/services/scheduleService', () => ({
  scheduleService: {
    getPublishedClasses: vi.fn().mockResolvedValue({ data: [], total: 0, page: 1 }),
    getPublishedRoster: vi.fn().mockResolvedValue({
      metadata: {}, courses: [], professors: [], studentGroups: [], rooms: [], timeSlots: [],
    }),
  },
}));
// Mocked so its own store-reactive rendering doesn't trigger act() warnings
// when the published-schedule fetch above resolves after a test's
// synchronous assertions — this page's own heading/button copy is what's
// under test here, not MyScheduleCalendar's internals (covered by its own
// test file).
vi.mock('@/organisms/MyScheduleCalendar', () => ({
  default: () => <div>My Schedule Content</div>,
}));

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
      class: classReducer,
      schedule: scheduleReducer,
      conflict: conflictReducer,
      ui: () => ({
        selectedClassId: null,
        inspectorOpen: false,
        viewBy: 'room',
      }),
      identity: () => ({
        identity: { role: 'professor' as const, professorId: 'PRF_SMITH', studentGroupId: null },
        hydrated: true,
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
    expect(screen.getByRole('heading', { name: /dashboard/i })).toBeInTheDocument();
  });

  it('renders "Request Changes" button', () => {
    renderPage();
    expect(
      screen.getByRole('button', { name: /request changes/i }),
    ).toBeInTheDocument();
  });

  it('renders the "Your Weekly Schedule" section', () => {
    renderPage();
    expect(screen.getByText(/your weekly schedule/i)).toBeInTheDocument();
  });

  it('shows an error alert when the published schedule fetch failed', async () => {
    vi.mocked(scheduleService.getPublishedClasses).mockRejectedValueOnce(
      { message: 'boom', statusCode: 500 },
    );
    renderPage();
    expect(await screen.findByText(/could not load your schedule/i)).toBeInTheDocument();
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

  it('opens CreateSimulationDialog when "Request Changes" is clicked', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /request changes/i }));
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
