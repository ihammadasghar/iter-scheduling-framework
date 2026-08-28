import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ConflictsComparisonPanel from './ConflictsComparisonPanel';
import type { Conflict } from '@/types';

const CONFLICT: Conflict = {
  id: 'ROOM_DOUBLE_BOOK_CLS_001_CLS_002',
  type: 'ROOM_DOUBLE_BOOK',
  classIds: ['CLS_001', 'CLS_002'],
  message: 'Room RM_101 is double-booked between CLS_001 and CLS_002.',
};

const RESOLVED_CONFLICT: Conflict = {
  id: 'PROFESSOR_OVERLAP_CLS_003_CLS_004',
  type: 'PROFESSOR_OVERLAP',
  classIds: ['CLS_003', 'CLS_004'],
  message: 'Dr. Smith is double-booked between CLS_003 and CLS_004.',
};

const POLICY_VIOLATION: Conflict = {
  id: 'CONSECUTIVE_LIMIT_EXCEEDED_constraint-1_CLS_005_CLS_007',
  type: 'CONSECUTIVE_LIMIT_EXCEEDED',
  classIds: ['CLS_005', 'CLS_007'],
  message: "Professor 'Dr. Jones' teaches more than 3 consecutive periods (classes CLS_005–CLS_007)",
};

describe('ConflictsComparisonPanel', () => {
  it('renders both baseline and candidate health tiles with no delta banner when nothing changed', () => {
    render(
      <ConflictsComparisonPanel
        baselineConflicts={[]}
        candidateConflicts={[]}
        conflictDelta={{ added: [], resolved: [] }}
      />,
    );
    expect(screen.getAllByText('No scheduling conflicts')).toHaveLength(2);
    expect(screen.queryByText(/new conflict/)).not.toBeInTheDocument();
  });

  it('shows a warning banner and list when a conflict is newly introduced', () => {
    render(
      <ConflictsComparisonPanel
        baselineConflicts={[]}
        candidateConflicts={[CONFLICT]}
        conflictDelta={{ added: [CONFLICT], resolved: [] }}
      />,
    );
    expect(screen.getByText(/1 new conflict introduced/)).toBeInTheDocument();
    expect(screen.getByText('Newly Introduced Conflicts (1)')).toBeInTheDocument();
    expect(screen.getByText(CONFLICT.message)).toBeInTheDocument();
  });

  it('shows a resolved-conflicts list when a conflict disappears', () => {
    render(
      <ConflictsComparisonPanel
        baselineConflicts={[RESOLVED_CONFLICT]}
        candidateConflicts={[]}
        conflictDelta={{ added: [], resolved: [RESOLVED_CONFLICT] }}
      />,
    );
    expect(screen.getByText(/1 conflict resolved/)).toBeInTheDocument();
    expect(screen.getByText('Resolved Conflicts (1)')).toBeInTheDocument();
    expect(screen.getByText(RESOLVED_CONFLICT.message)).toBeInTheDocument();
  });

  it('renders both added and resolved conflict lists together', () => {
    render(
      <ConflictsComparisonPanel
        baselineConflicts={[RESOLVED_CONFLICT]}
        candidateConflicts={[CONFLICT]}
        conflictDelta={{ added: [CONFLICT], resolved: [RESOLVED_CONFLICT] }}
      />,
    );
    expect(screen.getByText('Newly Introduced Conflicts (1)')).toBeInTheDocument();
    expect(screen.getByText('Resolved Conflicts (1)')).toBeInTheDocument();
  });

  it('labels a policy constraint violation as an institution rule, distinct from structural conflicts', () => {
    render(
      <ConflictsComparisonPanel
        baselineConflicts={[]}
        candidateConflicts={[CONFLICT, POLICY_VIOLATION]}
        conflictDelta={{ added: [CONFLICT, POLICY_VIOLATION], resolved: [] }}
      />,
    );

    expect(screen.getByText(`Institution rule violated: ${POLICY_VIOLATION.message}`)).toBeInTheDocument();
    // The structural conflict renders its plain message, with no prefix.
    expect(screen.getByText(CONFLICT.message)).toBeInTheDocument();
    expect(screen.queryByText(`Institution rule violated: ${CONFLICT.message}`)).not.toBeInTheDocument();
  });
});
