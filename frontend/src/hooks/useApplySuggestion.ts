import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { updateClassThunk } from '@/store/reducers/classSlice';
import { fetchConflictsThunk } from '@/store/reducers/conflictSlice';
import { fetchMetricsThunk } from '@/store/reducers/metricSlice';
import type { Suggestion, MetricDelta } from '@/types';

interface UseApplySuggestionResult {
  readonly apply: (classId: string, suggestion: Suggestion) => Promise<void>;
  readonly loading: boolean;
  readonly error: string | null;
  readonly lastDelta: MetricDelta | null;
  readonly deltaLoading: boolean;
}

/**
 * Encapsulates: PATCH class → wait 300ms → refresh conflicts + metrics → compute metric delta.
 */
export const useApplySuggestion = (simId: string): UseApplySuggestionResult => {
  const dispatch = useAppDispatch();
  const currentMetrics = useAppSelector((s) => s.metric.metrics);

  const [loading, setLoading] = useState(false);
  const [deltaLoading, setDeltaLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastDelta, setLastDelta] = useState<MetricDelta | null>(null);

  const apply = async (classId: string, suggestion: Suggestion): Promise<void> => {
    setLoading(true);
    setError(null);
    setLastDelta(null);

    // Snapshot metrics before the change
    const metricsBefore = [...currentMetrics];

    const result = await dispatch(
      updateClassThunk({
        simId,
        classId,
        params: {
          roomId: suggestion.roomId,
          timeSlotIds: [...suggestion.timeSlotIds],
        },
      }),
    );

    setLoading(false);

    if (!updateClassThunk.fulfilled.match(result)) {
      setError('Failed to apply suggestion. Please try again.');
      return;
    }

    // Debounce: wait 300ms before refreshing derived data
    await new Promise<void>((resolve) => setTimeout(resolve, 300));

    setDeltaLoading(true);
    await Promise.all([
      dispatch(fetchConflictsThunk(simId)),
      dispatch(fetchMetricsThunk(simId)),
    ]);
    setDeltaLoading(false);

    // Compute delta from the first metric that changed (the most important one)
    const metricsAfter = currentMetrics; // selector re-evaluated after dispatch
    const changed = metricsBefore.find((before) => {
      const after = metricsAfter.find((m) => m.name === before.name);
      return after !== undefined && after.value !== before.value;
    });

    if (changed !== undefined) {
      const after = metricsAfter.find((m) => m.name === changed.name);
      if (after !== undefined) {
        setLastDelta({
          name: changed.name,
          before: changed.value,
          after: after.value,
          unit: changed.unit,
        });
      }
    }
  };

  return { apply, loading, error, lastDelta, deltaLoading };
};
