import { describe, it, expect } from 'vitest';
import { translateRule } from './MetricRuleTranslator.js';
import type { MetricRule } from '../types/domain.js';

const makeRule = (target: string, condition: string): MetricRule => ({
  id: 'rule-1',
  name: 'Test Rule',
  target,
  condition,
  threshold: 0,
});

describe('MetricRuleTranslator', () => {
  describe('translateRule()', () => {
    it('translates Class/count to a Cypher with correct unit', () => {
      const result = translateRule(makeRule('Class', 'count'));

      expect(result.unit).toBe('classes');
      expect(result.cypher).toContain('Class');
      expect(result.cypher).toContain('count');
      expect(result.cypher).toContain('$branchId');
    });

    it('translates Professor/avg_classes_per_day with correct unit', () => {
      const result = translateRule(makeRule('Professor', 'avg_classes_per_day'));

      expect(result.unit).toBe('classes/day');
      expect(result.cypher).toContain('Professor');
      expect(result.cypher).toContain('avg');
      expect(result.cypher).toContain('$branchId');
    });

    it('translates Professor/max_classes_per_day with correct unit', () => {
      const result = translateRule(makeRule('Professor', 'max_classes_per_day'));

      expect(result.unit).toBe('classes/day');
      expect(result.cypher).toContain('Professor');
      expect(result.cypher).toContain('max');
      expect(result.cypher).toContain('$branchId');
    });

    it('translates Room/utilization with correct unit', () => {
      const result = translateRule(makeRule('Room', 'utilization'));

      expect(result.unit).toBe('%');
      expect(result.cypher).toContain('Room');
      expect(result.cypher).toContain('$branchId');
    });

    it('throws 400 ApiError for an unsupported target/condition combination', () => {
      expect(() => translateRule(makeRule('Professor', 'unknown_metric'))).toThrow();
      try {
        translateRule(makeRule('Professor', 'unknown_metric'));
      } catch (err) {
        expect((err as { statusCode?: number }).statusCode).toBe(400);
      }
    });

    it('throws 400 ApiError for a completely unknown target', () => {
      expect(() => translateRule(makeRule('Unknown', 'count'))).toThrow();
      try {
        translateRule(makeRule('Unknown', 'count'));
      } catch (err) {
        expect((err as { statusCode?: number }).statusCode).toBe(400);
      }
    });

    it('all translated Cypher queries use only parameterized $branchId (no inline values)', () => {
      const conditions: Array<[string, string]> = [
        ['Class', 'count'],
        ['Professor', 'avg_classes_per_day'],
        ['Professor', 'max_classes_per_day'],
        ['Room', 'utilization'],
      ];
      conditions.forEach(([target, condition]) => {
        const { cypher } = translateRule(makeRule(target, condition));
        expect(cypher).toContain('$branchId');
        // Ensure no raw string values are injected (no quoted literals beyond Cypher keywords)
        expect(cypher).not.toMatch(/'(?!branchId)[a-zA-Z]/);
      });
    });
  });
});
