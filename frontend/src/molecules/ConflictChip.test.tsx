import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { IntlProvider } from 'react-intl';
import { configureStore } from '@reduxjs/toolkit';
import ConflictChip from './ConflictChip';
import classReducer from '@/store/reducers/classSlice';
import uiReducer from '@/store/reducers/uiSlice';
import scheduleReducer from '@/store/reducers/scheduleSlice';
import type { Conflict } from '@/types';

const CONFLICT: Conflict = {
  id: 'c1',
  type: 'ROOM_DOUBLE_BOOK',
  classIds: ['CLS_001', 'CLS_002'] as unknown as readonly [string, string],
  message: '',
};

const makeStore = () =>
  configureStore({
    reducer: { class: classReducer, ui: uiReducer, schedule: scheduleReducer },
  });

const renderChip = (props: Partial<React.ComponentProps<typeof ConflictChip>> = {}) =>
  render(
    <Provider store={makeStore()}>
      <IntlProvider locale="en" messages={{}}>
        <ConflictChip conflicts={[CONFLICT]} loading={false} {...props} />
      </IntlProvider>
    </Provider>,
  );

describe('ConflictChip', () => {
  it('uses the alarming error color by default', () => {
    renderChip();
    expect(screen.getByText(/1 scheduling conflict/i).closest('.MuiChip-root')).toHaveClass('MuiChip-colorError');
  });

  it('softens to the default color when softened is set, so it does not out-compete the grid', () => {
    renderChip({ softened: true });
    expect(screen.getByText(/1 scheduling conflict/i).closest('.MuiChip-root')).toHaveClass('MuiChip-colorDefault');
  });
});
