// Shared param validation for metric rules and constraints, used identically
// by RulesService.createMetric/createConstraint, updateMetric/updateConstraint,
// and readRules()'s per-entry schema check on every rules.json read. Keeping
// this in one place means a rule that would be rejected on write can never
// silently slip through on read (or vice versa) — see RulesService.ts and
// the plan's "Key discovery" note for why that matters.

import { ApiError } from '../types/ApiError.js';
import { isSupportedMetric } from './MetricRuleTranslator.js';
import { isPolicyConstraint, isKnownViolationCondition } from './ConstraintTranslator.js';
import type { CreateMetricRuleParams, CreateConstraintParams } from '../types/domain.js';

export function validateMetricParams(params: CreateMetricRuleParams): void {
  const { name, target, condition, threshold, weight, direction } = params;
  if (!name || name.trim() === '') throw ApiError.badRequest('name is required');
  if (!target || target.trim() === '') throw ApiError.badRequest('target is required');
  if (!condition || condition.trim() === '') throw ApiError.badRequest('condition is required');
  if (!Number.isFinite(threshold)) throw ApiError.badRequest('threshold must be a finite number');
  if (!Number.isFinite(weight) || weight <= 0) {
    throw ApiError.badRequest('weight must be a positive finite number');
  }
  if (direction !== undefined && direction !== 'higher_is_better' && direction !== 'lower_is_better') {
    throw ApiError.badRequest('direction must be "higher_is_better" or "lower_is_better"');
  }
  if (!isSupportedMetric(target, condition)) {
    throw ApiError.badRequest(`Unsupported metric rule: target='${target}', condition='${condition}'`);
  }
}

export function validateConstraintParams(params: CreateConstraintParams): void {
  const { name, target, violationCondition, limit } = params;
  if (!name || name.trim() === '') throw ApiError.badRequest('name is required');
  if (!target || target.trim() === '') throw ApiError.badRequest('target is required');
  if (!violationCondition || violationCondition.trim() === '') {
    throw ApiError.badRequest('violationCondition is required');
  }
  if (!isKnownViolationCondition(violationCondition)) {
    throw ApiError.badRequest(`Unknown violationCondition: '${violationCondition}'`);
  }

  const needsLimit = isPolicyConstraint(violationCondition);
  if (needsLimit) {
    if (!Number.isInteger(limit) || (limit as number) <= 0) {
      throw ApiError.badRequest('limit must be a positive integer');
    }
  } else if (limit !== undefined) {
    throw ApiError.badRequest(`limit must not be provided for violationCondition "${violationCondition}"`);
  }
}
