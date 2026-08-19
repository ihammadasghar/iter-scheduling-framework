import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import ConflictDetailSection from './ConflictDetailSection';
import uiReducer from '@/store/reducers/uiSlice';
import type { Conflict, ScheduleClass } from '@/types';

const classA: ScheduleClass = {
  id: 'CLS_001',
  courseId: 'CRS_BIO101',
  title: 'Biology 101 — Section A',
  professorId: 'PRF_SMITH',
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

const renderSection = (
  classItem: ScheduleClass,
  conflicts: Conflict[],
  classes: ScheduleClass[] = [classA, classB],
) => {
  const store = configureStore({ reducer: { ui: uiReducer } });
  return {
    store,
    ...render(
      <Provider store={store}>
        <ConflictDetailSection classItem={classItem} conflicts={conflicts} classes={classes} />
      </Provider>,
    ),
  };
};

describe('ConflictDetailSection', () => {
  it('renders nothing when the class has no conflicts', () => {
    const { container } = renderSection(classA, []);
    expect(container).toBeEmptyDOMElement();
  });

  it('ignores conflicts that do not involve this class', () => {
    const { container } = renderSection(classA, [
      { id: 'c1', type: 'ROOM_DOUBLE_BOOK', classIds: ['CLS_002', 'CLS_003'], message: '' },
    ]);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a plain-English message for a conflict involving this class', () => {
    renderSection(classA, [
      { id: 'c1', type: 'ROOM_DOUBLE_BOOK', classIds: ['CLS_001', 'CLS_002'], message: '' },
    ]);
    expect(screen.getByText(/room 101 is booked for two classes/i)).toBeInTheDocument();
  });

  it('names the other class this one conflicts with', () => {
    renderSection(classA, [
      { id: 'c1', type: 'ROOM_DOUBLE_BOOK', classIds: ['CLS_001', 'CLS_002'], message: '' },
    ]);
    expect(screen.getByText(/conflicts with chem101/i)).toBeInTheDocument();
  });

  it('shows a singular-count summary for exactly one conflict', () => {
    renderSection(classA, [
      { id: 'c1', type: 'ROOM_DOUBLE_BOOK', classIds: ['CLS_001', 'CLS_002'], message: '' },
    ]);
    expect(screen.getByText(/has a scheduling conflict that must be resolved/i)).toBeInTheDocument();
  });

  it('shows a plural-count summary for multiple conflicts', () => {
    renderSection(classA, [
      { id: 'c1', type: 'ROOM_DOUBLE_BOOK', classIds: ['CLS_001', 'CLS_002'], message: '' },
      { id: 'c2', type: 'PROFESSOR_OVERLAP', classIds: ['CLS_001', 'CLS_002'], message: '' },
    ]);
    expect(screen.getByText(/has 2 scheduling conflicts that must be resolved/i)).toBeInTheDocument();
  });

  it('clicking a conflict row selects the other class and opens the inspector', () => {
    const { store } = renderSection(classA, [
      { id: 'c1', type: 'ROOM_DOUBLE_BOOK', classIds: ['CLS_001', 'CLS_002'], message: '' },
    ]);
    fireEvent.click(screen.getByText(/room 101 is booked/i));
    expect(store.getState().ui.selectedClassId).toBe('CLS_002');
    expect(store.getState().ui.inspectorOpen).toBe(true);
  });

  it('does not render a raw type code anywhere', () => {
    renderSection(classA, [
      { id: 'c1', type: 'ROOM_DOUBLE_BOOK', classIds: ['CLS_001', 'CLS_002'], message: '' },
    ]);
    expect(screen.queryByText(/ROOM_DOUBLE_BOOK/)).not.toBeInTheDocument();
  });

  it('handles a conflict whose other class is missing from the roster gracefully', () => {
    // Should still show the conflict message, just without a jump-to-other-class link
    renderSection(classA, [
      { id: 'c1', type: 'ROOM_DOUBLE_BOOK', classIds: ['CLS_001', 'CLS_999'], message: '' },
    ], [classA]);
    expect(screen.getByText(/room 101 is booked/i)).toBeInTheDocument();
    expect(screen.queryByText(/conflicts with/i)).not.toBeInTheDocument();
  });
});
