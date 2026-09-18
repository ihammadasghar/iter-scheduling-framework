import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { IntlProvider } from 'react-intl';
import { configureStore } from '@reduxjs/toolkit';
import MetricsToolbar from './MetricsToolbar';
import metricReducer from '@/store/reducers/metricSlice';
import type { MetricResult } from '@/types';

const renderToolbar = (metrics: MetricResult[], loading = false) =>
  render(
    <Provider
      store={configureStore({
        reducer: { metric: metricReducer },
        preloadedState: { metric: { metrics, loading, error: null } },
      })}
    >
      <IntlProvider locale="en" messages={{}}>
        <MetricsToolbar />
      </IntlProvider>
    </Provider>,
  );

describe('MetricsToolbar', () => {
  it('shows "No metrics configured" when metrics array is empty', () => {
    renderToolbar([]);
    expect(screen.getByText(/no metrics configured/i)).toBeInTheDocument();
  });

  it('renders metric chips when metrics are present', () => {
    renderToolbar([{ name: 'Room Utilisation', value: 82, unit: '%' }]);
    expect(screen.getByText(/room utilisation: 82%/i)).toBeInTheDocument();
  });
});
