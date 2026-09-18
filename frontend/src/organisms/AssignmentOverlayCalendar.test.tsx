import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { IntlProvider } from 'react-intl';
import { configureStore } from '@reduxjs/toolkit';
import AssignmentOverlayCalendar from './AssignmentOverlayCalendar';
import scheduleReducer from '@/store/reducers/scheduleSlice';
import { buildOverlayBlocks } from '@/utils/overlayLayout';
import type { RawCourse, RawRoom, RawTimeSlot, ScheduleClass } from '@/types';

const TIME_SLOTS: RawTimeSlot[] = [
  { id: 'TS_MON_P1', day: 'Monday', name: 'Period 1', startTime: '08:30', endTime: '10:15' },
  { id: 'TS_MON_P2', day: 'Monday', name: 'Period 2', startTime: '10:30', endTime: '12:15' },
];
const timeSlotById = new Map(TIME_SLOTS.map((t) => [t.id, t]));

const COURSE: RawCourse = { id: 'CRS_BIO101', code: 'BIO101', name: 'Intro to Biology', department: 'Biology' };
const ROOM: RawRoom = { id: 'RM_101', name: 'Building A - 204', capacity: 30, building: 'Building A' };

const roomClass: ScheduleClass = {
  id: 'CLS_ROOM', courseId: 'CRS_BIO101', title: 'Biology 101', professorId: 'PRF_OTHER',
  studentGroupId: 'GRP_OTHER', roomId: 'RM_101', timeSlotIds: ['TS_MON_P1'],
};

const makeStore = () =>
  configureStore({
    reducer: { schedule: scheduleReducer },
    preloadedState: {
      schedule: {
        rooms: [ROOM], studentGroups: [], professors: [], courses: [COURSE],
        timeSlots: TIME_SLOTS, metadata: null, loading: false, error: null,
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
      <IntlProvider locale="en" messages={{}}>
        <AssignmentOverlayCalendar
          blocks={blocks}
          classById={classById}
          timeSlots={TIME_SLOTS}
          {...props}
        />
      </IntlProvider>
    </Provider>,
  );
};

describe('AssignmentOverlayCalendar', () => {
  it('labels a room busy block with the room name instead of the course code', () => {
    renderCalendar();
    expect(screen.getByText('Room Building A - 204 busy')).toBeInTheDocument();
    expect(screen.queryByText('BIO101')).not.toBeInTheDocument();
  });

  it('shows a tooltip on hover saying what the room is busy with', async () => {
    renderCalendar();
    const user = userEvent.setup();
    const block = screen.getByLabelText('Room Building A - 204 busy with Biology 101');
    await user.hover(block);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Room Building A - 204 busy with Biology 101');
  });

  it('forwards a click on a busy block to the same click-to-set-slot shortcut as the slot underneath', () => {
    const onSlotClick = vi.fn();
    renderCalendar({ onSlotClick });
    const block = screen.getByLabelText('Room Building A - 204 busy with Biology 101');
    block.click();
    expect(onSlotClick).toHaveBeenCalledWith('Monday', 'TS_MON_P1');
  });

  it('gives every busy block the same neutral background, regardless of source', () => {
    renderCalendar();
    expect(screen.getByLabelText('Room Building A - 204 busy with Biology 101')).toHaveStyle({ backgroundColor: 'rgb(229, 232, 244)' });
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

  it('shows a hint that empty slots are clickable when onSlotClick is provided', () => {
    renderCalendar({ onSlotClick: vi.fn() });
    expect(screen.getByText('Click an empty slot to set day & period.')).toBeInTheDocument();
  });

  it('does not show the click-to-set hint when onSlotClick is omitted', () => {
    renderCalendar();
    expect(screen.queryByText('Click an empty slot to set day & period.')).not.toBeInTheDocument();
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
    // default (160px) instead of squeezing two labels into it.
    const grid = container.querySelector(
      '[aria-label="Room, professor, and student group schedule overlay"] > div',
    );
    expect(grid).toHaveStyle({ gridTemplateColumns: '56px repeat(1, minmax(260px, 1fr))' });
  });

  it('renders the "editing" source as a highlighted block, still labelled with the course code', () => {
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

  it('animates the "editing" block\'s position so it slides rather than pops when the slot changes', () => {
    const editingClass: ScheduleClass = { ...roomClass, id: 'CLS_EDITING', timeSlotIds: ['TS_MON_P2'] };
    const blocks = buildOverlayBlocks(
      [{ source: 'editing', classes: [editingClass] }],
      timeSlotById,
    );
    const classById = new Map([[editingClass.id, editingClass]]);
    renderCalendar({ blocks, classById });

    const block = screen.getByLabelText('This Class: Biology 101');
    expect(block).toHaveStyle({ transition: 'top 0.2s ease-out,left 0.2s ease-out,opacity 0.15s' });
  });

  it('does not animate the position of busy blocks from other sources', () => {
    renderCalendar();
    const block = screen.getByLabelText('Room Building A - 204 busy with Biology 101');
    expect(block).toHaveStyle({ transition: 'opacity 0.15s' });
  });

  it('highlights the "editing" block with a colored border like a selected class elsewhere in the app', () => {
    const editingClass: ScheduleClass = { ...roomClass, id: 'CLS_EDITING', timeSlotIds: ['TS_MON_P2'] };
    const blocks = buildOverlayBlocks(
      [{ source: 'editing', classes: [editingClass] }],
      timeSlotById,
    );
    const classById = new Map([[editingClass.id, editingClass]]);
    renderCalendar({ blocks, classById });

    const block = screen.getByLabelText('This Class: Biology 101');
    expect(block).toHaveStyle({ borderWidth: '2px' });
  });

  it('does not highlight busy blocks from other sources with a border', () => {
    renderCalendar();
    const block = screen.getByLabelText('Room Building A - 204 busy with Biology 101');
    expect(block).toHaveStyle({ borderWidth: '0px' });
  });

  it('dims non-editing (busy) blocks so the editing block stands out', () => {
    renderCalendar();
    expect(screen.getByLabelText('Room Building A - 204 busy with Biology 101')).toHaveStyle({ opacity: '0.4' });
  });

  it('never dims the editing block', () => {
    const editingClass: ScheduleClass = { ...roomClass, id: 'CLS_EDITING', timeSlotIds: ['TS_MON_P2'] };
    const blocks = buildOverlayBlocks(
      [{ source: 'room', classes: [roomClass] }, { source: 'editing', classes: [editingClass] }],
      timeSlotById,
    );
    const classById = new Map([[roomClass.id, roomClass], [editingClass.id, editingClass]]);
    renderCalendar({ blocks, classById });

    expect(screen.getByLabelText('This Class: Biology 101')).toHaveStyle({ opacity: '1' });
  });
});
