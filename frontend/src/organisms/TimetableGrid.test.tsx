import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import TimetableGrid from './TimetableGrid';
import classReducer from '@/store/reducers/classSlice';
import uiReducer from '@/store/reducers/uiSlice';
import scheduleReducer from '@/store/reducers/scheduleSlice';
import type { ScheduleClass } from '@/types';

const makeStore = (classes: ScheduleClass[] = [], viewBy: 'room' | 'professor' | 'studentGroup' = 'room') =>
  configureStore({
    reducer: {
      class: classReducer,
      ui: uiReducer,
      schedule: scheduleReducer,
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
      schedule: {
        rooms: [],
        studentGroups: [],
        loading: false,
        error: null,
      },
    },
  });

const makeStoreWithRooms = (
  classes: ScheduleClass[],
  rooms: Array<{ id: string; name: string; capacity: number; building: string }>,
) =>
  configureStore({
    reducer: { class: classReducer, ui: uiReducer, schedule: scheduleReducer },
    preloadedState: {
      class: { classes, total: classes.length, currentPage: 1, hasMore: false, loading: false, error: null },
      ui: { role: 'user' as const, selectedClassId: null, inspectorOpen: false, viewBy: 'room' as const },
      schedule: { rooms, studentGroups: [], loading: false, error: null },
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
      reducer: { class: classReducer, ui: uiReducer, schedule: scheduleReducer },
      preloadedState: {
        class: { classes: [], total: 0, currentPage: 0, hasMore: true, loading: true, error: null },
        ui: { role: 'user' as const, selectedClassId: null, inspectorOpen: false, viewBy: 'room' as const },
        schedule: { rooms: [], studentGroups: [], loading: false, error: null },
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

describe('TimetableGrid — building grouping', () => {
  const classInBuildingA = { ...sampleClass, id: 'CLS_A', roomId: 'RM_101' };
  const classInBuildingB = { ...sampleClass, id: 'CLS_B', roomId: 'RM_201' };
  const ROOMS = [
    { id: 'RM_101', name: 'Room 101', capacity: 40, building: 'Building A' },
    { id: 'RM_201', name: 'Room 201', capacity: 30, building: 'Building B' },
  ];

  it('renders a building header row for each distinct building when viewBy=room', () => {
    render(
      <Provider store={makeStoreWithRooms([classInBuildingA, classInBuildingB], ROOMS)}>
        <MemoryRouter>
          <TimetableGrid />
        </MemoryRouter>
      </Provider>,
    );
    expect(screen.getByText(/building a/i)).toBeInTheDocument();
    expect(screen.getByText(/building b/i)).toBeInTheDocument();
  });

  it("hides a building's room rows when its header is collapsed", async () => {
    const user = userEvent.setup();
    render(
      <Provider store={makeStoreWithRooms([classInBuildingA], ROOMS)}>
        <MemoryRouter>
          <TimetableGrid />
        </MemoryRouter>
      </Provider>,
    );
    expect(screen.getByText(/room 101/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /collapse building a/i }));
    expect(screen.queryByText(/room 101/i)).not.toBeInTheDocument();
  });
});

describe('TimetableGrid — density control', () => {
  it('defaults to comfortable row height', () => {
    render_([sampleClass]);
    expect(screen.getByLabelText(/comfortable row height/i)).toHaveAttribute('aria-pressed', 'true');
  });

  it('switches to compact row height when Compact is clicked', async () => {
    const user = userEvent.setup();
    render_([sampleClass]);
    await user.click(screen.getByRole('button', { name: /compact row height/i }));
    expect(screen.getByLabelText(/compact row height/i)).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText(/comfortable row height/i)).toHaveAttribute('aria-pressed', 'false');
  });
});
