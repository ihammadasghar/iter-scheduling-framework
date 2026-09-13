import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { IntlProvider } from 'react-intl';
import { configureStore } from '@reduxjs/toolkit';
import ClassChip from './ClassChip';
import uiReducer from '@/store/reducers/uiSlice';
import scheduleReducer from '@/store/reducers/scheduleSlice';
import type { RawCourse, RawProfessor, ScheduleClass } from '@/types';

const classItem: ScheduleClass = {
  id: 'CLS_001',
  courseId: 'CRS_0001',
  title: 'Biology 101',
  professorId: 'PRF_00001',
  studentGroupId: 'GRP_BIO_Y1',
  roomId: 'RM_101',
  timeSlotIds: ['TS_MON_P1'],
};

const COURSE: RawCourse = { id: 'CRS_0001', code: 'BIO101', name: 'Introduction to Biology', department: 'Biology' };
const PROFESSOR: RawProfessor = { id: 'PRF_00001', name: 'Dr. Jane Smith', department: 'Biology' };

const renderChip = (
  props: Partial<React.ComponentProps<typeof ClassChip>> = {},
  roster: { courses?: RawCourse[]; professors?: RawProfessor[] } = {},
) => {
  const store = configureStore({
    reducer: { ui: uiReducer, schedule: scheduleReducer },
    preloadedState: {
      schedule: {
        rooms: [], studentGroups: [],
        courses: roster.courses ?? [],
        professors: roster.professors ?? [],
        timeSlots: [],
        metadata: null,
        loading: false, error: null,
      },
    },
  });
  return render(
    <Provider store={store}>
      <IntlProvider locale="en" messages={{}}>
        <ClassChip classItem={classItem} {...props} />
      </IntlProvider>
    </Provider>,
  );
};

describe('ClassChip', () => {
  it('shows the roster course code, not the opaque ID, once the roster has loaded', () => {
    renderChip({}, { courses: [COURSE] });
    expect(screen.getByText('BIO101')).toBeInTheDocument();
  });

  it('falls back to the ID-derived label when the roster has not loaded', () => {
    renderChip();
    // formatCourseLabel('CRS_0001') -> "0001", not a real code — this is the
    // documented fallback, not the reported bug re-appearing.
    expect(screen.getByText('0001')).toBeInTheDocument();
  });

  it('shows the roster professor name in the tooltip', async () => {
    const user = userEvent.setup();
    renderChip({}, { professors: [PROFESSOR] });
    await user.hover(screen.getByText('0001'));
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Dr. Jane Smith');
  });

  it('conflicted state tooltip/aria-label uses the conflict summary when provided', () => {
    renderChip({ state: 'conflicted', conflictSummary: 'Room 101 is booked for two classes at the same time' });
    expect(
      screen.getByLabelText('0001 — Room 101 is booked for two classes at the same time'),
    ).toBeInTheDocument();
  });

  it('clicking the chip selects the class and opens the inspector', () => {
    const store = configureStore({
      reducer: { ui: uiReducer, schedule: scheduleReducer },
    });
    render(
      <Provider store={store}>
        <IntlProvider locale="en" messages={{}}>
          <ClassChip classItem={classItem} />
        </IntlProvider>
      </Provider>,
    );
    fireEvent.click(screen.getByText('0001'));
    expect(store.getState().ui.selectedClassId).toBe('CLS_001');
    expect(store.getState().ui.inspectorOpen).toBe(true);
  });

  it('renders the selected variant without crashing when a roster is loaded', () => {
    renderChip({ state: 'selected' }, { courses: [COURSE] });
    expect(screen.getByText('BIO101')).toBeInTheDocument();
  });
});
