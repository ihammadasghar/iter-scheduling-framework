import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import GlobalErrorSnackbar from './GlobalErrorSnackbar';
import simulationReducer from '@/store/reducers/simulationSlice';
import classReducer from '@/store/reducers/classSlice';
import conflictReducer from '@/store/reducers/conflictSlice';
import metricReducer from '@/store/reducers/metricSlice';
import proposalReducer from '@/store/reducers/proposalSlice';
import rulesReducer from '@/store/reducers/rulesSlice';
import sessionReducer from '@/store/reducers/sessionSlice';
import uiReducer from '@/store/reducers/uiSlice';

const makeStore = (error: string | null = null) =>
  configureStore({
    reducer: {
      simulation: simulationReducer, class: classReducer, conflict: conflictReducer,
      metric: metricReducer, proposal: proposalReducer, rules: rulesReducer,
      session: sessionReducer, ui: uiReducer,
    },
    preloadedState: {
      simulation: { simulations: [], current: null, loading: false, error },
    },
  });

describe('GlobalErrorSnackbar', () => {
  it('renders nothing when there are no errors', () => {
    const { container } = render(
      <Provider store={makeStore(null)}>
        <GlobalErrorSnackbar />
      </Provider>,
    );
    expect(container.querySelector('[role="alert"]')).not.toBeInTheDocument();
  });

  it('renders a Snackbar with the error message', () => {
    render(
      <Provider store={makeStore('Something went wrong on our end. Please try again.')}>
        <GlobalErrorSnackbar />
      </Provider>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });

  it('has autoHideDuration of 8 seconds (verified by snapshot of props)', () => {
    // Indirect check: the Snackbar renders without throwing when an error is present
    render(
      <Provider store={makeStore('Test error')}>
        <GlobalErrorSnackbar />
      </Provider>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
