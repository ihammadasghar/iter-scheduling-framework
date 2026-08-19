import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import SimulationOverview from './SimulationOverview';
import classReducer from '@/store/reducers/classSlice';
import conflictReducer from '@/store/reducers/conflictSlice';
import metricReducer from '@/store/reducers/metricSlice';
import scheduleReducer from '@/store/reducers/scheduleSlice';
import type { ScheduleClass } from '@/types';

const sampleClass: ScheduleClass = {
  id: 'CLS_001',
  courseId: 'CRS_BIO101',
  title: 'Biology 101',
  professorId: 'PRF_SMITH',
  studentGroupId: 'GRP_BIO_Y1',
  roomId: 'RM_101',
  timeSlotIds: ['TS_MON_P1'],
};

const makeStore = (overrides: {
  classes?: ScheduleClass[];
  classLoading?: boolean;
  scheduleLoading?: boolean;
  scheduleError?: string | null;
} = {}) =>
  configureStore({
    reducer: {
      class: classReducer,
      conflict: conflictReducer,
      metric: metricReducer,
      schedule: scheduleReducer,
    },
    preloadedState: {
      class: {
        classes: overrides.classes ?? [],
        total: overrides.classes?.length ?? 0,
        currentPage: 1,
        hasMore: false,
        loading: overrides.classLoading ?? false,
        error: null,
      },
      conflict: { conflicts: [], loading: false, lastFetchedAt: null, error: null },
      metric: { metrics: [], loading: false, error: null },
      schedule: {
        rooms: [{ id: 'RM_101', name: 'Room 101', capacity: 40, building: 'Building A' }],
        studentGroups: [{ id: 'GRP_BIO_Y1', name: 'Bio Year 1', size: 32 }],
        loading: overrides.scheduleLoading ?? false,
        error: overrides.scheduleError ?? null,
      },
    },
  });

describe('SimulationOverview', () => {
  it('shows a skeleton while loading with no classes yet', () => {
    render(
      <Provider store={makeStore({ classLoading: true })}>
        <SimulationOverview onGoToGridView={vi.fn()} onSelectConflictType={vi.fn()} />
      </Provider>,
    );
    expect(screen.getByLabelText(/loading timetable/i)).toBeInTheDocument();
  });

  it('shows an empty state when there are no classes', () => {
    render(
      <Provider store={makeStore({ classes: [] })}>
        <SimulationOverview onGoToGridView={vi.fn()} onSelectConflictType={vi.fn()} />
      </Provider>,
    );
    expect(screen.getByText(/nothing to show yet/i)).toBeInTheDocument();
  });

  it('calls onGoToGridView when the empty-state button is clicked', () => {
    const onGoToGridView = vi.fn();
    render(
      <Provider store={makeStore({ classes: [] })}>
        <SimulationOverview onGoToGridView={onGoToGridView} onSelectConflictType={vi.fn()} />
      </Provider>,
    );
    screen.getByRole('button', { name: /go to grid view/i }).click();
    expect(onGoToGridView).toHaveBeenCalledOnce();
  });

  it('renders the health summary, heatmap, conflict chart and metrics when classes exist', () => {
    render(
      <Provider store={makeStore({ classes: [sampleClass] })}>
        <SimulationOverview onGoToGridView={vi.fn()} onSelectConflictType={vi.fn()} />
      </Provider>,
    );
    expect(screen.getByText(/no scheduling conflicts/i)).toBeInTheDocument();
    expect(screen.getByText(/room utilisation/i)).toBeInTheDocument();
    expect(screen.getByText(/conflicts by type/i)).toBeInTheDocument();
    expect(screen.getByText(/^metrics$/i)).toBeInTheDocument();
  });

  it('shows an error alert when the schedule fetch failed, while still rendering the rest of the overview', () => {
    render(
      <Provider
        store={makeStore({ classes: [sampleClass], scheduleError: 'Network error' })}
      >
        <SimulationOverview onGoToGridView={vi.fn()} onSelectConflictType={vi.fn()} />
      </Provider>,
    );
    expect(screen.getByText(/couldn't load room data for this draft/i)).toBeInTheDocument();
    expect(screen.getByText(/no scheduling conflicts/i)).toBeInTheDocument();
    expect(screen.getByText(/^metrics$/i)).toBeInTheDocument();
  });
});
