// Pure label-resolution utilities for rule builder UI.
// Maps internal API keys to plain English labels.
// All functions are pure — no side effects, no external dependencies.
//
// NOTE: `RuleTarget` values must match the backend's MetricRuleTranslator
// catalog keys exactly (backend/src/utils/MetricRuleTranslator.ts) — these
// are sent verbatim as the `target` field of a metric rule, and evaluation
// 400s if they don't match one of the backend's `target:condition` pairs.

import type { MetricDirection } from '@/types';

export type RuleTarget = 'Class' | 'Professor' | 'Room' | 'StudentGroup';
export type RuleCondition =
  | 'count'
  | 'avg_classes_per_day'
  | 'max_classes_per_day'
  | 'utilization'
  | 'back_to_back_ratio'
  | 'room_consistency'
  | 'free_day_ratio'
  | 'avg_gap_length';

export interface ConditionOption {
  readonly value: RuleCondition;
  readonly label: string;
  readonly unit: string;
}

const TARGET_LABELS: Record<string, string> = {
  Class: 'Classes',
  Professor: 'Lecturers',
  Room: 'Rooms',
  StudentGroup: 'Student Groups',
};

const CONDITION_LABELS: Record<string, string> = {
  count: 'Total number of classes',
  avg_classes_per_day: 'Average classes per lecturer per day',
  max_classes_per_day: 'Maximum classes any lecturer teaches in one day',
  utilization: 'Percentage of rooms in use',
  back_to_back_ratio: 'Share of a lecturer\'s classes scheduled back-to-back',
  room_consistency: 'Share of a lecturer\'s classes held in their most-used room',
  free_day_ratio: 'Share of student groups with at least one free day',
  avg_gap_length: 'Average idle gap between a lecturer\'s classes',
};

const CONDITIONS_BY_TARGET: Record<string, readonly ConditionOption[]> = {
  Class: [
    { value: 'count', label: 'Total number of classes', unit: 'classes' },
  ],
  Professor: [
    { value: 'avg_classes_per_day', label: 'Average classes per lecturer per day', unit: 'classes/day' },
    { value: 'max_classes_per_day', label: 'Maximum classes any lecturer teaches in one day', unit: 'classes' },
    { value: 'back_to_back_ratio', label: 'Share of a lecturer\'s classes scheduled back-to-back', unit: '%' },
    { value: 'room_consistency', label: 'Share of a lecturer\'s classes held in their most-used room', unit: '%' },
    { value: 'avg_gap_length', label: 'Average idle gap between a lecturer\'s classes', unit: 'slots' },
  ],
  Room: [
    { value: 'utilization', label: 'Percentage of rooms in use', unit: '%' },
  ],
  StudentGroup: [
    { value: 'free_day_ratio', label: 'Share of student groups with at least one free day', unit: '%' },
  ],
};

const VIOLATION_CONDITION_LABELS: Record<string, string> = {
  professor_overlap: 'Lecturer teaches two classes at the same time',
  room_double_book: 'Room booked for two classes at the same time',
  group_overlap: 'Student group in two classes at once',
  consecutive_limit: 'Lecturer teaches more than allowed consecutive periods',
  gap_limit: 'Gap between a lecturer\'s classes exceeds the allowed maximum',
  room_capacity_exceeded: 'Room assigned to a class smaller than the group it holds',
};

export const getTargetLabel = (target: string): string =>
  TARGET_LABELS[target] ?? target;

export const getConditionLabel = (condition: string): string =>
  CONDITION_LABELS[condition] ?? condition;

export const getConditionsByTarget = (target: string): readonly ConditionOption[] =>
  CONDITIONS_BY_TARGET[target] ?? [];

// Sensible default direction per condition, used to pre-fill (but never
// silently overwrite) AddMetricDialog's direction control. `count` and
// avg_classes_per_day` are deliberately absent — an institution wants a
// value *close to* a specific count/average, not simply "more" or "less"
// of it, so they keep the symmetric distance-from-threshold scoring as
// their sensible default too. Mirrors the "Lower is better"/etc. comments
// in the backend's MetricRuleTranslator.ts.
const DIRECTION_BY_CONDITION: Partial<Record<RuleCondition, MetricDirection>> = {
  max_classes_per_day: 'lower_is_better',
  back_to_back_ratio: 'lower_is_better',
  avg_gap_length: 'lower_is_better',
  utilization: 'higher_is_better',
  room_consistency: 'higher_is_better',
  free_day_ratio: 'higher_is_better',
};

export const getDefaultDirection = (condition: string): MetricDirection | undefined =>
  DIRECTION_BY_CONDITION[condition as RuleCondition];

const DIRECTION_LABELS: Record<MetricDirection, string> = {
  higher_is_better: 'Higher is better',
  lower_is_better: 'Lower is better',
};

export const getDirectionLabel = (direction: MetricDirection): string =>
  DIRECTION_LABELS[direction];

export const getViolationConditionLabel = (violationCondition: string): string =>
  VIOLATION_CONDITION_LABELS[violationCondition] ?? violationCondition;

// The 2 violationCondition values that are institution-parameterized policy
// constraints — the only ones that take a numeric `limit` — as opposed to
// the other 4, which describe physical impossibilities (double-booking,
// capacity) and are never parameterized. Mirrors the backend's
// ConstraintTranslator.isPolicyConstraint.
const LIMIT_VIOLATION_CONDITIONS = new Set(['consecutive_limit', 'gap_limit']);

export const needsLimit = (violationCondition: string): boolean =>
  LIMIT_VIOLATION_CONDITIONS.has(violationCondition);

// Like getViolationConditionLabel, but folds in the constraint's limit for
// the 2 conditions that have one, e.g. "more than 3 consecutive periods"
// instead of the generic "Lecturer teaches more than allowed consecutive
// periods". Falls back to the plain label when limit is absent (e.g. the
// dropdown option list, which has no constraint instance to read a limit
// from) or the condition isn't limit-based.
export const describeViolationCondition = (violationCondition: string, limit?: number): string => {
  if (limit === undefined) return getViolationConditionLabel(violationCondition);
  if (violationCondition === 'consecutive_limit') {
    return `more than ${limit} consecutive period${limit === 1 ? '' : 's'}`;
  }
  if (violationCondition === 'gap_limit') {
    return `gap greater than ${limit} period${limit === 1 ? '' : 's'}`;
  }
  return getViolationConditionLabel(violationCondition);
};

export const TARGET_OPTIONS: readonly { value: RuleTarget; label: string }[] = [
  { value: 'Class', label: 'Classes' },
  { value: 'Professor', label: 'Lecturers' },
  { value: 'Room', label: 'Rooms' },
  { value: 'StudentGroup', label: 'Student Groups' },
];

export const DIRECTION_OPTIONS: readonly { value: MetricDirection; label: string }[] = [
  { value: 'higher_is_better', label: 'Higher is better' },
  { value: 'lower_is_better', label: 'Lower is better' },
];

export const VIOLATION_CONDITION_OPTIONS: readonly { value: string; label: string }[] = [
  { value: 'professor_overlap', label: 'Lecturer teaches two classes at the same time' },
  { value: 'room_double_book', label: 'Room booked for two classes at the same time' },
  { value: 'group_overlap', label: 'Student group in two classes at once' },
  { value: 'consecutive_limit', label: 'Lecturer teaches more than allowed consecutive periods' },
  { value: 'gap_limit', label: 'Gap between a lecturer\'s classes exceeds the allowed maximum' },
  { value: 'room_capacity_exceeded', label: 'Room assigned to a class smaller than the group it holds' },
];
