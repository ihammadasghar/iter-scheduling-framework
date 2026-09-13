import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import HealthSummaryTile from './HealthSummaryTile';

const renderTile = (conflictCount: number) =>
  render(
    <IntlProvider locale="en" messages={{}}>
      <HealthSummaryTile conflictCount={conflictCount} />
    </IntlProvider>,
  );

describe('HealthSummaryTile', () => {
  it('shows a healthy message when there are no conflicts', () => {
    renderTile(0);
    expect(screen.getByText(/no scheduling conflicts/i)).toBeInTheDocument();
  });

  it('shows a singular conflict message', () => {
    renderTile(1);
    expect(screen.getByText(/1 scheduling conflict found/i)).toBeInTheDocument();
  });

  it('shows a plural conflicts message', () => {
    renderTile(3);
    expect(screen.getByText(/3 scheduling conflicts found/i)).toBeInTheDocument();
  });
});
