import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import ProposalSummaryStrip from './ProposalSummaryStrip';

const renderStrip = (props: Partial<React.ComponentProps<typeof ProposalSummaryStrip>>) =>
  render(
    <IntlProvider locale="en" messages={{}}>
      <ProposalSummaryStrip
        ciStatus="READY"
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
