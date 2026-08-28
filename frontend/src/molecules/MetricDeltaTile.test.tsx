import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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

  // Compares computed colors between cases rather than hardcoding a theme
  // hex value — robust to theme changes, and directly proves the two
  // "improved" cases (and the two "regressed" cases) render identically.
  const afterColor = (delta: MetricDelta): string => {
    const { container } = render(<MetricDeltaTile delta={delta} />);
    const after = within(container).getByText(`${delta.after}${delta.unit}`);
    return getComputedStyle(after).color;
  };

  it('a decrease on a lower-is-better metric renders in the same color as a plain increase (both improved)', () => {
    const decreaseColor = afterColor({ name: 'Avg Gap', before: 5, after: 2, unit: ' slots', direction: 'lower_is_better' });
    const increaseColor = afterColor({ name: 'Room Utilization', before: 50, after: 70, unit: '%' });
    expect(decreaseColor).toBe(increaseColor);
  });

  it('an increase on a lower-is-better metric renders in the same color as a plain decrease (both regressed)', () => {
    const increaseColor = afterColor({ name: 'Avg Gap', before: 2, after: 5, unit: ' slots', direction: 'lower_is_better' });
    const decreaseColor = afterColor({ name: 'Room Utilization', before: 70, after: 50, unit: '%' });
    expect(increaseColor).toBe(decreaseColor);
  });

  it('a lower-is-better decrease and increase render in visibly different colors', () => {
    const decreaseColor = afterColor({ name: 'Avg Gap', before: 5, after: 2, unit: ' slots', direction: 'lower_is_better' });
    const increaseColor = afterColor({ name: 'Avg Gap', before: 2, after: 5, unit: ' slots', direction: 'lower_is_better' });
    expect(decreaseColor).not.toBe(increaseColor);
  });

  it('a higher-is-better metric still behaves as today: an increase is improved', () => {
    const higherBetterIncrease = afterColor({ name: 'Room Utilization', before: 50, after: 70, unit: '%', direction: 'higher_is_better' });
    const undirectedIncrease = afterColor({ name: 'Room Utilization', before: 50, after: 70, unit: '%' });
    expect(higherBetterIncrease).toBe(undirectedIncrease);
  });
});
