import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import ConflictPopover from './ConflictPopover';
import uiReducer from '@/store/reducers/uiSlice';
import classReducer from '@/store/reducers/classSlice';
import type { Conflict } from '@/types';

const makeStore = (classes = [
  { id: 'CLS_001', courseId: 'CRS_BIO101', title: 'Bio Lec', professorId: 'PRF_SMITH', studentGroupId: 'GRP_BIO_Y1', roomId: 'RM_101', timeSlotIds: [] },
]) =>
  configureStore({
    reducer: { ui: uiReducer, class: classReducer },
    preloadedState: {
      class: { classes, total: 1, currentPage: 1, hasMore: false, loading: false, error: null },
    },
  });

const renderPopover = (conflicts: Conflict[], onClose = (): void => {}) => {
  const store = makeStore();
  const anchor = document.createElement('button');
  document.body.appendChild(anchor);
  return {
    store,
    ...render(
      <Provider store={store}>
        <ConflictPopover open anchorEl={anchor} conflicts={conflicts} onClose={onClose} />
      </Provider>,
    ),
  };
};

describe('ConflictPopover', () => {
  it('maps ROOM_DOUBLE_BOOK to correct human message', () => {
    renderPopover([{
      id: 'c1', type: 'ROOM_DOUBLE_BOOK',
      classIds: ['CLS_001', 'CLS_002'], message: '',
    }]);
    expect(screen.getByText(/room 101 is booked/i)).toBeInTheDocument();
    expect(screen.queryByText('ROOM_DOUBLE_BOOK')).not.toBeInTheDocument();
  });

  it('maps PROFESSOR_OVERLAP to correct human message', () => {
    renderPopover([{
      id: 'c2', type: 'PROFESSOR_OVERLAP',
      classIds: ['CLS_001', 'CLS_002'], message: '',
    }]);
    expect(screen.getByText(/smith is already teaching/i)).toBeInTheDocument();
    expect(screen.queryByText('PROFESSOR_OVERLAP')).not.toBeInTheDocument();
  });

  it('maps GROUP_OVERLAP to correct human message', () => {
    renderPopover([{
      id: 'c3', type: 'GROUP_OVERLAP',
      classIds: ['CLS_001', 'CLS_002'], message: '',
    }]);
    expect(screen.getByText(/bio y1.*students are in two/i)).toBeInTheDocument();
    expect(screen.queryByText('GROUP_OVERLAP')).not.toBeInTheDocument();
  });

  it('does not show raw type codes in any conflict row', () => {
    renderPopover([
      { id: 'c1', type: 'ROOM_DOUBLE_BOOK',  classIds: ['CLS_001', 'CLS_002'], message: '' },
      { id: 'c2', type: 'PROFESSOR_OVERLAP', classIds: ['CLS_001', 'CLS_002'], message: '' },
      { id: 'c3', type: 'GROUP_OVERLAP',     classIds: ['CLS_001', 'CLS_002'], message: '' },
    ]);
    expect(screen.queryByText(/ROOM_DOUBLE_BOOK/)).not.toBeInTheDocument();
    expect(screen.queryByText(/PROFESSOR_OVERLAP/)).not.toBeInTheDocument();
    expect(screen.queryByText(/GROUP_OVERLAP/)).not.toBeInTheDocument();
  });

  it('clicking a conflict row dispatches selectClass and calls onClose', () => {
    const onClose = vi.fn();
    const { store } = renderPopover([{
      id: 'c1', type: 'ROOM_DOUBLE_BOOK',
      classIds: ['CLS_001', 'CLS_002'], message: '',
    }], onClose);

    fireEvent.click(screen.getByRole('button', { name: /room 101 is booked/i }));

    expect(store.getState().ui.selectedClassId).toBe('CLS_001');
    expect(store.getState().ui.inspectorOpen).toBe(true);
    expect(onClose).toHaveBeenCalled();
  });

  it('renders multiple conflict rows', () => {
    renderPopover([
      { id: 'c1', type: 'ROOM_DOUBLE_BOOK', classIds: ['CLS_001', 'CLS_002'], message: '' },
      { id: 'c2', type: 'PROFESSOR_OVERLAP', classIds: ['CLS_001', 'CLS_002'], message: '' },
    ]);
    expect(screen.getByText(/room 101 is booked/i)).toBeInTheDocument();
    expect(screen.getByText(/smith is already teaching/i)).toBeInTheDocument();
  });
});
