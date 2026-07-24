import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ConflictBreakdownChart from './ConflictBreakdownChart';

const ZERO_COUNTS = [
  { type: 'ROOM_DOUBLE_BOOK' as const, label: 'Room double-booked', count: 0 },
  { type: 'PROFESSOR_OVERLAP' as const, label: 'Lecturer double-booked', count: 0 },
  { type: 'GROUP_OVERLAP' as const, label: 'Student group overlap', count: 0 },
];

describe('ConflictBreakdownChart', () => {
  it('shows "No conflicts to report" when all counts are zero', () => {
    render(<ConflictBreakdownChart counts={ZERO_COUNTS} />);
    expect(screen.getByText(/no conflicts to report/i)).toBeInTheDocument();
  });

  it('renders the chart when there is at least one conflict', () => {
    const counts = [{ ...ZERO_COUNTS[0]!, count: 2 }, ZERO_COUNTS[1]!, ZERO_COUNTS[2]!];
    render(<ConflictBreakdownChart counts={counts} />);
    expect(screen.getByLabelText(/conflicts by type/i)).toBeInTheDocument();
  });
});
