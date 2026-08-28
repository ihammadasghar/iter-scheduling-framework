import { describe, it, expect } from 'vitest';
import { translateConstraint } from './ConstraintTranslator.js';
import type { Constraint } from '../types/domain.js';

const makeConstraint = (violationCondition: string, limit?: number): Constraint => ({
  id: 'constraint-1',
  name: 'Test Constraint',
  target: 'Professor',
  violationCondition,
  ...(limit !== undefined ? { limit } : {}),
});

describe('ConstraintTranslator', () => {
  describe('translateConstraint()', () => {
    it('translates consecutive_limit to a Cypher with the limit interpolated into the NEXT hop bound', () => {
      const result = translateConstraint(makeConstraint('consecutive_limit', 3));

      expect(result.cypher).toContain('NEXT*3');
      expect(result.cypher).toContain('$branchId');
      expect(result.cypher).toContain('TAUGHT_BY');
      expect(result.cypher).toContain('classId1');
      expect(result.cypher).toContain('classId2');
      expect(result.cypher).toContain('resourceName');
    });

    it('rejects consecutive_limit with a missing/non-positive limit', () => {
      expect(() => translateConstraint(makeConstraint('consecutive_limit'))).toThrow();
      expect(() => translateConstraint(makeConstraint('consecutive_limit', 0))).toThrow();
      expect(() => translateConstraint(makeConstraint('consecutive_limit', -1))).toThrow();
      expect(() => translateConstraint(makeConstraint('consecutive_limit', 1.5))).toThrow();
      try {
        translateConstraint(makeConstraint('consecutive_limit', 0));
      } catch (err) {
        expect((err as { statusCode?: number }).statusCode).toBe(400);
      }
    });

    it('translates gap_limit to a Cypher using $limit as a parameter (not interpolated)', () => {
      const result = translateConstraint(makeConstraint('gap_limit', 2));

      expect(result.cypher).toContain('$limit');
      expect(result.cypher).toContain('$branchId');
      expect(result.cypher).toContain('NEXT*1..8');
      expect(result.cypher).toContain('classId1');
      expect(result.cypher).toContain('classId2');
      expect(result.cypher).toContain('resourceName');
    });

    it('rejects gap_limit with a missing/non-positive limit', () => {
      expect(() => translateConstraint(makeConstraint('gap_limit'))).toThrow();
      expect(() => translateConstraint(makeConstraint('gap_limit', 0))).toThrow();
      expect(() => translateConstraint(makeConstraint('gap_limit', -3))).toThrow();
      try {
        translateConstraint(makeConstraint('gap_limit', -3));
      } catch (err) {
        expect((err as { statusCode?: number }).statusCode).toBe(400);
      }
    });

    it('throws 400 ApiError for an unsupported violationCondition', () => {
      expect(() => translateConstraint(makeConstraint('room_double_book'))).toThrow();
      try {
        translateConstraint(makeConstraint('professor_overlap'));
      } catch (err) {
        expect((err as { statusCode?: number }).statusCode).toBe(400);
      }
    });
  });
});
