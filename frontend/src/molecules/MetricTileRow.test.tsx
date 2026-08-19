import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MetricTileRow from './MetricTileRow';

describe('MetricTileRow', () => {
  it('shows "No metrics configured" when metrics is empty', () => {
    render(<MetricTileRow metrics={[]} />);
    expect(screen.getByText(/no metrics configured/i)).toBeInTheDocument();
  });

  it('renders a tile for each metric', () => {
    render(<MetricTileRow metrics={[{ name: 'Room Utilisation', value: 74, unit: '%' }]} />);
    expect(screen.getByText('Room Utilisation')).toBeInTheDocument();
    expect(screen.getByText('74%')).toBeInTheDocument();
  });
});
