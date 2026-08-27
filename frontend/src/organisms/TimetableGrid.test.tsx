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
import conflictReducer from '@/store/reducers/conflictSlice';
import type { Conflict, ScheduleClass } from '@/types';

const makeStore = (
  classes: ScheduleClass[] = [],
  viewBy: 'room' | 'professor' | 'studentGroup' = 'room',
  conflicts: Conflict[] = [],
) =>
  configureStore({
    reducer: {
      class: classReducer,
      ui: uiReducer,
      schedule: scheduleReducer,
      conflict: conflictReducer,
    },
    preloadedState: {
      conflict: { conflicts, loading: false, lastFetchedAt: null, error: null },
      class: {
        classes,
        total: classes.length,
        currentPage: 1,
        hasMore: false,
        loading: false,
        error: null,
      },
      ui: {
        selectedClassId: null,
        inspectorOpen: false,
        viewBy,
      },
      schedule: {
        rooms: [],
        studentGroups: [],
        courses: [],
        professors: [],
        timeSlots: [],
        metadata: null,
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
    reducer: { class: classReducer, ui: uiReducer, schedule: scheduleReducer, conflict: conflictReducer },
    preloadedState: {
      class: { classes, total: classes.length, currentPage: 1, hasMore: false, loading: false, error: null },
      ui: { selectedClassId: null, inspectorOpen: false, viewBy: 'room' as const },
      schedule: { rooms, studentGroups: [], courses: [], professors: [], timeSlots: [], metadata: null, loading: false, error: null },
      conflict: { conflicts: [], loading: false, lastFetchedAt: null, error: null },
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

  it('renders the professor\'s real roster name, not a number, for an opaque generated ID (the reported bug)', () => {
    // PRF_00001 has no readable fragment embedded in it — formatProfessorLabel
    // alone would render "00001". The fetched roster is what fixes this.
    const opaqueClass: ScheduleClass = { ...sampleClass, professorId: 'PRF_00001' };
    const store = configureStore({
      reducer: { class: classReducer, ui: uiReducer, schedule: scheduleReducer, conflict: conflictReducer },
      preloadedState: {
        class: { classes: [opaqueClass], total: 1, currentPage: 1, hasMore: false, loading: false, error: null },
        ui: { selectedClassId: null, inspectorOpen: false, viewBy: 'professor' as const },
        schedule: {
          rooms: [], studentGroups: [], courses: [], timeSlots: [],
          professors: [{ id: 'PRF_00001', name: 'Dr. Jane Smith', department: 'Biology' }],
          metadata: null, loading: false, error: null,
        },
      },
    });
    render(
      <Provider store={store}>
        <MemoryRouter>
          <TimetableGrid />
        </MemoryRouter>
      </Provider>,
    );
    expect(screen.getByText('Dr. Jane Smith')).toBeInTheDocument();
    expect(screen.queryByText('00001')).not.toBeInTheDocument();
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

  it('explains the actual conflict on the chip, not just "has conflict"', () => {
    // Different room so it lands in its own grid row rather than colliding
    // with sampleClass's room+timeslot cell — the conflict message itself is
    // resolved from CLS_001 (classIds[0]), so this doesn't affect the assertion.
    const otherClass: ScheduleClass = { ...sampleClass, id: 'CLS_002', courseId: 'CRS_CHEM101', roomId: 'RM_102' };
    const conflict: Conflict = {
      id: 'c1',
      type: 'ROOM_DOUBLE_BOOK',
      classIds: ['CLS_001', 'CLS_002'],
      message: '',
    };
    render(
      <Provider store={makeStore([sampleClass, otherClass], 'room', [conflict])}>
        <MemoryRouter>
          <TimetableGrid conflictedClassIds={new Set(['CLS_001'])} />
        </MemoryRouter>
      </Provider>,
    );
    expect(
      screen.getByLabelText(/BIO101 — Room 101 is booked for two classes at the same time/i),
    ).toBeInTheDocument();
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
      reducer: { class: classReducer, ui: uiReducer, schedule: scheduleReducer, conflict: conflictReducer },
      preloadedState: {
        class: { classes: [], total: 0, currentPage: 0, hasMore: true, loading: true, error: null },
        ui: { selectedClassId: null, inspectorOpen: false, viewBy: 'room' as const },
        schedule: { rooms: [], studentGroups: [], courses: [], professors: [], timeSlots: [], metadata: null, loading: false, error: null },
        conflict: { conflicts: [], loading: false, lastFetchedAt: null, error: null },
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

    // The row label's own Box is the actual styled element carrying rowHeight —
    // assert its rendered minHeight, not just the toggle button's own state.
    const rowLabel = screen.getByText(/room 101/i);
    expect(rowLabel.parentElement).toHaveStyle({ minHeight: '72px' });
  });

  it('switches to compact row height when Compact is clicked', async () => {
    const user = userEvent.setup();
    render_([sampleClass]);
    await user.click(screen.getByRole('button', { name: /compact row height/i }));
    expect(screen.getByLabelText(/compact row height/i)).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText(/comfortable row height/i)).toHaveAttribute('aria-pressed', 'false');

    const rowLabel = screen.getByText(/room 101/i);
    expect(rowLabel.parentElement).toHaveStyle({ minHeight: '44px' });
  });

  it('applies the density change to the building header row too', async () => {
    const user = userEvent.setup();
    const classInBuildingA = { ...sampleClass, id: 'CLS_A', roomId: 'RM_101' };
    const ROOMS = [{ id: 'RM_101', name: 'Room 101', capacity: 40, building: 'Building A' }];
    render(
      <Provider store={makeStoreWithRooms([classInBuildingA], ROOMS)}>
        <MemoryRouter>
          <TimetableGrid />
        </MemoryRouter>
      </Provider>,
    );

    const header = screen.getByText(/building a/i);
    expect(header.parentElement).toHaveStyle({ minHeight: '72px' });

    await user.click(screen.getByRole('button', { name: /compact row height/i }));
    expect(header.parentElement).toHaveStyle({ minHeight: '44px' });
  });

  describe('excludedDays', () => {
    const mondayClass: ScheduleClass = { ...sampleClass, id: 'CLS_MON', timeSlotIds: ['TS_MON_P1'] as unknown as readonly [string, ...string[]] };
    const tuesdayClass: ScheduleClass = {
      ...sampleClass, id: 'CLS_TUE', roomId: 'RM_102', timeSlotIds: ['TS_TUE_P1'] as unknown as readonly [string, ...string[]],
    };
    const TIME_SLOTS = [
      { id: 'TS_MON_P1', day: 'Monday', name: 'Period 1', startTime: '08:30', endTime: '10:15' },
      { id: 'TS_TUE_P1', day: 'Tuesday', name: 'Period 1', startTime: '08:30', endTime: '10:15' },
    ];

    const renderWithExcludedDays = (excludedDays: ReadonlySet<string>) => {
      const store = configureStore({
        reducer: { class: classReducer, ui: uiReducer, schedule: scheduleReducer, conflict: conflictReducer },
        preloadedState: {
          class: {
            classes: [mondayClass, tuesdayClass], total: 2, currentPage: 1, hasMore: false, loading: false, error: null,
          },
          ui: { selectedClassId: null, inspectorOpen: false, viewBy: 'room' as const },
          schedule: { rooms: [], studentGroups: [], courses: [], professors: [], timeSlots: TIME_SLOTS, metadata: null, loading: false, error: null },
          conflict: { conflicts: [], loading: false, lastFetchedAt: null, error: null },
        },
      });
      return render(
        <Provider store={store}>
          <MemoryRouter>
            <TimetableGrid excludedDays={excludedDays} />
          </MemoryRouter>
        </Provider>,
      );
    };

    it('renders both days\' columns when nothing is excluded', () => {
      renderWithExcludedDays(new Set());
      expect(screen.getByText('Mon P1')).toBeInTheDocument();
      expect(screen.getByText('Tue P1')).toBeInTheDocument();
    });

    it('drops a class (and its column, if no other class occupies it) on an excluded day', () => {
      renderWithExcludedDays(new Set(['Monday']));
      expect(screen.queryByText('Mon P1')).not.toBeInTheDocument();
      expect(screen.getByText('Tue P1')).toBeInTheDocument();
    });

    it('drops a resource row entirely when its only class falls on an excluded day', () => {
      renderWithExcludedDays(new Set(['Monday']));
      expect(screen.queryByText(/room 101/i)).not.toBeInTheDocument(); // CLS_MON's room
      expect(screen.getByText(/room 102/i)).toBeInTheDocument(); // CLS_TUE's room
    });
  });
});
