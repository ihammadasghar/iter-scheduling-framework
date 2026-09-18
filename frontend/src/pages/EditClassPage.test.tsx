import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Provider } from 'react-redux';
import { IntlProvider } from 'react-intl';
import { configureStore } from '@reduxjs/toolkit';
import EditClassPage from './EditClassPage';
import classReducer from '@/store/reducers/classSlice';
import conflictReducer from '@/store/reducers/conflictSlice';
import metricReducer from '@/store/reducers/metricSlice';
import scoreReducer from '@/store/reducers/scoreSlice';
import scheduleReducer from '@/store/reducers/scheduleSlice';
import identityReducer from '@/store/reducers/identitySlice';
import languageReducer from '@/store/reducers/languageSlice';
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
    sendHeartbeat: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/hooks/useHeartbeat', () => ({ useHeartbeat: vi.fn() }));
vi.mock('@/hooks/useInactivityWarning', () => ({
  useInactivityWarning: vi.fn().mockReturnValue({ showWarning: false, dismiss: vi.fn() }),
}));
vi.mock('@/organisms/SessionExpiryModal', () => ({ default: () => null }));

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
      identity: identityReducer,
      language: languageReducer,
    },
    preloadedState: {
      class: { classes, total: classes.length, currentPage: 1, hasMore: false, loading: false, error: null },
      schedule: {
        rooms: ROOMS, professors: PROFESSORS, studentGroups: GROUPS, courses: [], timeSlots: TIME_SLOTS,
        metadata: null, loading: false, error: null,
      },
    },
  });

const renderPage = (
  store: ReturnType<typeof makeStore> = makeStore(),
  classId: string = CLASS_ID,
) =>
  render(
    <Provider store={store}>
      <IntlProvider locale="en" messages={{}}>
        <MemoryRouter initialEntries={[`/simulations/${SIM_ID}/classes/${classId}/edit`]}>
          <Routes>
            <Route path="/simulations/:id/classes/:classId/edit" element={<EditClassPage />} />
            <Route path="/simulations/:id" element={<div>Timetable Page</div>} />
          </Routes>
        </MemoryRouter>
      </IntlProvider>
    </Provider>,
  );

describe('EditClassPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows every field defaulted to the class\'s current values as static text', () => {
    renderPage();
    expect(screen.getByText('Room 101')).toBeInTheDocument();
    expect(screen.getByText('Dr. Smith')).toBeInTheDocument();
    expect(screen.getByText('Bio Year 1')).toBeInTheDocument();
    expect(screen.getByText('Monday Period 1')).toBeInTheDocument();
  });

  it('disables Apply until something actually changes', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /apply changes/i })).toBeDisabled();
  });

  it('shows resource details (capacity, department, size) for the current selections', () => {
    renderPage();
    expect(screen.getByText(/main · capacity 40/i)).toBeInTheDocument();
    expect(screen.getByText(/biology ·/i)).toBeInTheDocument();
    expect(screen.getByText(/30 students ·/i)).toBeInTheDocument();
  });

  it('does not show the Day/Period dropdowns until Select Timeslot Manually is clicked', () => {
    renderPage();
    expect(screen.queryByLabelText('Day')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Period')).not.toBeInTheDocument();
  });

  it('changing Room via its Edit popover updates the displayed text and enables Apply', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Change Room' }));
    expect(await screen.findByRole('menuitem', { name: /room 102.*main.*capacity 40/is })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /closet.*main.*capacity 5/is })).toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: /^room 102/i }));

    expect(screen.getByText('Room 102')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /apply changes/i })).toBeEnabled();
  });

  it('shows a capacity warning when the selected group is too big for the newly selected room', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Change Room' }));
    await user.click(await screen.findByRole('menuitem', { name: /^closet/i }));

    expect(await screen.findByText(/more than closet's capacity of 5/i)).toBeInTheDocument();
  });

  it('warns when the candidate time clashes with the newly selected room\'s existing booking', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Change Room' }));
    await user.click(await screen.findByRole('menuitem', { name: /^room 102/i }));

    // RM_102 already has a class at TS_MON_P1 (otherRoomClass) — the default
    // Day/Period selection (Monday Period 1) now clashes with it.
    expect(await screen.findByText(/clashes with an existing class for the room/i)).toBeInTheDocument();
  });

  it('the calendar click-to-set shortcut updates the Time text and enables Apply', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Use Monday Period 2' }));

    expect(screen.getByText('Monday Period 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /apply changes/i })).toBeEnabled();
  });

  it('Select Timeslot Manually opens Day/Period dropdowns; changing Day repopulates Period', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Select Timeslot Manually' }));
    await user.click(screen.getByLabelText('Day'));
    await user.click(await screen.findByRole('option', { name: 'Tuesday' }));

    expect(screen.getByLabelText('Period')).toHaveTextContent('Tuesday Period 1');

    // Close the popover before checking the page's own Apply Changes button
    // — MUI marks the rest of the page aria-hidden while the popover is open.
    await user.keyboard('{Escape}');
    expect(await screen.findByRole('button', { name: /apply changes/i })).toBeEnabled();
  });

  it('shows the class being edited as a highlighted event at its current slot by default', () => {
    renderPage();
    expect(screen.getByLabelText('This Class: Biology 101')).toBeInTheDocument();
  });

  it('applying commits room, professor, student group, and time together, then navigates back', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    vi.mocked(simulationService.simulationService.previewClassUpdate).mockResolvedValue({
      metrics: [], score: { score: 50, breakdown: [] },
    });
    vi.mocked(simulationService.simulationService.updateClass).mockResolvedValue({
      ...currentClass, roomId: 'RM_102', professorId: 'PRF_JONES', studentGroupId: 'GRP_CHEM_Y1', timeSlotIds: ['TS_MON_P2'],
    });
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Change Room' }));
    await user.click(await screen.findByRole('menuitem', { name: /^room 102/i }));
    await user.click(screen.getByRole('button', { name: 'Change Professor' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Dr. Jones' }));
    await user.click(screen.getByRole('button', { name: 'Change Student Group' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Chem Year 1' }));
    await user.click(screen.getByRole('button', { name: 'Use Monday Period 2' }));

    await user.click(screen.getByRole('button', { name: /apply changes/i }));

    await waitFor(() => {
      expect(simulationService.simulationService.updateClass).toHaveBeenCalledWith(
        SIM_ID, CLASS_ID,
        { roomId: 'RM_102', timeSlotIds: ['TS_MON_P2'], professorId: 'PRF_JONES', studentGroupId: 'GRP_CHEM_Y1' },
      );
    });
    expect(await screen.findByText(/moved to room 102 · dr\. jones · chem year 1/i)).toBeInTheDocument();
    // Stays on the edit page to show the confirmation — navigates away only
    // after the auto-navigate delay (see the dedicated test below).
    expect(screen.queryByText('Timetable Page')).not.toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(1200);

    expect(await screen.findByText('Timetable Page')).toBeInTheDocument();
  });

  it('shows an error and does not navigate when applying fails', async () => {
    vi.mocked(simulationService.simulationService.previewClassUpdate).mockRejectedValue(new Error('graph down'));
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Use Monday Period 2' }));
    await user.click(screen.getByRole('button', { name: /apply changes/i }));

    expect(await screen.findByText(/failed to apply suggestion/i)).toBeInTheDocument();
    expect(screen.queryByText('Timetable Page')).not.toBeInTheDocument();
  });

  it('Cancel navigates back without applying anything', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(await screen.findByText('Timetable Page')).toBeInTheDocument();
    expect(simulationService.simulationService.updateClass).not.toHaveBeenCalled();
  });

  it('Back to Schedule navigates back without applying anything', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /back to schedule/i }));

    expect(await screen.findByText('Timetable Page')).toBeInTheDocument();
    expect(simulationService.simulationService.updateClass).not.toHaveBeenCalled();
  });

  it('shows a not-found message and a way back when the classId does not match any class', async () => {
    const user = userEvent.setup();
    renderPage(makeStore(), 'CLS_DOES_NOT_EXIST');

    expect(screen.getByText(/couldn't be found/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /back to schedule/i }));
    expect(await screen.findByText('Timetable Page')).toBeInTheDocument();
  });

  describe('Smart Suggestions', () => {
    const SUGGESTION: Suggestion = { roomId: 'RM_102', timeSlotIds: ['TS_TUE_P1'], conflictFree: true };

    it('fetches and renders suggestions for the class being edited', async () => {
      vi.mocked(simulationService.simulationService.getClassSuggestions).mockResolvedValue([SUGGESTION]);
      renderPage();

      expect(await screen.findByText('Smart Suggestions')).toBeInTheDocument();
      expect(simulationService.simulationService.getClassSuggestions).toHaveBeenCalledWith(SIM_ID, CLASS_ID);
      expect(await screen.findByRole('button', { name: /move biology 101 to room 102/i })).toBeInTheDocument();
    });

    it('selecting a suggestion stages Room/Day/Period without committing', async () => {
      vi.mocked(simulationService.simulationService.getClassSuggestions).mockResolvedValue([SUGGESTION]);
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByRole('button', { name: /move biology 101 to room 102/i }));

      expect(screen.getByText('Room 102')).toBeInTheDocument();
      expect(screen.getByText('Tuesday Period 1')).toBeInTheDocument();
      expect(simulationService.simulationService.updateClass).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: /apply changes/i })).toBeEnabled();
    });
  });
});
