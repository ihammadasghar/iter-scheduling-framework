import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import ProposalSummaryStrip from './ProposalSummaryStrip';
import type { WeightedScoreResult } from '@/types';

const score = (value: number, hasBreakdown = true): WeightedScoreResult => ({
  score: value,
  breakdown: hasBreakdown
    ? [{ name: 'Room Utilization', value: 78, unit: '%', weight: 2, threshold: 80, normalizedScore: 90 }]
    : [],
});

const renderStrip = (props: Partial<React.ComponentProps<typeof ProposalSummaryStrip>>) =>
  render(
    <IntlProvider locale="en" messages={{}}>
      <ProposalSummaryStrip
        ciStatus="READY"
        baselineScore={score(60)}
        candidateScore={score(80)}
        baselineConflictCount={2}
        candidateConflictCount={1}
        {...props}
      />
    </IntlProvider>,
  );

describe('ProposalSummaryStrip', () => {
  it('shows the CI status badge when a CI status is provided', () => {
    renderStrip({ ciStatus: 'READY' });
    expect(screen.getByText(/checked — no conflicts/i)).toBeInTheDocument();
  });

  it('omits the CI status section when ciStatus is null (e.g. merged/rejected proposals)', () => {
    renderStrip({ ciStatus: null });
    expect(screen.queryByText(/checked — no conflicts/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/has scheduling conflicts/i)).not.toBeInTheDocument();
  });

  it('shows an improved score delta in green when the candidate score is higher', () => {
    renderStrip({ baselineScore: score(60), candidateScore: score(80) });
    expect(screen.getByText('Score: +20')).toBeInTheDocument();
  });

  it('shows a worsened score delta when the candidate score is lower', () => {
    renderStrip({ baselineScore: score(80), candidateScore: score(60) });
    expect(screen.getByText('Score: -20')).toBeInTheDocument();
  });

  it('shows no-change when scores are equal', () => {
    renderStrip({ baselineScore: score(80), candidateScore: score(80) });
    expect(screen.getByText('Score: no change')).toBeInTheDocument();
  });

  it('shows "not available" rather than a misleading raw delta when either side has no metrics configured', () => {
    renderStrip({ baselineScore: score(0, false), candidateScore: score(82) });
    expect(screen.getByText('Score: not available')).toBeInTheDocument();
    expect(screen.queryByText(/score: \+82/i)).not.toBeInTheDocument();
  });

  it('shows a reduced-conflicts delta when conflicts decrease', () => {
    renderStrip({ baselineConflictCount: 3, candidateConflictCount: 1 });
    expect(screen.getByText('2 fewer conflicts')).toBeInTheDocument();
  });

  it('shows an increased-conflicts delta when conflicts increase', () => {
    renderStrip({ baselineConflictCount: 1, candidateConflictCount: 3 });
    expect(screen.getByText('2 more conflicts')).toBeInTheDocument();
  });

  it('shows no-change when conflict counts are equal', () => {
    renderStrip({ baselineConflictCount: 2, candidateConflictCount: 2 });
    expect(screen.getByText('No change in conflicts')).toBeInTheDocument();
  });
});
