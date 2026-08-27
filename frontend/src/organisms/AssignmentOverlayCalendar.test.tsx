import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import AssignmentOverlayCalendar from './AssignmentOverlayCalendar';
import scheduleReducer from '@/store/reducers/scheduleSlice';
import { buildOverlayBlocks } from '@/utils/overlayLayout';
import type { RawCourse, RawTimeSlot, ScheduleClass } from '@/types';

const TIME_SLOTS: RawTimeSlot[] = [
  { id: 'TS_MON_P1', day: 'Monday', name: 'Period 1', startTime: '08:30', endTime: '10:15' },
  { id: 'TS_MON_P2', day: 'Monday', name: 'Period 2', startTime: '10:30', endTime: '12:15' },
];
const timeSlotById = new Map(TIME_SLOTS.map((t) => [t.id, t]));

const COURSE: RawCourse = { id: 'CRS_BIO101', code: 'BIO101', name: 'Intro to Biology', department: 'Biology' };

const roomClass: ScheduleClass = {
  id: 'CLS_ROOM', courseId: 'CRS_BIO101', title: 'Biology 101', professorId: 'PRF_OTHER',
  studentGroupId: 'GRP_OTHER', roomId: 'RM_101', timeSlotIds: ['TS_MON_P1'],
};

const makeStore = () =>
  configureStore({
    reducer: { schedule: scheduleReducer },
    preloadedState: {
      schedule: {
        rooms: [], studentGroups: [], professors: [], courses: [COURSE],
        timeSlots: TIME_SLOTS, loading: false, error: null,
      },
    },
  });

const renderCalendar = (props: Partial<React.ComponentProps<typeof AssignmentOverlayCalendar>> = {}) => {
  const blocks = props.blocks ?? buildOverlayBlocks(
    [{ source: 'room', classes: [roomClass] }],
    timeSlotById,
  );
  const classById = props.classById ?? new Map([[roomClass.id, roomClass]]);
  return render(
    <Provider store={makeStore()}>
      <AssignmentOverlayCalendar
        blocks={blocks}
        classById={classById}
        timeSlots={TIME_SLOTS}
        {...props}
      />
    </Provider>,
  );
};

describe('AssignmentOverlayCalendar', () => {
  it('shows the legend for all three sources', () => {
    renderCalendar();
    expect(screen.getByText('Room')).toBeInTheDocument();
    expect(screen.getByText('Professor')).toBeInTheDocument();
    expect(screen.getByText('Student Group')).toBeInTheDocument();
  });

  it('renders a busy block labelled with the course code', () => {
    renderCalendar();
    expect(screen.getByText('BIO101')).toBeInTheDocument();
  });

  it('renders one clickable region per timeslot per day and reports clicks', () => {
    const onSlotClick = vi.fn();
    renderCalendar({ onSlotClick });
    const target = screen.getByRole('button', { name: 'Use Monday Period 2' });
    target.click();
    expect(onSlotClick).toHaveBeenCalledWith('Monday', 'TS_MON_P2');
  });

  it('does not render clickable regions when onSlotClick is omitted', () => {
    renderCalendar();
    expect(screen.queryByRole('button', { name: /use monday/i })).not.toBeInTheDocument();
  });

  it('widens day columns to fit multiple overlapping classes without cutting off labels', () => {
    const classA: ScheduleClass = { ...roomClass, id: 'CLS_A' };
    const classB: ScheduleClass = { ...roomClass, id: 'CLS_B' };
    const blocks = buildOverlayBlocks(
      [
        { source: 'room', classes: [classA] },
        { source: 'professor', classes: [classB] },
      ],
      timeSlotById,
    );
    const classById = new Map([[classA.id, classA], [classB.id, classB]]);
    const { container } = renderCalendar({ blocks, classById });

    // Both classes sit at the same slot (TS_MON_P1) from different sources,
    // so laneCount is 2 — the day column must widen past the single-lane
    // default (110px) instead of squeezing two labels into it.
    const grid = container.querySelector(
      '[aria-label="Room, professor, and student group schedule overlay"] > div',
    );
    expect(grid).toHaveStyle({ gridTemplateColumns: '56px repeat(1, minmax(140px, 1fr))' });
  });

  it('shows the legend entry for the class being edited', () => {
    renderCalendar();
    expect(screen.getByText('This Class')).toBeInTheDocument();
  });

  it('renders the "editing" source as a highlighted block like any other event', () => {
    const editingClass: ScheduleClass = { ...roomClass, id: 'CLS_EDITING', timeSlotIds: ['TS_MON_P2'] };
    const blocks = buildOverlayBlocks(
      [{ source: 'editing', classes: [editingClass] }],
      timeSlotById,
    );
    const classById = new Map([[editingClass.id, editingClass]]);
    renderCalendar({ blocks, classById });

    const block = screen.getByLabelText('This Class: Biology 101');
    expect(block).toBeInTheDocument();
    expect(block).toHaveTextContent('BIO101');
  });
});
