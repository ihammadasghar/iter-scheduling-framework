// Pure label-resolution utilities for rule builder UI.
// Maps internal API keys to plain-language labels via react-intl.
// All functions are pure — no side effects, no external dependencies beyond
// the `intl: IntlShape` passed in explicitly (these are plain functions, not
// hooks, since they're called from other pure utilities as well as
// components — see AddMetricDialog.tsx/MetricRuleCard.tsx for call sites).
//
// NOTE: `RuleTarget` values must match the backend's MetricRuleTranslator
// catalog keys exactly (backend/src/utils/MetricRuleTranslator.ts) — these
// are sent verbatim as the `target` field of a metric rule, and evaluation
// 400s if they don't match one of the backend's `target:condition` pairs.

import { defineMessages, type IntlShape } from 'react-intl';
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

const targetMessages = defineMessages({
  Class: { id: 'ruleLabels.target.class', defaultMessage: 'Classes' },
  Professor: { id: 'ruleLabels.target.professor', defaultMessage: 'Professors' },
  Room: { id: 'ruleLabels.target.room', defaultMessage: 'Rooms' },
  StudentGroup: { id: 'ruleLabels.target.studentGroup', defaultMessage: 'Student Groups' },
});

const conditionMessages = defineMessages({
  count: { id: 'ruleLabels.condition.count', defaultMessage: 'Total number of classes' },
  avg_classes_per_day: { id: 'ruleLabels.condition.avgClassesPerDay', defaultMessage: 'Average classes per professor per day' },
  max_classes_per_day: { id: 'ruleLabels.condition.maxClassesPerDay', defaultMessage: 'Maximum classes any professor teaches in one day' },
  utilization: { id: 'ruleLabels.condition.utilization', defaultMessage: 'Percentage of rooms in use' },
  back_to_back_ratio: { id: 'ruleLabels.condition.backToBackRatio', defaultMessage: "Share of a professor's classes scheduled back-to-back" },
  room_consistency: { id: 'ruleLabels.condition.roomConsistency', defaultMessage: "Share of a professor's classes held in their most-used room" },
  free_day_ratio: { id: 'ruleLabels.condition.freeDayRatio', defaultMessage: 'Share of student groups with at least one free day' },
  avg_gap_length: { id: 'ruleLabels.condition.avgGapLength', defaultMessage: "Average idle gap between a professor's classes" },
});

const unitMessages = defineMessages({
  classes: { id: 'ruleLabels.unit.classes', defaultMessage: 'classes' },
  classesPerDay: { id: 'ruleLabels.unit.classesPerDay', defaultMessage: 'classes/day' },
  percent: { id: 'ruleLabels.unit.percent', defaultMessage: '%' },
  slots: { id: 'ruleLabels.unit.slots', defaultMessage: 'slots' },
});

const violationMessages = defineMessages({
  professor_overlap: { id: 'ruleLabels.violation.professorOverlap', defaultMessage: 'Professor teaches two classes at the same time' },
  room_double_book: { id: 'ruleLabels.violation.roomDoubleBook', defaultMessage: 'Room booked for two classes at the same time' },
  group_overlap: { id: 'ruleLabels.violation.groupOverlap', defaultMessage: 'Student group in two classes at once' },
  consecutive_limit: { id: 'ruleLabels.violation.consecutiveLimit', defaultMessage: 'Professor teaches more than allowed consecutive periods' },
  gap_limit: { id: 'ruleLabels.violation.gapLimit', defaultMessage: "Gap between a professor's classes exceeds the allowed maximum" },
  room_capacity_exceeded: { id: 'ruleLabels.violation.roomCapacityExceeded', defaultMessage: 'Room assigned to a class smaller than the group it holds' },
});

const directionMessages = defineMessages({
  higher_is_better: { id: 'ruleLabels.direction.higherIsBetter', defaultMessage: 'Higher is better' },
  lower_is_better: { id: 'ruleLabels.direction.lowerIsBetter', defaultMessage: 'Lower is better' },
});

// Shared by WeightedScoreChip and ScheduleQualityCard, which both explain
// the same Institutional Preference Score to the user — kept in one place
// so the two surfaces can't drift apart.
const scoreMessages = defineMessages({
  explainer: {
    id: 'ruleLabels.score.explainer',
    defaultMessage: 'How well this schedule matches your institutional preferences, from 0–100. 100 means every preference is exactly met; it drops as the schedule drifts from those goals.',
  },
});

export const getScoreExplainer = (intl: IntlShape): string =>
  intl.formatMessage(scoreMessages.explainer);

const describeMessages = defineMessages({
  consecutiveLimit: {
    id: 'ruleLabels.describe.consecutiveLimit',
    defaultMessage: '{limit, plural, one {more than # consecutive period} other {more than # consecutive periods}}',
  },
  gapLimit: {
    id: 'ruleLabels.describe.gapLimit',
    defaultMessage: '{limit, plural, one {gap greater than # period} other {gap greater than # periods}}',
  },
});

export const getTargetLabel = (intl: IntlShape, target: string): string =>
  target in targetMessages ? intl.formatMessage(targetMessages[target as RuleTarget]) : target;

export const getConditionLabel = (intl: IntlShape, condition: string): string =>
  condition in conditionMessages ? intl.formatMessage(conditionMessages[condition as RuleCondition]) : condition;

export const getConditionsByTarget = (intl: IntlShape, target: string): readonly ConditionOption[] => {
  const table: Record<string, readonly ConditionOption[]> = {
    Class: [
      { value: 'count', label: intl.formatMessage(conditionMessages.count), unit: intl.formatMessage(unitMessages.classes) },
    ],
    Professor: [
      { value: 'avg_classes_per_day', label: intl.formatMessage(conditionMessages.avg_classes_per_day), unit: intl.formatMessage(unitMessages.classesPerDay) },
      { value: 'max_classes_per_day', label: intl.formatMessage(conditionMessages.max_classes_per_day), unit: intl.formatMessage(unitMessages.classes) },
      { value: 'back_to_back_ratio', label: intl.formatMessage(conditionMessages.back_to_back_ratio), unit: intl.formatMessage(unitMessages.percent) },
      { value: 'room_consistency', label: intl.formatMessage(conditionMessages.room_consistency), unit: intl.formatMessage(unitMessages.percent) },
      { value: 'avg_gap_length', label: intl.formatMessage(conditionMessages.avg_gap_length), unit: intl.formatMessage(unitMessages.slots) },
    ],
    Room: [
      { value: 'utilization', label: intl.formatMessage(conditionMessages.utilization), unit: intl.formatMessage(unitMessages.percent) },
    ],
    StudentGroup: [
      { value: 'free_day_ratio', label: intl.formatMessage(conditionMessages.free_day_ratio), unit: intl.formatMessage(unitMessages.percent) },
    ],
  };
  return table[target] ?? [];
};

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

export const getDirectionLabel = (intl: IntlShape, direction: MetricDirection): string =>
  intl.formatMessage(directionMessages[direction]);

export const getViolationConditionLabel = (intl: IntlShape, violationCondition: string): string =>
  violationCondition in violationMessages
    ? intl.formatMessage(violationMessages[violationCondition as keyof typeof violationMessages])
    : violationCondition;

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
// instead of the generic "Professor teaches more than allowed consecutive
// periods". Falls back to the plain label when limit is absent (e.g. the
// dropdown option list, which has no constraint instance to read a limit
// from) or the condition isn't limit-based.
export const describeViolationCondition = (intl: IntlShape, violationCondition: string, limit?: number): string => {
  if (limit === undefined) return getViolationConditionLabel(intl, violationCondition);
  if (violationCondition === 'consecutive_limit') {
    return intl.formatMessage(describeMessages.consecutiveLimit, { limit });
  }
  if (violationCondition === 'gap_limit') {
    return intl.formatMessage(describeMessages.gapLimit, { limit });
  }
  return getViolationConditionLabel(intl, violationCondition);
};

export const getTargetOptions = (intl: IntlShape): readonly { value: RuleTarget; label: string }[] => [
  { value: 'Class', label: intl.formatMessage(targetMessages.Class) },
  { value: 'Professor', label: intl.formatMessage(targetMessages.Professor) },
  { value: 'Room', label: intl.formatMessage(targetMessages.Room) },
  { value: 'StudentGroup', label: intl.formatMessage(targetMessages.StudentGroup) },
];

export const getDirectionOptions = (intl: IntlShape): readonly { value: MetricDirection; label: string }[] => [
  { value: 'higher_is_better', label: intl.formatMessage(directionMessages.higher_is_better) },
  { value: 'lower_is_better', label: intl.formatMessage(directionMessages.lower_is_better) },
];

export const getViolationConditionOptions = (intl: IntlShape): readonly { value: string; label: string }[] => [
  { value: 'professor_overlap', label: intl.formatMessage(violationMessages.professor_overlap) },
  { value: 'room_double_book', label: intl.formatMessage(violationMessages.room_double_book) },
  { value: 'group_overlap', label: intl.formatMessage(violationMessages.group_overlap) },
  { value: 'consecutive_limit', label: intl.formatMessage(violationMessages.consecutive_limit) },
  { value: 'gap_limit', label: intl.formatMessage(violationMessages.gap_limit) },
  { value: 'room_capacity_exceeded', label: intl.formatMessage(violationMessages.room_capacity_exceeded) },
];
