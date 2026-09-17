import { describe, it, expect } from 'vitest';
import { evaluateProposalGate } from './proposalGate';
import type { Conflict, ScheduleComparison } from '@/types';

const makeConflict = (id: string): Conflict => ({
  id,
  type: 'ROOM_DOUBLE_BOOK',
  classIds: ['CLS_001', 'CLS_002'],
  message: '',
});

const makeComparison = (overrides: {
  baselineConflictCount?: number;
  candidateConflictCount?: number;
  baselineScore?: number;
  candidateScore?: number;
} = {}): ScheduleComparison => ({
  baselineScore: { score: overrides.baselineScore ?? 0, breakdown: [] },
  candidateScore: { score: overrides.candidateScore ?? 0, breakdown: [] },
  baselineConflicts: Array.from({ length: overrides.baselineConflictCount ?? 0 }, (_, i) => makeConflict(`b${i}`)),
  candidateConflicts: Array.from({ length: overrides.candidateConflictCount ?? 0 }, (_, i) => makeConflict(`c${i}`)),
  conflictDelta: { added: [], resolved: [] },
  classDiff: { added: [], removed: [], changed: [] },
});

describe('evaluateProposalGate', () => {
  it('is acceptable when conflicts strictly decrease, regardless of score', () => {
    const result = evaluateProposalGate(
      makeComparison({ baselineConflictCount: 3, candidateConflictCount: 2, baselineScore: 50, candidateScore: 50 }),
    );
    expect(result.acceptable).toBe(true);
    expect(result.conflictsReduced).toBe(true);
    expect(result.conflictsUnchanged).toBe(false);
  });

  it('is acceptable when conflicts are unchanged but the score changes', () => {
    const result = evaluateProposalGate(
      makeComparison({ baselineConflictCount: 2, candidateConflictCount: 2, baselineScore: 50, candidateScore: 60 }),
    );
    expect(result.acceptable).toBe(true);
    expect(result.conflictsUnchanged).toBe(true);
    expect(result.scoreChanged).toBe(true);
  });

  it('is not acceptable when conflicts are unchanged and the score is unchanged', () => {
    const result = evaluateProposalGate(
      makeComparison({ baselineConflictCount: 2, candidateConflictCount: 2, baselineScore: 50, candidateScore: 50 }),
    );
    expect(result.acceptable).toBe(false);
    expect(result.conflictsUnchanged).toBe(true);
    expect(result.scoreChanged).toBe(false);
  });

  it('is not acceptable when conflicts increase, even if the score improves', () => {
    const result = evaluateProposalGate(
      makeComparison({ baselineConflictCount: 2, candidateConflictCount: 3, baselineScore: 50, candidateScore: 90 }),
    );
    expect(result.acceptable).toBe(false);
    expect(result.conflictsReduced).toBe(false);
    expect(result.conflictsUnchanged).toBe(false);
  });

  it('reports the raw baseline and candidate conflict counts', () => {
    const result = evaluateProposalGate(makeComparison({ baselineConflictCount: 4, candidateConflictCount: 1 }));
    expect(result.baselineConflictCount).toBe(4);
    expect(result.candidateConflictCount).toBe(1);
  });
});
