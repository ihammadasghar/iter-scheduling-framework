import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { updateClassThunk } from '@/store/reducers/classSlice';
import { fetchConflictsThunk } from '@/store/reducers/conflictSlice';
import { fetchMetricsThunk } from '@/store/reducers/metricSlice';
import { fetchScoreThunk } from '@/store/reducers/scoreSlice';
import { simulationService } from '@/services/simulationService';
import type { MetricDelta, MetricResult } from '@/types';

export interface ScoreDelta {
  readonly before: number;
  readonly after: number;
}

// apply() reads roomId/timeSlotIds (and optionally professorId/
// studentGroupId) off its second argument — this loosened type (rather than
// the full Suggestion, which also carries conflictFree and never varies
// professor/group) lets any caller build its own hand-picked target and
// reuse this hook's PATCH/preview/refetch flow unchanged, with no parallel
// implementation. Suggestion satisfies this structurally (its extra fields
// are simply absent), so existing callers keep compiling unchanged.
export interface ReschedulePatch {
  readonly roomId: string;
  readonly timeSlotIds: readonly string[];
  readonly professorId?: string;
  readonly studentGroupId?: string;
}

interface UseApplySuggestionResult {
  readonly apply: (classId: string, target: ReschedulePatch) => Promise<boolean>;
  readonly loading: boolean;
  readonly error: string | null;
  readonly lastDelta: MetricDelta | null;
  readonly lastScoreDelta: ScoreDelta | null;
  readonly deltaLoading: boolean;
}

// Picks whichever metric moved the most between two snapshots (rather than
// "the first one that happens to differ") — null if nothing changed.
const pickBiggestDelta = (
  before: readonly MetricResult[],
  after: readonly MetricResult[],
): MetricDelta | null => {
  let best: MetricDelta | null = null;
  let bestAbsDiff = 0;

  for (const b of before) {
    const a = after.find((m) => m.name === b.name);
    if (a === undefined) continue;

    const diff = Math.abs(a.value - b.value);
    if (diff > bestAbsDiff) {
      bestAbsDiff = diff;
      best = { name: b.name, before: b.value, after: a.value, unit: b.unit, direction: b.direction };
    }
  }

  return best;
};

/**
 * Encapsulates: preview the candidate state → PATCH class (commit) → refresh
 * conflicts/metrics/score.
 *
 * The delta is computed as a *pre-commit preview* — via
 * `simulationService.previewClassUpdate`, a dry-run against the candidate
 * graph state — rather than by committing first and re-reading Redux state
 * afterwards. "After" values always come straight from that awaited preview
 * response, never from a selector re-read post-dispatch, so there is no
 * stale-closure window for them to go stale in.
 */
export const useApplySuggestion = (simId: string): UseApplySuggestionResult => {
  const dispatch = useAppDispatch();
  const currentMetrics = useAppSelector((s) => s.metric.metrics);
  const currentScore = useAppSelector((s) => s.score.current);

  const [loading, setLoading] = useState(false);
  const [deltaLoading, setDeltaLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastDelta, setLastDelta] = useState<MetricDelta | null>(null);
  const [lastScoreDelta, setLastScoreDelta] = useState<ScoreDelta | null>(null);

  const apply = async (classId: string, target: ReschedulePatch): Promise<boolean> => {
    setLoading(true);
    setError(null);
    setLastDelta(null);
    setLastScoreDelta(null);

    const patch = {
      roomId: target.roomId,
      timeSlotIds: [...target.timeSlotIds],
      ...(target.professorId !== undefined && { professorId: target.professorId }),
      ...(target.studentGroupId !== undefined && { studentGroupId: target.studentGroupId }),
    };

    setDeltaLoading(true);
    let preview;
    try {
      preview = await simulationService.previewClassUpdate(simId, classId, patch);
    } catch {
      setDeltaLoading(false);
      setLoading(false);
      setError('Failed to apply suggestion. Please try again.');
      return false;
    }
    setDeltaLoading(false);

    const result = await dispatch(updateClassThunk({ simId, classId, params: patch }));
    setLoading(false);

    if (!updateClassThunk.fulfilled.match(result)) {
      setError('Failed to apply suggestion. Please try again.');
      return false;
    }

    setLastDelta(pickBiggestDelta(currentMetrics, preview.metrics));
    if (currentScore !== null) {
      setLastScoreDelta({ before: currentScore.score, after: preview.score.score });
    }

    void dispatch(fetchConflictsThunk(simId));
    void dispatch(fetchMetricsThunk(simId));
    void dispatch(fetchScoreThunk(simId));
    return true;
  };

  return { apply, loading, error, lastDelta, lastScoreDelta, deltaLoading };
};
