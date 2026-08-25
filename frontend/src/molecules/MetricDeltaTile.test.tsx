import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MetricDeltaTile from './MetricDeltaTile';
import type { MetricDelta } from '@/types';

describe('MetricDeltaTile', () => {
  it('renders the metric name and before/after values with unit', () => {
    const delta: MetricDelta = { name: 'Room Utilization', before: 50, after: 70, unit: '%' };
    render(<MetricDeltaTile delta={delta} />);
    expect(screen.getByText('Room Utilization')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('70%')).toBeInTheDocument();
  });

  it('renders unchanged values without error', () => {
    const delta: MetricDelta = { name: 'Room Utilization', before: 50, after: 50, unit: '%' };
    render(<MetricDeltaTile delta={delta} />);
    expect(screen.getAllByText('50%')).toHaveLength(2);
  });
});
