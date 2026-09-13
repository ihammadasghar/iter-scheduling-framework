import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { IntlProvider } from 'react-intl';
import { configureStore } from '@reduxjs/toolkit';
import ViewBySelector from './ViewBySelector';
import uiReducer from '@/store/reducers/uiSlice';

const makeStore = () =>
  configureStore({
    reducer: { ui: uiReducer },
  });

const renderSelector = () => {
  const store = makeStore();
  render(
    <Provider store={store}>
      <IntlProvider locale="en" messages={{}}>
        <ViewBySelector />
      </IntlProvider>
    </Provider>,
  );
  return store;
};

describe('ViewBySelector', () => {
  it('shows "View by Room" as the initial selection', () => {
    renderSelector();
    expect(screen.getByText('View by Room')).toBeInTheDocument();
  });

  it('dispatches setViewBy and updates the store when an option is clicked', async () => {
    const user = userEvent.setup();
    const store = renderSelector();

    await user.click(screen.getByLabelText('View timetable by'));
    await user.click(await screen.findByRole('option', { name: /view by professor/i }));

    expect(store.getState().ui.viewBy).toBe('professor');
  });

  // Regression test for the actual bug: wrapping MenuItem in Tooltip broke
  // MUI Select's child.props.value reflection, so the dropdown dispatched
  // `undefined` on the first click and then did nothing on every click after
  // that (undefined !== undefined). A single click alone wouldn't catch this.
  it('keeps responding to further clicks after the first selection', async () => {
    const user = userEvent.setup();
    const store = renderSelector();

    await user.click(screen.getByLabelText('View timetable by'));
    await user.click(await screen.findByRole('option', { name: /view by professor/i }));
    expect(store.getState().ui.viewBy).toBe('professor');

    await user.click(screen.getByLabelText('View timetable by'));
    await user.click(await screen.findByRole('option', { name: /view by student group/i }));
    expect(store.getState().ui.viewBy).toBe('studentGroup');

    await user.click(screen.getByLabelText('View timetable by'));
    await user.click(await screen.findByRole('option', { name: /view by room/i }));
    expect(store.getState().ui.viewBy).toBe('room');
  });

  it('renders a tooltip-carrying label for each option without breaking selection', async () => {
    const user = userEvent.setup();
    renderSelector();

    await user.click(screen.getByLabelText('View timetable by'));

    expect(await screen.findByRole('option', { name: /view by room/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /view by professor/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /view by student group/i })).toBeInTheDocument();
  });
});
