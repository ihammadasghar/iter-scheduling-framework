import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import Inspector from './Inspector';
import classReducer from '@/store/reducers/classSlice';
import uiReducer from '@/store/reducers/uiSlice';
import conflictReducer from '@/store/reducers/conflictSlice';
import metricReducer from '@/store/reducers/metricSlice';
import sessionReducer from '@/store/reducers/sessionSlice';
import type { ScheduleClass } from '@/types';

// Mock the simulation service to avoid HTTP calls
vi.mock('@/services/simulationService', () => ({
  simulationService: {
    getClassSuggestions: vi.fn().mockResolvedValue([]),
    getSimulationClasses: vi.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 50 }),
    updateClass: vi.fn(),
    getConflicts: vi.fn().mockResolvedValue([]),
    getMetrics: vi.fn().mockResolvedValue([]),
  },
}));

const sampleClass: ScheduleClass = {
  id: 'CLS_001',
  courseId: 'CRS_BIO101',
  title: 'Biology 101 — Section A',
  professorId: 'PRF_SMITH',
  studentGroupId: 'GRP_BIO_Y1',
  roomId: 'RM_101',
  timeSlotIds: ['TS_MON_P1'] as unknown as readonly [string, ...string[]],
};

const makeStore = (overrides: {
  selectedClassId?: string | null;
  inspectorOpen?: boolean;
  classes?: ScheduleClass[];
} = {}) =>
  configureStore({
    reducer: {
      class: classReducer,
      ui: uiReducer,
      conflict: conflictReducer,
      metric: metricReducer,
      session: sessionReducer,
    },
    preloadedState: {
      class: {
        classes: overrides.classes ?? [],
        total: 0,
        currentPage: 0,
        hasMore: false,
        loading: false,
        error: null,
      },
      ui: {
        role: 'user' as const,
        selectedClassId: overrides.selectedClassId ?? null,
        inspectorOpen: overrides.inspectorOpen ?? false,
        viewBy: 'room' as const,
      },
    },
  });

const render_ = (overrides = {}) => {
  const store = makeStore(overrides);
  render(
    <Provider store={store}>
      <MemoryRouter>
        <Inspector simId="sim-test-123" />
      </MemoryRouter>
    </Provider>,
  );
  return store;
};

describe('Inspector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is hidden (translated off-screen) when inspectorOpen is false', () => {
    render_({ inspectorOpen: false });
    const panel = screen.getByLabelText('Class inspector panel');
    expect(panel).toHaveStyle({ transform: 'translateX(380px)' });
  });

  it('is visible (transform: 0) when inspectorOpen is true', () => {
    render_({ inspectorOpen: true });
    const panel = screen.getByLabelText('Class inspector panel');
    expect(panel).toHaveStyle({ transform: 'translateX(0)' });
  });

  it('shows InspectorSkeleton when open but no class selected', () => {
    render_({ inspectorOpen: true, selectedClassId: null });
    expect(screen.getByLabelText('Loading class details…')).toBeInTheDocument();
  });

  it('shows class details when a class is selected', () => {
    render_({
      inspectorOpen: true,
      selectedClassId: 'CLS_001',
      classes: [sampleClass],
    });
    expect(screen.getByText('BIO101')).toBeInTheDocument();
    expect(screen.getByText('Biology 101 — Section A')).toBeInTheDocument();
  });

  it('shows formatted professor name', () => {
    render_({
      inspectorOpen: true,
      selectedClassId: 'CLS_001',
      classes: [sampleClass],
    });
    expect(screen.getByText(/smith/i)).toBeInTheDocument();
  });

  it('shows formatted room name', () => {
    render_({
      inspectorOpen: true,
      selectedClassId: 'CLS_001',
      classes: [sampleClass],
    });
    expect(screen.getByText(/room 101/i)).toBeInTheDocument();
  });

  it('shows formatted time slot (full day name)', () => {
    render_({
      inspectorOpen: true,
      selectedClassId: 'CLS_001',
      classes: [sampleClass],
    });
    expect(screen.getByText(/monday period 1/i)).toBeInTheDocument();
  });

  it('closes inspector and deselects class on × click', () => {
    const store = render_({
      inspectorOpen: true,
      selectedClassId: 'CLS_001',
      classes: [sampleClass],
    });
    fireEvent.click(screen.getByRole('button', { name: /close inspector/i }));
    expect(store.getState().ui.inspectorOpen).toBe(false);
    expect(store.getState().ui.selectedClassId).toBeNull();
  });
});
