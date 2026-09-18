import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import ScheduleQualityCard from './ScheduleQualityCard';
import type { WeightedScoreResult } from '@/types';

const score = (value: number, hasBreakdown = true): WeightedScoreResult => ({
  score: value,
  breakdown: hasBreakdown
    ? [{ name: 'Room Utilization', value: 78, unit: '%', weight: 2, threshold: 80, normalizedScore: 90 }]
    : [],
});

const renderCard = (baselineScore: WeightedScoreResult, candidateScore: WeightedScoreResult) =>
  render(
    <IntlProvider locale="en" messages={{}}>
      <ScheduleQualityCard baselineScore={baselineScore} candidateScore={candidateScore} />
    </IntlProvider>,
  );

describe('ScheduleQualityCard', () => {
  it('shows an improved delta in green when the candidate score is higher', () => {
    renderCard(score(60), score(80));
    expect(screen.getByText('60')).toBeInTheDocument();
    expect(screen.getByText('80')).toBeInTheDocument();
    expect(screen.getByText('▲ +20')).toBeInTheDocument();
  });

  it('shows a worsened delta when the candidate score is lower', () => {
    renderCard(score(80), score(60));
    expect(screen.getByText('▼ -20')).toBeInTheDocument();
  });

  it('shows no-change when scores are equal', () => {
    renderCard(score(80), score(80));
    expect(screen.getByText('No change')).toBeInTheDocument();
  });

  it('shows "not available" rather than a misleading raw delta when either side has no metrics configured', () => {
    renderCard(score(0, false), score(82));
    expect(screen.getByText(/not available/i)).toBeInTheDocument();
    expect(screen.queryByText(/\+82/i)).not.toBeInTheDocument();
  });
});
