import { describe, it, expect } from 'vitest';
import {
  getTargetLabel,
  getConditionLabel,
  getConditionsByTarget,
  getViolationConditionLabel,
  TARGET_OPTIONS,
} from './ruleLabels';

describe('ruleLabels', () => {
  describe('getTargetLabel', () => {
    it('returns human label for known targets', () => {
      expect(getTargetLabel('Class')).toBe('Classes');
      expect(getTargetLabel('Professor')).toBe('Lecturers');
      expect(getTargetLabel('Room')).toBe('Rooms');
      expect(getTargetLabel('StudentGroup')).toBe('Student Groups');
    });

    it('returns the raw value for unknown targets', () => {
      expect(getTargetLabel('unknown_target')).toBe('unknown_target');
    });
  });

  describe('getConditionLabel', () => {
    it('returns human label for known conditions', () => {
      expect(getConditionLabel('count')).toBe('Total number of classes');
      expect(getConditionLabel('utilization')).toBe('Percentage of rooms in use');
      expect(getConditionLabel('avg_classes_per_day')).toBe('Average classes per lecturer per day');
    });

    it('returns the raw value for unknown conditions', () => {
      expect(getConditionLabel('unknown_cond')).toBe('unknown_cond');
    });
  });

  describe('getConditionsByTarget', () => {
    it('returns only count for Class', () => {
      const opts = getConditionsByTarget('Class');
      expect(opts).toHaveLength(1);
      expect(opts[0]!.value).toBe('count');
    });

    it('returns four options for Professor', () => {
      const opts = getConditionsByTarget('Professor');
      expect(opts).toHaveLength(4);
      const values = opts.map((o) => o.value);
      expect(values).toContain('avg_classes_per_day');
      expect(values).toContain('max_classes_per_day');
      expect(values).toContain('back_to_back_ratio');
      expect(values).toContain('room_consistency');
    });

    it('returns utilization for Room', () => {
      const opts = getConditionsByTarget('Room');
      expect(opts).toHaveLength(1);
      expect(opts[0]!.value).toBe('utilization');
    });

    it('returns free_day_ratio for StudentGroup', () => {
      const opts = getConditionsByTarget('StudentGroup');
      expect(opts).toHaveLength(1);
      expect(opts[0]!.value).toBe('free_day_ratio');
    });

    it('returns empty array for unknown target', () => {
      expect(getConditionsByTarget('unknown')).toEqual([]);
    });

    it('is a pure function — does not mutate on multiple calls', () => {
      const first = getConditionsByTarget('Professor');
      const second = getConditionsByTarget('Professor');
      expect(first).toEqual(second);
    });
  });

  describe('getViolationConditionLabel', () => {
    it('returns human label for professor_overlap', () => {
      expect(getViolationConditionLabel('professor_overlap')).toContain('Lecturer teaches two');
    });

    it('returns raw value for unknown condition', () => {
      expect(getViolationConditionLabel('unknown')).toBe('unknown');
    });
  });

  describe('TARGET_OPTIONS', () => {
    // Guards against the target-vocabulary mismatch bug: these values are
    // sent verbatim to the backend and must match
    // backend/src/utils/MetricRuleTranslator.ts's TRANSLATION_MAP keys
    // exactly (Class/Professor/Room/StudentGroup) — not a lowercase/plural
    // frontend-only vocabulary.
    it('uses target values matching the backend catalog', () => {
      const values = TARGET_OPTIONS.map((o) => o.value);
      expect(values).toEqual(['Class', 'Professor', 'Room', 'StudentGroup']);
    });
  });
});
