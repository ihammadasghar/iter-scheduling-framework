import { describe, it, expect } from 'vitest';
import { buildMetricDeltas } from './buildMetricDeltas';
import type { WeightedScoreResult } from '@/types';

const breakdownEntry = (name: string, value: number, unit = '%') => ({
  name, value, unit, weight: 1, threshold: 80, normalizedScore: value,
});

describe('buildMetricDeltas', () => {
  it('returns empty array when both sides have no breakdown', () => {
    const empty: WeightedScoreResult = { score: 0, breakdown: [] };
    expect(buildMetricDeltas(empty, empty)).toEqual([]);
  });

  it('pairs matching metrics by name into before/after', () => {
    const baseline: WeightedScoreResult = { score: 50, breakdown: [breakdownEntry('Room Utilization', 50)] };
    const candidate: WeightedScoreResult = { score: 70, breakdown: [breakdownEntry('Room Utilization', 70)] };

    const deltas = buildMetricDeltas(baseline, candidate);

    expect(deltas).toEqual([{ name: 'Room Utilization', before: 50, after: 70, unit: '%' }]);
  });

  it('handles multiple metrics, preserving baseline order first', () => {
    const baseline: WeightedScoreResult = {
      score: 50,
      breakdown: [breakdownEntry('Room Utilization', 50), breakdownEntry('Avg Classes/Day', 2, 'classes/day')],
    };
    const candidate: WeightedScoreResult = {
      score: 70,
      breakdown: [breakdownEntry('Room Utilization', 70), breakdownEntry('Avg Classes/Day', 3, 'classes/day')],
    };

    const deltas = buildMetricDeltas(baseline, candidate);

    expect(deltas.map((d) => d.name)).toEqual(['Room Utilization', 'Avg Classes/Day']);
  });

  it('defaults a metric missing from one side to 0', () => {
    const baseline: WeightedScoreResult = { score: 0, breakdown: [] };
    const candidate: WeightedScoreResult = { score: 70, breakdown: [breakdownEntry('Room Utilization', 70)] };

    const deltas = buildMetricDeltas(baseline, candidate);

    expect(deltas).toEqual([{ name: 'Room Utilization', before: 0, after: 70, unit: '%' }]);
  });
});
