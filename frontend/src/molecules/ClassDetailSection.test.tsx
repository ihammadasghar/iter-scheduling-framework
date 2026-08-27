import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import ClassDetailSection from './ClassDetailSection';
import scheduleReducer from '@/store/reducers/scheduleSlice';
import uiReducer from '@/store/reducers/uiSlice';
import metricReducer from '@/store/reducers/metricSlice';
import scoreReducer from '@/store/reducers/scoreSlice';
import classReducer from '@/store/reducers/classSlice';
import conflictReducer from '@/store/reducers/conflictSlice';
import type { Conflict, RawProfessor, RawRoom, RawStudentGroup, ScheduleClass } from '@/types';

vi.mock('@/services/simulationService', () => ({
  simulationService: {
    getRoomAvailability: vi.fn().mockResolvedValue([]),
  },
}));

const classA: ScheduleClass = {
  id: 'CLS_001',
  courseId: 'CRS_0001',
  title: 'Biology 101',
  professorId: 'PRF_00001',
  studentGroupId: 'GRP_BIO_Y1',
  roomId: 'RM_101',
  timeSlotIds: ['TS_MON_P1'],
};

const classB: ScheduleClass = {
  ...classA,
  id: 'CLS_002',
  courseId: 'CRS_CHEM101',
  title: 'Chemistry 101 — Section B',
};

const PROFESSOR: RawProfessor = { id: 'PRF_00001', name: 'Dr. Jane Smith', department: 'Biology' };
const ROOM: RawRoom = { id: 'RM_101', name: 'Lecture Hall A', capacity: 40, building: 'Main' };
const GROUP: RawStudentGroup = { id: 'GRP_BIO_Y1', name: 'Bio Year 1', size: 30 };

const renderSection = (options: {
  classItem?: ScheduleClass;
  conflicts?: Conflict[];
  classes?: ScheduleClass[];
  roster?: { professors?: RawProfessor[]; rooms?: RawRoom[]; studentGroups?: RawStudentGroup[] };
  simId?: string;
} = {}) => {
  const roster = options.roster ?? {};
  const store = configureStore({
    reducer: {
      schedule: scheduleReducer,
      ui: uiReducer,
      metric: metricReducer,
      score: scoreReducer,
      class: classReducer,
      conflict: conflictReducer,
    },
    preloadedState: {
      schedule: {
        rooms: roster.rooms ?? [],
        professors: roster.professors ?? [],
        studentGroups: roster.studentGroups ?? [],
        courses: [],
        timeSlots: [],
        metadata: null,
        loading: false,
        error: null,
      },
    },
  });
  return {
    store,
    ...render(
      <Provider store={store}>
        <ClassDetailSection
          classItem={options.classItem ?? classA}
          conflicts={options.conflicts ?? []}
          classes={options.classes ?? [classA, classB]}
          simId={options.simId}
        />
      </Provider>,
    ),
  };
};

describe('ClassDetailSection', () => {
  it('shows the roster professor name, not a number, once the roster has loaded', () => {
    renderSection({ roster: { professors: [PROFESSOR] } });
    expect(screen.getByText('Dr. Jane Smith')).toBeInTheDocument();
  });

  it('shows the roster room name once the roster has loaded', () => {
    renderSection({ roster: { rooms: [ROOM] } });
    expect(screen.getByText('Lecture Hall A')).toBeInTheDocument();
  });

  it('shows the roster student group name once the roster has loaded', () => {
    renderSection({ roster: { studentGroups: [GROUP] } });
    expect(screen.getByText('Bio Year 1')).toBeInTheDocument();
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

  it('renders no conflict warnings when the class has no conflicts', () => {
    renderSection();
    expect(screen.queryByText(/booked for two classes|already teaching|in two classes at once|exceeds the room/i))
      .not.toBeInTheDocument();
  });

  it('ignores conflicts that do not involve this class', () => {
    renderSection({
      conflicts: [
        { id: 'c1', type: 'ROOM_DOUBLE_BOOK', classIds: ['CLS_002', 'CLS_003'], message: '' },
      ],
    });
    expect(screen.queryByText(/booked for two classes/i)).not.toBeInTheDocument();
  });

  it('shows a room conflict inline under the Room row', () => {
    renderSection({
      conflicts: [
        { id: 'c1', type: 'ROOM_DOUBLE_BOOK', classIds: ['CLS_001', 'CLS_002'], message: '' },
      ],
    });
    expect(screen.getByText(/room 101 is booked for two classes/i)).toBeInTheDocument();
    expect(screen.getByText(/conflicts with chem101/i)).toBeInTheDocument();
  });

  it('shows a professor conflict inline under the Professor row', () => {
    renderSection({
      conflicts: [
        { id: 'c1', type: 'PROFESSOR_OVERLAP', classIds: ['CLS_001', 'CLS_002'], message: '' },
      ],
    });
    expect(screen.getByText(/already teaching another class/i)).toBeInTheDocument();
  });

  it('shows a group conflict inline under the Student Group row', () => {
    renderSection({
      conflicts: [
        { id: 'c1', type: 'GROUP_OVERLAP', classIds: ['CLS_001', 'CLS_002'], message: '' },
      ],
    });
    expect(screen.getByText(/students are in two classes at once/i)).toBeInTheDocument();
  });

  it('shows a room capacity conflict under Room only, not duplicated under Student Group', () => {
    renderSection({
      conflicts: [
        { id: 'c1', type: 'ROOM_CAPACITY_EXCEEDED', classIds: ['CLS_001', 'CLS_002'], message: '' },
      ],
    });
    // Message text appears exactly once in the document.
    expect(screen.getAllByText(/exceeds the room's capacity/i)).toHaveLength(1);
  });

  it('clicking a conflict warning selects the other class and opens the inspector', () => {
    const { store } = renderSection({
      conflicts: [
        { id: 'c1', type: 'ROOM_DOUBLE_BOOK', classIds: ['CLS_001', 'CLS_002'], message: '' },
      ],
    });
    fireEvent.click(screen.getByText(/room 101 is booked/i));
    expect(store.getState().ui.selectedClassId).toBe('CLS_002');
    expect(store.getState().ui.inspectorOpen).toBe(true);
  });

  it('does not show an Edit button in read-only mode (no simId)', () => {
    renderSection();
    expect(screen.queryByRole('button', { name: /^edit$/i })).not.toBeInTheDocument();
  });

  it('shows an Edit button next to Current Assignment when simId is given', () => {
    renderSection({ simId: 'sim-1' });
    expect(screen.getByRole('button', { name: /^edit$/i })).toBeInTheDocument();
  });

  it('does not render a raw conflict type code anywhere', () => {
    renderSection({
      conflicts: [
        { id: 'c1', type: 'ROOM_DOUBLE_BOOK', classIds: ['CLS_001', 'CLS_002'], message: '' },
      ],
    });
    expect(screen.queryByText(/ROOM_DOUBLE_BOOK/)).not.toBeInTheDocument();
  });
});
