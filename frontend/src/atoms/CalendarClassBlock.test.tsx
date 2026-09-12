import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
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
) => {
  const store = configureStore({
    reducer: { ui: uiReducer, schedule: scheduleReducer },
    preloadedState: {
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
      <CalendarClassBlock
        classItem={makeClassItem('RM_0001')}
        block={block}
        minMinutes={480}
        pixelsPerMinute={1.2}
        {...props}
      />
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
});
