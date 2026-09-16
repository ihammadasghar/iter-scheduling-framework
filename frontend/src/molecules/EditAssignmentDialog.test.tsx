import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { IntlProvider } from 'react-intl';
import { configureStore } from '@reduxjs/toolkit';
import EditAssignmentDialog from './EditAssignmentDialog';
import classReducer from '@/store/reducers/classSlice';
import conflictReducer from '@/store/reducers/conflictSlice';
import metricReducer from '@/store/reducers/metricSlice';
import scoreReducer from '@/store/reducers/scoreSlice';
import scheduleReducer from '@/store/reducers/scheduleSlice';
import * as simulationService from '@/services/simulationService';
import type {
  RawProfessor, RawRoom, RawStudentGroup, RawTimeSlot, ScheduleClass, Suggestion,
} from '@/types';

vi.mock('@/services/simulationService', () => ({
  simulationService: {
    updateClass: vi.fn(),
    previewClassUpdate: vi.fn(),
    getConflicts: vi.fn().mockResolvedValue([]),
    getMetrics: vi.fn().mockResolvedValue([]),
    getScore: vi.fn().mockResolvedValue({ score: 0, breakdown: [] }),
    getClassSuggestions: vi.fn().mockResolvedValue([]),
  },
}));

const SIM_ID = 'sim-1';
const CLASS_ID = 'CLS_001';

const currentClass: ScheduleClass = {
  id: CLASS_ID,
  courseId: 'CRS_BIO101',
  title: 'Biology 101',
  professorId: 'PRF_SMITH',
  studentGroupId: 'GRP_BIO_Y1',
  roomId: 'RM_101',
  timeSlotIds: ['TS_MON_P1'],
};

const otherRoomClass: ScheduleClass = {
  id: 'CLS_ROOM_BUSY', courseId: 'CRS_CHEM101', title: 'Chemistry 101', professorId: 'PRF_JONES',
  studentGroupId: 'GRP_CHEM_Y1', roomId: 'RM_102', timeSlotIds: ['TS_MON_P1'],
};

const TIME_SLOTS: RawTimeSlot[] = [
  { id: 'TS_MON_P1', day: 'Monday', name: 'Period 1', startTime: '08:30', endTime: '10:15' },
  { id: 'TS_MON_P2', day: 'Monday', name: 'Period 2', startTime: '10:30', endTime: '12:15' },
  { id: 'TS_TUE_P1', day: 'Tuesday', name: 'Period 1', startTime: '09:00', endTime: '10:45' },
];

const ROOMS: RawRoom[] = [
  { id: 'RM_101', name: 'Room 101', capacity: 40, building: 'Main' },
  { id: 'RM_102', name: 'Room 102', capacity: 40, building: 'Main' },
  { id: 'RM_SMALL', name: 'Closet', capacity: 5, building: 'Main' },
];

const PROFESSORS: RawProfessor[] = [
  { id: 'PRF_SMITH', name: 'Dr. Smith', department: 'Biology' },
  { id: 'PRF_JONES', name: 'Dr. Jones', department: 'Chemistry' },
];

const GROUPS: RawStudentGroup[] = [
  { id: 'GRP_BIO_Y1', name: 'Bio Year 1', size: 30 },
  { id: 'GRP_CHEM_Y1', name: 'Chem Year 1', size: 30 },
];

const makeStore = (classes: ScheduleClass[] = [currentClass, otherRoomClass]) =>
  configureStore({
    reducer: {
      class: classReducer,
      conflict: conflictReducer,
      metric: metricReducer,
      score: scoreReducer,
      schedule: scheduleReducer,
    },
    preloadedState: {
      class: { classes, total: classes.length, currentPage: 1, hasMore: false, loading: false, error: null },
      schedule: {
        rooms: ROOMS, professors: PROFESSORS, studentGroups: GROUPS, courses: [], timeSlots: TIME_SLOTS,
        metadata: null, loading: false, error: null,
      },
    },
  });

const renderDialog = (
  store: ReturnType<typeof makeStore> = makeStore(),
  onClose: () => void = vi.fn(),
) =>
  render(
    <Provider store={store}>
      <IntlProvider locale="en" messages={{}}>
        <EditAssignmentDialog open simId={SIM_ID} classId={CLASS_ID} currentClass={currentClass} onClose={onClose} />
      </IntlProvider>
    </Provider>,
  );

describe('EditAssignmentDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('defaults every selector to the class\'s current values', () => {
    renderDialog();
    expect(screen.getByLabelText('Room')).toHaveTextContent('Room 101');
    expect(screen.getByLabelText('Professor')).toHaveTextContent('Dr. Smith');
    expect(screen.getByLabelText('Student Group')).toHaveTextContent('Bio Year 1');
    expect(screen.getByLabelText('Day')).toHaveTextContent('Monday');
    expect(screen.getByLabelText('Period')).toHaveTextContent('Monday Period 1');
  });

  it('disables Apply until something actually changes', () => {
    renderDialog();
    expect(screen.getByRole('button', { name: /apply changes/i })).toBeDisabled();
  });

  it('shows resource details (capacity, department, size) for the current selections', () => {
    renderDialog();
    expect(screen.getByText(/main · capacity 40/i)).toBeInTheDocument();
    expect(screen.getByText(/biology ·/i)).toBeInTheDocument();
    expect(screen.getByText(/30 students ·/i)).toBeInTheDocument();
  });

  it('shows capacity and building subtly for every room in the dropdown list, not just the selected one', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByLabelText('Room'));

    expect(await screen.findByRole('option', { name: /room 102.*main.*capacity 40/is })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /closet.*main.*capacity 5/is })).toBeInTheDocument();
  });

  it('keeps the closed Room field showing just the room name, not the capacity/building subtitle', () => {
    renderDialog();
    expect(screen.getByLabelText('Room')).toHaveTextContent(/^Room 101$/);
  });

  it('shows a capacity warning when the selected group is too big for the selected room', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByLabelText('Room'));
    await user.click(await screen.findByRole('option', { name: /^closet/i }));

    expect(await screen.findByText(/more than closet's capacity of 5/i)).toBeInTheDocument();
  });

  it('changing Day repopulates Period and enables Apply', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByLabelText('Day'));
    await user.click(await screen.findByRole('option', { name: 'Tuesday' }));

    expect(screen.getByLabelText('Period')).toHaveTextContent('Tuesday Period 1');
    expect(screen.getByRole('button', { name: /apply changes/i })).toBeEnabled();
  });

  it('announces to screen readers that Period options changed after a Day change', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByLabelText('Day'));
    await user.click(await screen.findByRole('option', { name: 'Tuesday' }));

    expect(await screen.findByText(/period options updated for tuesday/i)).toBeInTheDocument();
  });

  it('clears the Period-repopulated announcement after the hint duration elapses', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderDialog();
    await user.click(screen.getByLabelText('Day'));
    await user.click(await screen.findByRole('option', { name: 'Tuesday' }));

    expect(await screen.findByText(/period options updated for tuesday/i)).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(1200);

    expect(screen.queryByText(/period options updated for tuesday/i)).not.toBeInTheDocument();
  });

  it('does not fire the Period-repopulated announcement for the calendar click-to-set shortcut', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole('button', { name: 'Use Monday Period 2' }));

    expect(screen.queryByText(/period options updated for/i)).not.toBeInTheDocument();
  });

  it('warns when the candidate time clashes with the selected room\'s existing booking', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByLabelText('Room'));
    await user.click(await screen.findByRole('option', { name: /^room 102/i }));

    // RM_102 already has a class at TS_MON_P1 (otherRoomClass) — the default
    // Day/Period selection (Monday Period 1) now clashes with it.
    expect(await screen.findByText(/clashes with an existing class for the room/i)).toBeInTheDocument();
  });

  it('the click-to-set shortcut on the calendar updates Day/Period', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole('button', { name: 'Use Monday Period 2' }));

    expect(screen.getByLabelText('Period')).toHaveTextContent('Monday Period 2');
    expect(screen.getByRole('button', { name: /apply changes/i })).toBeEnabled();
  });

  it('shows the class being edited as a highlighted event at its current slot by default', () => {
    renderDialog();
    expect(screen.getByLabelText('This Class: Biology 101')).toBeInTheDocument();
  });

  it('moves the highlighted event to the new slot instead of duplicating it', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByRole('button', { name: 'Use Monday Period 2' }));

    // Still exactly one highlighted block for the class — it moved to
    // Monday Period 2 rather than a second one appearing alongside it.
    expect(screen.getAllByLabelText('This Class: Biology 101')).toHaveLength(1);
  });

  it('removes the highlighted event once the selection has no valid target slot', async () => {
    // A 2-period class, moved to Tuesday — which only has a single period
    // in this fixture — has no valid contiguous run to land on.
    const twoperiodClass: ScheduleClass = { ...currentClass, timeSlotIds: ['TS_MON_P1', 'TS_MON_P2'] };
    const store = makeStore([twoperiodClass, otherRoomClass]);
    const user = userEvent.setup();
    render(
      <Provider store={store}>
        <IntlProvider locale="en" messages={{}}>
          <EditAssignmentDialog open simId={SIM_ID} classId={CLASS_ID} currentClass={twoperiodClass} onClose={vi.fn()} />
        </IntlProvider>
      </Provider>,
    );
    expect(screen.getByLabelText('This Class: Biology 101')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Day'));
    await user.click(await screen.findByRole('option', { name: 'Tuesday' }));

    expect(screen.getByText(/doesn't have enough consecutive periods/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^This Class:/)).not.toBeInTheDocument();
  });


  it('applying commits room, professor, student group, and time together', async () => {
    vi.mocked(simulationService.simulationService.previewClassUpdate).mockResolvedValue({
      metrics: [], score: { score: 50, breakdown: [] },
    });
    vi.mocked(simulationService.simulationService.updateClass).mockResolvedValue({
      ...currentClass, roomId: 'RM_102', professorId: 'PRF_JONES', studentGroupId: 'GRP_CHEM_Y1', timeSlotIds: ['TS_MON_P2'],
    });
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderDialog(makeStore(), onClose);

    await user.click(screen.getByLabelText('Room'));
    await user.click(await screen.findByRole('option', { name: /^room 102/i }));
    await user.click(screen.getByLabelText('Professor'));
    await user.click(await screen.findByRole('option', { name: 'Dr. Jones' }));
    await user.click(screen.getByLabelText('Student Group'));
    await user.click(await screen.findByRole('option', { name: 'Chem Year 1' }));
    await user.click(screen.getByRole('button', { name: 'Use Monday Period 2' }));

    await user.click(screen.getByRole('button', { name: /apply changes/i }));

    await waitFor(() => {
      expect(simulationService.simulationService.updateClass).toHaveBeenCalledWith(
        SIM_ID, CLASS_ID,
        { roomId: 'RM_102', timeSlotIds: ['TS_MON_P2'], professorId: 'PRF_JONES', studentGroupId: 'GRP_CHEM_Y1' },
      );
    });
    expect(await screen.findByText(/moved to room 102 · dr\. jones · chem year 1/i)).toBeInTheDocument();
    // The dialog stays open to show the confirmation — it doesn't close
    // instantly, only after the auto-close delay (see the dedicated test).
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows an error and does not close when applying fails', async () => {
    vi.mocked(simulationService.simulationService.previewClassUpdate).mockRejectedValue(new Error('graph down'));
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderDialog(makeStore(), onClose);

    await user.click(screen.getByRole('button', { name: 'Use Monday Period 2' }));
    await user.click(screen.getByRole('button', { name: /apply changes/i }));

    expect(await screen.findByText(/failed to apply suggestion/i)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    // A failed apply never schedules an auto-close either.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.advanceTimersByTime(2000);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('auto-closes ~1.2s after a successful apply', async () => {
    // shouldAdvanceTime keeps fake time ticking with real elapsed time, so
    // Testing Library's internal waitFor/findBy polling still progresses —
    // we only need to jump the clock forward for the 1.2s close delay itself.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    vi.mocked(simulationService.simulationService.previewClassUpdate).mockResolvedValue({
      metrics: [], score: { score: 50, breakdown: [] },
    });
    vi.mocked(simulationService.simulationService.updateClass).mockResolvedValue({
      ...currentClass, roomId: 'RM_102', timeSlotIds: ['TS_MON_P2'],
    });
    const onClose = vi.fn();
    renderDialog(makeStore(), onClose);

    await user.click(screen.getByLabelText('Room'));
    await user.click(await screen.findByRole('option', { name: /^room 102/i }));
    await user.click(screen.getByRole('button', { name: 'Use Monday Period 2' }));
    await user.click(screen.getByRole('button', { name: /apply changes/i }));

    expect(await screen.findByText(/moved to room 102/i)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1200);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('a manual close right after a successful apply does not later double-fire onClose', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    vi.mocked(simulationService.simulationService.previewClassUpdate).mockResolvedValue({
      metrics: [], score: { score: 50, breakdown: [] },
    });
    vi.mocked(simulationService.simulationService.updateClass).mockResolvedValue({
      ...currentClass, roomId: 'RM_102', timeSlotIds: ['TS_MON_P2'],
    });
    const onClose = vi.fn();
    renderDialog(makeStore(), onClose);

    await user.click(screen.getByLabelText('Room'));
    await user.click(await screen.findByRole('option', { name: /^room 102/i }));
    await user.click(screen.getByRole('button', { name: 'Use Monday Period 2' }));
    await user.click(screen.getByRole('button', { name: /apply changes/i }));
    expect(await screen.findByText(/moved to room 102/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /close edit assignment dialog/i }));
    expect(onClose).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1200);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // Regression test: Inspector/ClassDetailSection don't key their children
  // by classId, so the same EditAssignmentDialog instance is reused across
  // class selections. Before the fix, its useState(currentClass.xxx) calls
  // only ran on first mount, so reopening for a different class kept
  // showing the previous class's room/professor/group/day.
  it('shows the newly selected class\'s values, not a stale previous class\'s, when reopened', () => {
    const secondClass: ScheduleClass = {
      id: 'CLS_002', courseId: 'CRS_CHEM101', title: 'Chemistry 101', professorId: 'PRF_JONES',
      studentGroupId: 'GRP_CHEM_Y1', roomId: 'RM_102', timeSlotIds: ['TS_TUE_P1'],
    };
    const store = makeStore([currentClass, otherRoomClass, secondClass]);
    const { rerender } = render(
      <Provider store={store}>
        <IntlProvider locale="en" messages={{}}>
          <EditAssignmentDialog open simId={SIM_ID} classId={CLASS_ID} currentClass={currentClass} onClose={vi.fn()} />
        </IntlProvider>
      </Provider>,
    );
    expect(screen.getByLabelText('Room')).toHaveTextContent('Room 101');

    // The dialog closes, a different class gets selected in the Inspector,
    // and "Edit" is clicked again — the same component instance survives
    // all of this, only its props change.
    rerender(
      <Provider store={store}>
        <IntlProvider locale="en" messages={{}}>
          <EditAssignmentDialog open={false} simId={SIM_ID} classId="CLS_002" currentClass={secondClass} onClose={vi.fn()} />
        </IntlProvider>
      </Provider>,
    );
    rerender(
      <Provider store={store}>
        <IntlProvider locale="en" messages={{}}>
          <EditAssignmentDialog open simId={SIM_ID} classId="CLS_002" currentClass={secondClass} onClose={vi.fn()} />
        </IntlProvider>
      </Provider>,
    );

    expect(screen.getByLabelText('Room')).toHaveTextContent('Room 102');
    expect(screen.getByLabelText('Professor')).toHaveTextContent('Dr. Jones');
    expect(screen.getByLabelText('Student Group')).toHaveTextContent('Chem Year 1');
    expect(screen.getByLabelText('Day')).toHaveTextContent('Tuesday');
    expect(screen.getByLabelText('Period')).toHaveTextContent('Tuesday Period 1');
  });

  it('closes via the header close button without applying anything', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderDialog(makeStore(), onClose);

    await user.click(screen.getByRole('button', { name: /close edit assignment dialog/i }));

    expect(onClose).toHaveBeenCalled();
    expect(simulationService.simulationService.updateClass).not.toHaveBeenCalled();
  });

  // Smart Suggestions used to live in the Inspector's Class Details panel —
  // it now renders inside this dialog, alongside the manual controls.
  describe('Smart Suggestions', () => {
    const SUGGESTION: Suggestion = { roomId: 'RM_102', timeSlotIds: ['TS_TUE_P1'], conflictFree: true };

    it('fetches and renders suggestions for the class being edited', async () => {
      vi.mocked(simulationService.simulationService.getClassSuggestions).mockResolvedValue([SUGGESTION]);
      renderDialog();

      expect(await screen.findByText('Smart Suggestions')).toBeInTheDocument();
      expect(simulationService.simulationService.getClassSuggestions).toHaveBeenCalledWith(SIM_ID, CLASS_ID);
      expect(await screen.findByRole('button', { name: /move biology 101 to room 102/i })).toBeInTheDocument();
    });

    it('selecting a suggestion stages Room/Day/Period without committing', async () => {
      vi.mocked(simulationService.simulationService.getClassSuggestions).mockResolvedValue([SUGGESTION]);
      const user = userEvent.setup();
      renderDialog();

      await user.click(await screen.findByRole('button', { name: /move biology 101 to room 102/i }));

      expect(screen.getByLabelText('Room')).toHaveTextContent('Room 102');
      expect(screen.getByLabelText('Day')).toHaveTextContent('Tuesday');
      expect(screen.getByLabelText('Period')).toHaveTextContent('Tuesday Period 1');
      expect(simulationService.simulationService.updateClass).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: /apply changes/i })).toBeEnabled();
    });

    it('Apply Changes commits the staged suggestion, leaving professor/group unchanged', async () => {
      vi.mocked(simulationService.simulationService.getClassSuggestions).mockResolvedValue([SUGGESTION]);
      vi.mocked(simulationService.simulationService.previewClassUpdate).mockResolvedValue({
        metrics: [], score: { score: 0, breakdown: [] },
      });
      vi.mocked(simulationService.simulationService.updateClass).mockResolvedValue({
        ...currentClass, roomId: SUGGESTION.roomId, timeSlotIds: [...SUGGESTION.timeSlotIds],
      });
      const user = userEvent.setup();
      renderDialog();

      await user.click(await screen.findByRole('button', { name: /move biology 101 to room 102/i }));
      await user.click(screen.getByRole('button', { name: /apply changes/i }));

      await waitFor(() => {
        expect(simulationService.simulationService.updateClass).toHaveBeenCalledWith(
          SIM_ID, CLASS_ID,
          {
            roomId: 'RM_102', timeSlotIds: ['TS_TUE_P1'],
            professorId: currentClass.professorId, studentGroupId: currentClass.studentGroupId,
          },
        );
      });
      expect(await screen.findByText(/moved to room 102/i)).toBeInTheDocument();
    });
  });
});
