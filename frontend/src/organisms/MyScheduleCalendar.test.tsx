import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import MyScheduleCalendar from './MyScheduleCalendar';
import classReducer from '@/store/reducers/classSlice';
import uiReducer from '@/store/reducers/uiSlice';
import scheduleReducer from '@/store/reducers/scheduleSlice';
import conflictReducer from '@/store/reducers/conflictSlice';
import identityReducer from '@/store/reducers/identitySlice';
import type { ScheduleClass, Identity, Conflict } from '@/types';

const mineClass: ScheduleClass = {
  id: 'CLS_MINE', courseId: 'CRS_BIO101', title: 'Intro to Biology', professorId: 'PRF_SMITH',
  studentGroupId: 'GRP_BIO_Y1', roomId: 'RM_101', timeSlotIds: ['TS_MON_P1'],
};
const otherClass: ScheduleClass = {
  id: 'CLS_OTHER', courseId: 'CRS_HIS201', title: 'Modern History', professorId: 'PRF_JONES',
  studentGroupId: 'GRP_HIS_Y1', roomId: 'RM_102', timeSlotIds: ['TS_MON_P1'],
};

const TIME_SLOTS = [
  { id: 'TS_MON_P1', day: 'Monday', name: 'Period 1', startTime: '08:30', endTime: '10:15' },
];

const PROFESSOR_IDENTITY: Identity = { role: 'professor', professorId: 'PRF_SMITH', studentGroupId: null };

const makeStore = (opts: {
  classes?: ScheduleClass[];
  identity?: Identity | null;
  loading?: boolean;
  conflicts?: Conflict[];
} = {}) =>
  configureStore({
    reducer: {
      class: classReducer,
      ui: uiReducer,
      schedule: scheduleReducer,
      conflict: conflictReducer,
      identity: identityReducer,
    },
    preloadedState: {
      class: {
        classes: opts.classes ?? [mineClass, otherClass],
        total: 2, currentPage: 1, hasMore: false, loading: opts.loading ?? false, error: null,
      },
      schedule: {
        rooms: [], studentGroups: [], courses: [], professors: [],
        timeSlots: TIME_SLOTS, metadata: null, loading: false, error: null,
      },
      conflict: { conflicts: opts.conflicts ?? [], loading: false, lastFetchedAt: null, error: null },
      identity: { identity: opts.identity === undefined ? PROFESSOR_IDENTITY : opts.identity, hydrated: true },
    },
  });

const renderCalendar = (store: ReturnType<typeof makeStore>) =>
  render(
    <Provider store={store}>
      <MyScheduleCalendar />
    </Provider>,
  );

describe('MyScheduleCalendar', () => {
  it('renders only the signed-in professor\'s own classes', () => {
    renderCalendar(makeStore());
    expect(screen.getByText('BIO101')).toBeInTheDocument();
    expect(screen.queryByText('HIS201')).not.toBeInTheDocument();
  });

  it('renders only the signed-in student group\'s own classes', () => {
    const studentIdentity: Identity = { role: 'student', professorId: null, studentGroupId: 'GRP_HIS_Y1' };
    renderCalendar(makeStore({ identity: studentIdentity }));
    expect(screen.getByText('HIS201')).toBeInTheDocument();
    expect(screen.queryByText('BIO101')).not.toBeInTheDocument();
  });

  it('shows an empty-state message when the signed-in identity has no classes', () => {
    const noClassesIdentity: Identity = { role: 'professor', professorId: 'PRF_UNKNOWN', studentGroupId: null };
    renderCalendar(makeStore({ identity: noClassesIdentity }));
    expect(screen.getByText(/no classes are scheduled for you/i)).toBeInTheDocument();
  });

  it('renders the day column for the class\'s day', () => {
    renderCalendar(makeStore());
    expect(screen.getByText('Monday')).toBeInTheDocument();
  });

  it('clicking a class block selects it and opens the inspector', () => {
    const store = makeStore();
    renderCalendar(store);
    fireEvent.click(screen.getByText('BIO101'));
    expect(store.getState().ui.selectedClassId).toBe('CLS_MINE');
    expect(store.getState().ui.inspectorOpen).toBe(true);
  });

  it('dispatches deselectClass when clicking the calendar background', () => {
    const store = makeStore();
    renderCalendar(store);
    fireEvent.click(screen.getByLabelText('My schedule calendar'));
    expect(store.getState().ui.selectedClassId).toBeNull();
  });

  it('marks a conflicted class with a warning label', () => {
    const conflict: Conflict = {
      id: 'c1', type: 'ROOM_DOUBLE_BOOK', classIds: ['CLS_MINE', 'CLS_OTHER'], message: '',
    };
    const store = makeStore({ conflicts: [conflict] });
    render(
      <Provider store={store}>
        <MyScheduleCalendar conflictedClassIds={new Set(['CLS_MINE'])} />
      </Provider>,
    );
    expect(screen.getByLabelText(/BIO101 —/i)).toBeInTheDocument();
  });

  it('renders GridSkeleton while loading with no classes yet', () => {
    renderCalendar(makeStore({ classes: [], loading: true }));
    expect(screen.getByLabelText('Loading timetable…')).toBeInTheDocument();
  });

  it('filters by an explicit resource instead of identity when `resource` is provided', () => {
    const store = makeStore();
    render(
      <Provider store={store}>
        <MyScheduleCalendar resource={{ type: 'room', id: 'RM_102' }} />
      </Provider>,
    );
    expect(screen.getByText('HIS201')).toBeInTheDocument();
    expect(screen.queryByText('BIO101')).not.toBeInTheDocument();
  });

  it('drops an excluded day\'s column (and its classes) entirely, matching filterExcludedDays', () => {
    const store = makeStore();
    render(
      <Provider store={store}>
        <MyScheduleCalendar excludedDays={new Map([['Monday', 'Thanksgiving Break']])} />
      </Provider>,
    );
    expect(screen.queryByText('Monday')).not.toBeInTheDocument();
    expect(screen.queryByText('BIO101')).not.toBeInTheDocument();
  });

  it('renders a custom emptyMessage when provided and the resource has no classes', () => {
    const store = makeStore();
    render(
      <Provider store={store}>
        <MyScheduleCalendar
          resource={{ type: 'room', id: 'RM_NONEXISTENT' }}
          emptyMessage="No classes are scheduled for Room 999 this week."
        />
      </Provider>,
    );
    expect(screen.getByText('No classes are scheduled for Room 999 this week.')).toBeInTheDocument();
  });
});
