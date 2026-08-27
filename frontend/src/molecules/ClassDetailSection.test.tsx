import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import ClassDetailSection from './ClassDetailSection';
import scheduleReducer from '@/store/reducers/scheduleSlice';
import type { RawProfessor, RawRoom, ScheduleClass } from '@/types';

const classItem: ScheduleClass = {
  id: 'CLS_001',
  courseId: 'CRS_0001',
  title: 'Biology 101',
  professorId: 'PRF_00001',
  studentGroupId: 'GRP_BIO_Y1',
  roomId: 'RM_101',
  timeSlotIds: ['TS_MON_P1'],
};

const PROFESSOR: RawProfessor = { id: 'PRF_00001', name: 'Dr. Jane Smith', department: 'Biology' };
const ROOM: RawRoom = { id: 'RM_101', name: 'Lecture Hall A', capacity: 40, building: 'Main' };

const renderSection = (roster: { professors?: RawProfessor[]; rooms?: RawRoom[] } = {}) => {
  const store = configureStore({
    reducer: { schedule: scheduleReducer },
    preloadedState: {
      schedule: {
        rooms: roster.rooms ?? [],
        professors: roster.professors ?? [],
        studentGroups: [], courses: [], timeSlots: [],
        loading: false, error: null,
      },
    },
  });
  return render(
    <Provider store={store}>
      <ClassDetailSection classItem={classItem} />
    </Provider>,
  );
};

describe('ClassDetailSection', () => {
  it('shows the roster professor name, not a number, once the roster has loaded', () => {
    renderSection({ professors: [PROFESSOR] });
    expect(screen.getByText('Dr. Jane Smith')).toBeInTheDocument();
  });

  it('shows the roster room name once the roster has loaded', () => {
    renderSection({ rooms: [ROOM] });
    expect(screen.getByText('Lecture Hall A')).toBeInTheDocument();
  });

  it('falls back to the ID-derived label when the roster has not loaded', () => {
    renderSection();
    // formatProfessorLabel('PRF_00001') -> "00001" — documented fallback,
    // not the reported bug re-appearing (the bug was showing this when a
    // roster *was* available but never consulted).
    expect(screen.getByText('00001')).toBeInTheDocument();
  });

  it('still shows the class title and formatted time slot', () => {
    renderSection();
    expect(screen.getByText('Monday Period 1')).toBeInTheDocument();
  });
});
