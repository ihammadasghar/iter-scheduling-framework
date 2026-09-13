import { describe, it, expect } from 'vitest';
import { createIntl } from 'react-intl';
import {
  getTargetLabel,
  getConditionLabel,
  getConditionsByTarget,
  getViolationConditionLabel,
  getTargetOptions,
} from './ruleLabels';

const intl = createIntl({ locale: 'en', messages: {} });

describe('ruleLabels', () => {
  describe('getTargetLabel', () => {
    it('returns human label for known targets', () => {
      expect(getTargetLabel(intl, 'Class')).toBe('Classes');
      expect(getTargetLabel(intl, 'Professor')).toBe('Lecturers');
      expect(getTargetLabel(intl, 'Room')).toBe('Rooms');
      expect(getTargetLabel(intl, 'StudentGroup')).toBe('Student Groups');
    });

    it('returns the raw value for unknown targets', () => {
      expect(getTargetLabel(intl, 'unknown_target')).toBe('unknown_target');
    });
  });

  describe('getConditionLabel', () => {
    it('returns human label for known conditions', () => {
      expect(getConditionLabel(intl, 'count')).toBe('Total number of classes');
      expect(getConditionLabel(intl, 'utilization')).toBe('Percentage of rooms in use');
      expect(getConditionLabel(intl, 'avg_classes_per_day')).toBe('Average classes per lecturer per day');
    });

    it('returns the raw value for unknown conditions', () => {
      expect(getConditionLabel(intl, 'unknown_cond')).toBe('unknown_cond');
    });
  });

  describe('getConditionsByTarget', () => {
    it('returns only count for Class', () => {
      const opts = getConditionsByTarget(intl, 'Class');
      expect(opts).toHaveLength(1);
      expect(opts[0]!.value).toBe('count');
    });

    it('returns five options for Professor', () => {
      const opts = getConditionsByTarget(intl, 'Professor');
      expect(opts).toHaveLength(5);
      const values = opts.map((o) => o.value);
      expect(values).toContain('avg_classes_per_day');
      expect(values).toContain('max_classes_per_day');
      expect(values).toContain('back_to_back_ratio');
      expect(values).toContain('room_consistency');
      expect(values).toContain('avg_gap_length');
    });

    it('returns utilization for Room', () => {
      const opts = getConditionsByTarget(intl, 'Room');
      expect(opts).toHaveLength(1);
      expect(opts[0]!.value).toBe('utilization');
    });

    it('returns free_day_ratio for StudentGroup', () => {
      const opts = getConditionsByTarget(intl, 'StudentGroup');
      expect(opts).toHaveLength(1);
      expect(opts[0]!.value).toBe('free_day_ratio');
    });

    it('returns empty array for unknown target', () => {
      expect(getConditionsByTarget(intl, 'unknown')).toEqual([]);
    });

    it('is a pure function — does not mutate on multiple calls', () => {
      const first = getConditionsByTarget(intl, 'Professor');
      const second = getConditionsByTarget(intl, 'Professor');
      expect(first).toEqual(second);
    });
  });

  describe('getViolationConditionLabel', () => {
    it('returns human label for professor_overlap', () => {
      expect(getViolationConditionLabel(intl, 'professor_overlap')).toContain('Lecturer teaches two');
    });

    it('returns raw value for unknown condition', () => {
      expect(getViolationConditionLabel(intl, 'unknown')).toBe('unknown');
    });
  });

  describe('getTargetOptions', () => {
    // Guards against the target-vocabulary mismatch bug: these values are
    // sent verbatim to the backend and must match
    // backend/src/utils/MetricRuleTranslator.ts's TRANSLATION_MAP keys
    // exactly (Class/Professor/Room/StudentGroup) — not a lowercase/plural
    // frontend-only vocabulary.
    it('uses target values matching the backend catalog', () => {
      const values = getTargetOptions(intl).map((o) => o.value);
      expect(values).toEqual(['Class', 'Professor', 'Room', 'StudentGroup']);
    });
  });
});
