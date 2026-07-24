import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RoomUtilisationHeatmap from './RoomUtilisationHeatmap';
import type { OccupancyLookup } from '@/utils/aggregateOccupancy';
import type { RawRoom, ScheduleClass } from '@/types';

const ROOMS: RawRoom[] = [{ id: 'RM_101', name: 'Room 101', capacity: 40, building: 'Building A' }];
const TS_IDS = ['TS_MON_P1'];

const CLASSES: ScheduleClass[] = [
  {
    id: 'CLS_001',
    courseId: 'CRS_BIO101',
    title: 'Biology 101',
    professorId: 'PRF_SMITH',
    studentGroupId: 'GRP_BIO_Y1',
    roomId: 'RM_101',
    timeSlotIds: ['TS_MON_P1'],
  },
  {
    id: 'CLS_002',
    courseId: 'CRS_CHM101',
    title: 'Chemistry 101',
    professorId: 'PRF_JONES',
    studentGroupId: 'GRP_CHM_Y1',
    roomId: 'RM_101',
    timeSlotIds: ['TS_MON_P1'],
  },
];

describe('RoomUtilisationHeatmap', () => {
  it('shows a message when there are no rooms', () => {
    render(<RoomUtilisationHeatmap occupancy={new Map()} rooms={[]} sortedTimeSlotIds={[]} classes={[]} />);
    expect(screen.getByText(/no room data available/i)).toBeInTheDocument();
  });

  it('renders a cell for a booked room/time-slot pair', () => {
    const occupancy: OccupancyLookup = new Map([
      ['RM_101', new Map([['TS_MON_P1', { seatFillRatio: 0.8, classIds: ['CLS_001'], hasConflict: false }]])],
    ]);
    render(<RoomUtilisationHeatmap occupancy={occupancy} rooms={ROOMS} sortedTimeSlotIds={TS_IDS} classes={CLASSES} />);
    expect(screen.getByLabelText(/room 101 80% full at mon p1/i)).toBeInTheDocument();
  });

  it('renders unbooked cells distinctly', () => {
    render(<RoomUtilisationHeatmap occupancy={new Map()} rooms={ROOMS} sortedTimeSlotIds={TS_IDS} classes={CLASSES} />);
    expect(screen.getByLabelText(/room 101 unbooked at mon p1/i)).toBeInTheDocument();
  });

  it('flags a conflicted cell', () => {
    const occupancy: OccupancyLookup = new Map([
      ['RM_101', new Map([['TS_MON_P1', { seatFillRatio: 1.5, classIds: ['CLS_001', 'CLS_002'], hasConflict: true }]])],
    ]);
    render(<RoomUtilisationHeatmap occupancy={occupancy} rooms={ROOMS} sortedTimeSlotIds={TS_IDS} classes={CLASSES} />);
    expect(screen.getByLabelText(/room 101 150% full at mon p1/i)).toBeInTheDocument();
  });

  it('toggles to a table view', async () => {
    const user = userEvent.setup();
    render(<RoomUtilisationHeatmap occupancy={new Map()} rooms={ROOMS} sortedTimeSlotIds={TS_IDS} classes={CLASSES} />);
    await user.click(screen.getByText(/view as table/i));
    expect(screen.getByLabelText(/room utilisation table/i)).toBeInTheDocument();
  });

  it('resolves the class title in the tooltip for a single booked class', async () => {
    const user = userEvent.setup();
    const occupancy: OccupancyLookup = new Map([
      ['RM_101', new Map([['TS_MON_P1', { seatFillRatio: 0.8, classIds: ['CLS_001'], hasConflict: false }]])],
    ]);
    render(<RoomUtilisationHeatmap occupancy={occupancy} rooms={ROOMS} sortedTimeSlotIds={TS_IDS} classes={CLASSES} />);
    const cell = screen.getByLabelText(/room 101 80% full at mon p1/i);
    await user.hover(cell);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Biology 101');
  });

  it('resolves and joins multiple class titles in the tooltip for a conflicted cell', async () => {
    const user = userEvent.setup();
    const occupancy: OccupancyLookup = new Map([
      ['RM_101', new Map([['TS_MON_P1', { seatFillRatio: 1.5, classIds: ['CLS_001', 'CLS_002'], hasConflict: true }]])],
    ]);
    render(<RoomUtilisationHeatmap occupancy={occupancy} rooms={ROOMS} sortedTimeSlotIds={TS_IDS} classes={CLASSES} />);
    const cell = screen.getByLabelText(/room 101 150% full at mon p1/i);
    await user.hover(cell);
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('Biology 101');
    expect(tooltip).toHaveTextContent('Chemistry 101');
  });

  it('includes the resolved class title in the table view cell text', async () => {
    const user = userEvent.setup();
    const occupancy: OccupancyLookup = new Map([
      ['RM_101', new Map([['TS_MON_P1', { seatFillRatio: 0.8, classIds: ['CLS_001'], hasConflict: false }]])],
    ]);
    render(<RoomUtilisationHeatmap occupancy={occupancy} rooms={ROOMS} sortedTimeSlotIds={TS_IDS} classes={CLASSES} />);
    await user.click(screen.getByText(/view as table/i));
    expect(screen.getByText(/80%.*biology 101/i)).toBeInTheDocument();
  });

  it('renders the header row, room rows, and gridcells with proper ARIA grid roles', () => {
    const occupancy: OccupancyLookup = new Map([
      ['RM_101', new Map([['TS_MON_P1', { seatFillRatio: 0.8, classIds: ['CLS_001'], hasConflict: false }]])],
    ]);
    render(<RoomUtilisationHeatmap occupancy={occupancy} rooms={ROOMS} sortedTimeSlotIds={TS_IDS} classes={CLASSES} />);
    // One header row + one row per room.
    expect(screen.getAllByRole('row')).toHaveLength(1 + ROOMS.length);
    // One column header per time slot.
    expect(screen.getAllByRole('columnheader')).toHaveLength(TS_IDS.length);
    // One row header per room.
    expect(screen.getAllByRole('rowheader')).toHaveLength(ROOMS.length);
    // One gridcell per room/time-slot pair.
    expect(screen.getAllByRole('gridcell')).toHaveLength(ROOMS.length * TS_IDS.length);
  });

  // The reference `sx={{ bgcolor: ... }}` styling was never actually rendered and
  // inspected for a sibling task (ConflictBreakdownChart's colors prop turned out to
  // color the wrong thing), so here real computed colors are asserted rather than assumed.
  it.each([
    [0.1, 'rgb(111, 174, 159)'], // RAMP[0]
    [0.3, 'rgb(76, 147, 133)'], // RAMP[1]
    [0.5, 'rgb(44, 125, 108)'], // RAMP[2]
    [0.7, 'rgb(4, 107, 94)'], // RAMP[3]
    [0.8, 'rgb(2, 59, 51)'], // RAMP[4] (0.8 is the boundary — falls into the last, fullest bucket)
    [1.5, 'rgb(2, 59, 51)'], // RAMP[4] — over-capacity still clamps to the darkest shade
  ])('renders the validated ramp color %s -> %s for the actual computed background', (ratio, expectedRgb) => {
    const occupancy: OccupancyLookup = new Map([
      ['RM_101', new Map([['TS_MON_P1', { seatFillRatio: ratio, classIds: ['CLS_001'], hasConflict: false }]])],
    ]);
    const { unmount } = render(
      <RoomUtilisationHeatmap occupancy={occupancy} rooms={ROOMS} sortedTimeSlotIds={TS_IDS} classes={CLASSES} />,
    );
    const pct = Math.round(ratio * 100);
    const cell = screen.getByLabelText(new RegExp(`room 101 ${pct}% full at mon p1`, 'i'));
    expect(getComputedStyle(cell).backgroundColor).toBe(expectedRgb);
    unmount();
  });

  it('renders the unbooked cell with the neutral (non-ramp) background color', () => {
    render(<RoomUtilisationHeatmap occupancy={new Map()} rooms={ROOMS} sortedTimeSlotIds={TS_IDS} classes={CLASSES} />);
    const cell = screen.getByLabelText(/room 101 unbooked at mon p1/i);
    expect(getComputedStyle(cell).backgroundColor).toBe('rgb(231, 232, 240)'); // #e7e8f0
  });

  it('renders a warning icon inside a conflicted cell', () => {
    const occupancy: OccupancyLookup = new Map([
      ['RM_101', new Map([['TS_MON_P1', { seatFillRatio: 1.5, classIds: ['CLS_001', 'CLS_002'], hasConflict: true }]])],
    ]);
    render(<RoomUtilisationHeatmap occupancy={occupancy} rooms={ROOMS} sortedTimeSlotIds={TS_IDS} classes={CLASSES} />);
    const cell = screen.getByLabelText(/room 101 150% full at mon p1/i);
    expect(cell.querySelector('[data-testid="WarningAmberIcon"]')).toBeInTheDocument();
  });
});
