// Pairs up a baseline and candidate WeightedScoreResult's per-metric
// breakdowns (matched by metric name) into the MetricDelta shape the review
// screen renders. Both sides are scored against the same institution-wide
// rules.json, so their breakdowns share the same metric names in practice —
// but a metric added/removed between reads is handled gracefully (falls
// back to 0 on whichever side is missing it).
import type { MetricDelta, WeightedScoreResult } from '@/types';

export function buildMetricDeltas(
  baseline: WeightedScoreResult,
  candidate: WeightedScoreResult,
): MetricDelta[] {
  const baselineByName = new Map(baseline.breakdown.map((b) => [b.name, b]));
  const candidateByName = new Map(candidate.breakdown.map((b) => [b.name, b]));
  const names = [...new Set([...baselineByName.keys(), ...candidateByName.keys()])];

  return names.map((name) => {
    const before = baselineByName.get(name);
    const after = candidateByName.get(name);
    return {
      name,
      before: before?.value ?? 0,
      after: after?.value ?? 0,
      unit: after?.unit ?? before?.unit ?? '',
      direction: after?.direction ?? before?.direction,
    };
  });
}
