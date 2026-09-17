import type { ScheduleComparison } from '@/types';

export interface ProposalGateEvaluation {
  readonly acceptable: boolean;
  readonly conflictsReduced: boolean;
  readonly conflictsUnchanged: boolean;
  readonly scoreChanged: boolean;
  readonly baselineConflictCount: number;
  readonly candidateConflictCount: number;
}

// Mirrors backend/src/utils/ProposalGate.ts#isProposalAcceptable so the
// review screen can explain the real accept/reject rule from the same
// comparison data it already renders, instead of the reviewer only finding
// out via a 409 on Approve. Keep these two in sync — this is a read-only
// explanation, not the actual gate (the backend remains the source of truth).
export function evaluateProposalGate(comparison: ScheduleComparison): ProposalGateEvaluation {
  const baselineConflictCount = comparison.baselineConflicts.length;
  const candidateConflictCount = comparison.candidateConflicts.length;
  const conflictsReduced = candidateConflictCount < baselineConflictCount;
  const conflictsUnchanged = candidateConflictCount === baselineConflictCount;
  const scoreChanged = comparison.candidateScore.score !== comparison.baselineScore.score;

  return {
    acceptable: conflictsReduced || (conflictsUnchanged && scoreChanged),
    conflictsReduced,
    conflictsUnchanged,
    scoreChanged,
    baselineConflictCount,
    candidateConflictCount,
  };
}
