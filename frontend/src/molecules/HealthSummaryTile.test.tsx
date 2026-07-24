import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import HealthSummaryTile from './HealthSummaryTile';

describe('HealthSummaryTile', () => {
  it('shows a healthy message when there are no conflicts', () => {
    render(<HealthSummaryTile conflictCount={0} />);
    expect(screen.getByText(/no scheduling conflicts/i)).toBeInTheDocument();
  });

  it('shows a singular conflict message', () => {
    render(<HealthSummaryTile conflictCount={1} />);
    expect(screen.getByText(/1 scheduling conflict found/i)).toBeInTheDocument();
  });

  it('shows a plural conflicts message', () => {
    render(<HealthSummaryTile conflictCount={3} />);
    expect(screen.getByText(/3 scheduling conflicts found/i)).toBeInTheDocument();
  });
});
