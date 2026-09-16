import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { IntlProvider } from 'react-intl';
import { configureStore } from '@reduxjs/toolkit';
import CalendarClassBlock from './CalendarClassBlock';
import uiReducer from '@/store/reducers/uiSlice';
import scheduleReducer from '@/store/reducers/scheduleSlice';
import type { RawCourse, RawRoom, ScheduleClass } from '@/types';
import type { CalendarBlock } from '@/utils/calendarLayout';

const COURSE: RawCourse = { id: 'CRS_0001', code: 'EMA101', name: 'A Europa e o Mundo Após 1945', department: 'History' };
const ROOM: RawRoom = { id: 'RM_0001', name: 'Auditório Afonso de Barros', capacity: 80, building: 'Ala Autónoma' };

const block: CalendarBlock = {
  classId: 'CLS_001', day: 'Monday', startMinutes: 540, endMinutes: 630, laneIndex: 0, laneCount: 1,
};

const makeClassItem = (roomId: string): ScheduleClass => ({
  id: 'CLS_001',
  courseId: 'CRS_0001',
  title: 'Class 1',
  professorId: 'PRF_00001',
  studentGroupId: 'GRP_00001',
  roomId,
  timeSlotIds: ['TS_MON_0900_1030'],
});

const renderBlock = (
  props: Partial<React.ComponentProps<typeof CalendarClassBlock>> = {},
  roster: { courses?: RawCourse[]; rooms?: RawRoom[] } = {},
  selectedClassId: string | null = null,
) => {
  const store = configureStore({
    reducer: { ui: uiReducer, schedule: scheduleReducer },
    preloadedState: {
      ui: {
        selectedClassId,
        inspectorOpen: selectedClassId !== null,
        viewBy: 'room' as const,
        hasInteractedWithClass: selectedClassId !== null,
      },
      schedule: {
        rooms: roster.rooms ?? [], studentGroups: [],
        courses: roster.courses ?? [],
        professors: [],
        timeSlots: [],
        metadata: null,
        loading: false, error: null,
      },
    },
  });
  return render(
    <Provider store={store}>
      <IntlProvider locale="en" messages={{}}>
        <CalendarClassBlock
          classItem={makeClassItem('RM_0001')}
          block={block}
          minMinutes={480}
          pixelsPerMinute={1.2}
          {...props}
        />
      </IntlProvider>
    </Provider>,
  );
};

describe('CalendarClassBlock', () => {
  it('shows the room name on a second line when the block is tall enough', () => {
    // 90 minutes * 1.2px/min = 108px, comfortably over the 50px threshold.
    renderBlock({}, { courses: [COURSE], rooms: [ROOM] });
    expect(screen.getByText('EMA101')).toBeInTheDocument();
    expect(screen.getByText('Auditório Afonso de Barros')).toBeInTheDocument();
  });

  it('hides the room line on a short block to avoid crowding', () => {
    const shortBlock: CalendarBlock = { ...block, endMinutes: block.startMinutes + 20 }; // 20min * 1.2 = 24px, floored to MIN_BLOCK_HEIGHT
    renderBlock({ block: shortBlock }, { courses: [COURSE], rooms: [ROOM] });
    expect(screen.getByText('EMA101')).toBeInTheDocument();
    expect(screen.queryByText('Auditório Afonso de Barros')).not.toBeInTheDocument();
  });

  it('shows "No room" for an ISCTE-style unscheduled class instead of a blank line', () => {
    renderBlock({ classItem: makeClassItem('') }, { courses: [COURSE], rooms: [ROOM] });
    expect(screen.getByText('No room')).toBeInTheDocument();
  });

  it('marks the block with a discoverability hint aria-label when showFirstRunHint is set', () => {
    renderBlock({ showFirstRunHint: true }, { courses: [COURSE], rooms: [ROOM] });
    expect(screen.getByLabelText('EMA101 — click to see details')).toBeInTheDocument();
  });

  it('does not add the hint aria-label when showFirstRunHint is unset', () => {
    renderBlock({}, { courses: [COURSE], rooms: [ROOM] });
    expect(screen.queryByLabelText('EMA101 — click to see details')).not.toBeInTheDocument();
    expect(screen.getByLabelText('EMA101')).toBeInTheDocument();
  });

  it('dims the block when a different class is selected, so the selected block stands out', () => {
    renderBlock({}, { courses: [COURSE], rooms: [ROOM] }, 'CLS_OTHER');
    expect(screen.getByLabelText('EMA101')).toHaveStyle({ opacity: '0.4' });
  });

  it('does not dim the block when it is itself the selected class', () => {
    renderBlock({}, { courses: [COURSE], rooms: [ROOM] }, 'CLS_001');
    expect(screen.getByLabelText('EMA101 — selected')).toHaveStyle({ opacity: '1' });
  });
});
