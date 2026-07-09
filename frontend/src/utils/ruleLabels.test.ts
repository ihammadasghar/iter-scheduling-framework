import { describe, it, expect } from 'vitest';
import {
  getTargetLabel,
  getConditionLabel,
  getConditionsByTarget,
  getViolationConditionLabel,
} from './ruleLabels';

describe('ruleLabels', () => {
  describe('getTargetLabel', () => {
    it('returns human label for known targets', () => {
      expect(getTargetLabel('classes')).toBe('Classes');
      expect(getTargetLabel('lecturers')).toBe('Lecturers');
      expect(getTargetLabel('rooms')).toBe('Rooms');
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
    it('returns only count for classes', () => {
      const opts = getConditionsByTarget('classes');
      expect(opts).toHaveLength(1);
      expect(opts[0]!.value).toBe('count');
    });

    it('returns two options for lecturers', () => {
      const opts = getConditionsByTarget('lecturers');
      expect(opts).toHaveLength(2);
      const values = opts.map((o) => o.value);
      expect(values).toContain('avg_classes_per_day');
      expect(values).toContain('max_classes_per_day');
    });

    it('returns utilization for rooms', () => {
      const opts = getConditionsByTarget('rooms');
      expect(opts).toHaveLength(1);
      expect(opts[0]!.value).toBe('utilization');
    });

    it('returns empty array for unknown target', () => {
      expect(getConditionsByTarget('unknown')).toEqual([]);
    });

    it('is a pure function — does not mutate on multiple calls', () => {
      const first = getConditionsByTarget('lecturers');
      const second = getConditionsByTarget('lecturers');
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
});
