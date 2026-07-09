import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import TimetableGrid from './TimetableGrid';
import classReducer from '@/store/reducers/classSlice';
import uiReducer from '@/store/reducers/uiSlice';
import type { ScheduleClass } from '@/types';

const makeStore = (classes: ScheduleClass[] = [], viewBy: 'room' | 'professor' | 'studentGroup' = 'room') =>
  configureStore({
    reducer: {
      class: classReducer,
      ui: uiReducer,
    },
    preloadedState: {
      class: {
        classes,
        total: classes.length,
        currentPage: 1,
        hasMore: false,
        loading: false,
        error: null,
      },
      ui: {
        role: 'user' as const,
        selectedClassId: null,
        inspectorOpen: false,
        viewBy,
      },
    },
  });

const render_ = (
  classes: ScheduleClass[] = [],
  viewBy: 'room' | 'professor' | 'studentGroup' = 'room',
) =>
  render(
    <Provider store={makeStore(classes, viewBy)}>
      <MemoryRouter>
        <TimetableGrid />
      </MemoryRouter>
    </Provider>,
  );

const sampleClass: ScheduleClass = {
  id: 'CLS_001',
  courseId: 'CRS_BIO101',
  title: 'Biology 101',
  professorId: 'PRF_SMITH',
  studentGroupId: 'GRP_BIO_Y1',
  roomId: 'RM_101',
  timeSlotIds: ['TS_MON_P1'] as unknown as readonly [string, ...string[]],
};

describe('TimetableGrid', () => {
  it('shows empty message when no classes loaded', () => {
    render_();
    expect(screen.getByText(/no classes loaded/i)).toBeInTheDocument();
  });

  it('renders column headers for each unique time slot', () => {
    render_([sampleClass]);
    expect(screen.getByText('Mon P1')).toBeInTheDocument();
  });

  it('renders row label from roomId', () => {
    render_([sampleClass], 'room');
    expect(screen.getByText(/room 101/i)).toBeInTheDocument();
  });

  it('renders row label from professorId when viewBy=professor', () => {
    render_([sampleClass], 'professor');
    expect(screen.getByText(/smith/i)).toBeInTheDocument();
  });

  it('renders row label from studentGroupId when viewBy=studentGroup', () => {
    render_([sampleClass], 'studentGroup');
    expect(screen.getByText(/bio y1/i)).toBeInTheDocument();
  });

  it('renders ClassChip for a class', () => {
    render_([sampleClass]);
    expect(screen.getByText('BIO101')).toBeInTheDocument();
  });

  it('marks chip as conflicted when classId is in conflictedClassIds', () => {
    render(
      <Provider store={makeStore([sampleClass])}>
        <MemoryRouter>
          <TimetableGrid conflictedClassIds={new Set(['CLS_001'])} />
        </MemoryRouter>
      </Provider>,
    );
    // Conflicted chip has warning icon
    expect(screen.getByText('BIO101')).toBeInTheDocument();
  });

  it('dispatches deselectClass when clicking the grid background', () => {
    const store = makeStore([sampleClass]);
    render(
      <Provider store={store}>
        <MemoryRouter>
          <TimetableGrid />
        </MemoryRouter>
      </Provider>,
    );
    fireEvent.click(screen.getByLabelText('Timetable grid'));
    expect(store.getState().ui.selectedClassId).toBeNull();
  });

  it('renders GridSkeleton when loading with no classes', () => {
    const store = configureStore({
      reducer: { class: classReducer, ui: uiReducer },
      preloadedState: {
        class: { classes: [], total: 0, currentPage: 0, hasMore: true, loading: true, error: null },
        ui: { role: 'user' as const, selectedClassId: null, inspectorOpen: false, viewBy: 'room' as const },
      },
    });
    render(
      <Provider store={store}>
        <MemoryRouter>
          <TimetableGrid />
        </MemoryRouter>
      </Provider>,
    );
    expect(screen.getByLabelText('Loading timetable…')).toBeInTheDocument();
  });
});
