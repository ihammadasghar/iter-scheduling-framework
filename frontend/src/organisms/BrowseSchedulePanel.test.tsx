import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { IntlProvider } from 'react-intl';
import { configureStore } from '@reduxjs/toolkit';
import BrowseSchedulePanel from './BrowseSchedulePanel';
import classReducer from '@/store/reducers/classSlice';
import uiReducer from '@/store/reducers/uiSlice';
import scheduleReducer from '@/store/reducers/scheduleSlice';
import conflictReducer from '@/store/reducers/conflictSlice';
import identityReducer from '@/store/reducers/identitySlice';
import type { ScheduleClass } from '@/types';

const roomClass: ScheduleClass = {
  id: 'CLS_ROOM_101', courseId: 'CRS_BIO101', title: 'Intro to Biology', professorId: 'PRF_SMITH',
  studentGroupId: 'GRP_BIO_Y1', roomId: 'RM_101', timeSlotIds: ['TS_MON_P1'],
};

const TIME_SLOTS = [
  { id: 'TS_MON_P1', day: 'Monday', name: 'Period 1', startTime: '08:30', endTime: '10:15' },
];

const makeStore = () =>
  configureStore({
    reducer: {
      class: classReducer,
      ui: uiReducer,
      schedule: scheduleReducer,
      conflict: conflictReducer,
      identity: identityReducer,
    },
    preloadedState: {
      class: { classes: [roomClass], total: 1, currentPage: 1, hasMore: false, loading: false, error: null },
      schedule: {
        rooms: [{ id: 'RM_101', name: 'Room 101', capacity: 30, building: 'Main' }],
        professors: [{ id: 'PRF_SMITH', name: 'Dr. Smith', department: 'Biology' }],
        studentGroups: [
          { id: 'GRP_BIO_Y1', name: 'Biology Year 1', size: 40 },
          { id: 'GRP_HIS_Y1', name: 'History Year 1', size: 25 },
        ],
        courses: [],
        timeSlots: TIME_SLOTS,
        metadata: null,
        loading: false,
        error: null,
      },
      conflict: { conflicts: [], loading: false, lastFetchedAt: null, error: null },
      identity: { identity: null, hydrated: true },
    },
  });

const renderPanel = () => {
  const store = makeStore();
  render(
    <Provider store={store}>
      <IntlProvider locale="en" messages={{}}>
        <BrowseSchedulePanel />
      </IntlProvider>
    </Provider>,
  );
  return store;
};

describe('BrowseSchedulePanel', () => {
  it('shows a prompt before any entity is picked, without mounting the calendar', () => {
    renderPanel();
    expect(
      screen.getByText(/search for a room, professor, or student group/i),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('My schedule calendar')).not.toBeInTheDocument();
  });

  it('renders the picked room\'s calendar once an entity is selected', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByLabelText('Search rooms'));
    await user.click(await screen.findByText('Room 101'));

    expect(await screen.findByText('BIO101')).toBeInTheDocument();
  });

  it('shows an empty-state message naming the entity when it has no classes', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByLabelText('Browse by resource type'));
    await user.click(await screen.findByRole('option', { name: 'Student Group' }));
    await user.click(screen.getByLabelText('Search student groups'));
    await user.click(await screen.findByText('History Year 1'));

    expect(
      await screen.findByText('No classes are scheduled for History Year 1 this week.'),
    ).toBeInTheDocument();
  });

  it('forwards excludedDays to the underlying calendar (excluded day\'s column disappears)', async () => {
    const user = userEvent.setup();
    const store = makeStore();
    render(
      <Provider store={store}>
        <IntlProvider locale="en" messages={{}}>
          <BrowseSchedulePanel excludedDays={new Map([['Monday', 'Thanksgiving Break']])} />
        </IntlProvider>
      </Provider>,
    );

    await user.click(screen.getByLabelText('Search rooms'));
    await user.click(await screen.findByText('Room 101'));

    expect(screen.queryByText('Monday')).not.toBeInTheDocument();
    expect(screen.queryByText('BIO101')).not.toBeInTheDocument();
  });

  it('resets the selected entity when switching resource type', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByLabelText('Search rooms'));
    await user.click(await screen.findByText('Room 101'));
    expect(await screen.findByText('BIO101')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Browse by resource type'));
    await user.click(await screen.findByRole('option', { name: 'Professor' }));

    expect(
      await screen.findByText(/search for a room, professor, or student group/i),
    ).toBeInTheDocument();
  });
});
