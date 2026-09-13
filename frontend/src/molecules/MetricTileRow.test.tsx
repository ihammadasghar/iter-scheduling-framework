import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import MetricTileRow from './MetricTileRow';

const renderRow = (metrics: React.ComponentProps<typeof MetricTileRow>['metrics']) =>
  render(
    <IntlProvider locale="en" messages={{}}>
      <MetricTileRow metrics={metrics} />
    </IntlProvider>,
  );

describe('MetricTileRow', () => {
  it('shows "No metrics configured" when metrics is empty', () => {
    renderRow([]);
    expect(screen.getByText(/no metrics configured/i)).toBeInTheDocument();
  });

  it('renders a tile for each metric', () => {
    renderRow([{ name: 'Room Utilisation', value: 74, unit: '%' }]);
    expect(screen.getByText('Room Utilisation')).toBeInTheDocument();
    expect(screen.getByText('74%')).toBeInTheDocument();
  });
});
