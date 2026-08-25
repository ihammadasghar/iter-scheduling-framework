import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MetricsComparisonPanel from './MetricsComparisonPanel';
import type { WeightedScoreResult } from '@/types';

const breakdownEntry = (name: string, value: number) => ({
  name, value, unit: '%', weight: 1, threshold: 80, normalizedScore: value,
});

describe('MetricsComparisonPanel', () => {
  it('renders both baseline and candidate score chips', () => {
    const baseline: WeightedScoreResult = { score: 40, breakdown: [breakdownEntry('Room Utilization', 40)] };
    const candidate: WeightedScoreResult = { score: 60, breakdown: [breakdownEntry('Room Utilization', 60)] };

    render(<MetricsComparisonPanel baselineScore={baseline} candidateScore={candidate} />);

    expect(screen.getByText('Score: 40/100')).toBeInTheDocument();
    expect(screen.getByText('Score: 60/100')).toBeInTheDocument();
  });

  it('renders a delta tile per metric', () => {
    const baseline: WeightedScoreResult = { score: 40, breakdown: [breakdownEntry('Room Utilization', 40)] };
    const candidate: WeightedScoreResult = { score: 60, breakdown: [breakdownEntry('Room Utilization', 60)] };

    render(<MetricsComparisonPanel baselineScore={baseline} candidateScore={candidate} />);

    expect(screen.getByText('Room Utilization')).toBeInTheDocument();
    expect(screen.getByText('40%')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
  });

  it('shows a fallback message when no metric rules are configured', () => {
    const empty: WeightedScoreResult = { score: 0, breakdown: [] };
    render(<MetricsComparisonPanel baselineScore={empty} candidateScore={empty} />);
    expect(screen.getByText(/No institution metric rules are configured/)).toBeInTheDocument();
  });
});
