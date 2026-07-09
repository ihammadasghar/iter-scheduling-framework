// Pure label-resolution utilities for rule builder UI.
// Maps internal API keys to plain English labels.
// All functions are pure — no side effects, no external dependencies.

export type RuleTarget = 'classes' | 'lecturers' | 'rooms';
export type RuleCondition =
  | 'count'
  | 'avg_classes_per_day'
  | 'max_classes_per_day'
  | 'utilization';

export interface ConditionOption {
  readonly value: RuleCondition;
  readonly label: string;
  readonly unit: string;
}

const TARGET_LABELS: Record<string, string> = {
  classes: 'Classes',
  lecturers: 'Lecturers',
  rooms: 'Rooms',
};

const CONDITION_LABELS: Record<string, string> = {
  count: 'Total number of classes',
  avg_classes_per_day: 'Average classes per lecturer per day',
  max_classes_per_day: 'Maximum classes any lecturer teaches in one day',
  utilization: 'Percentage of rooms in use',
};

const CONDITIONS_BY_TARGET: Record<string, readonly ConditionOption[]> = {
  classes: [
    { value: 'count', label: 'Total number of classes', unit: 'classes' },
  ],
  lecturers: [
    { value: 'avg_classes_per_day', label: 'Average classes per lecturer per day', unit: 'classes/day' },
    { value: 'max_classes_per_day', label: 'Maximum classes any lecturer teaches in one day', unit: 'classes' },
  ],
  rooms: [
    { value: 'utilization', label: 'Percentage of rooms in use', unit: '%' },
  ],
};

const VIOLATION_CONDITION_LABELS: Record<string, string> = {
  professor_overlap: 'Lecturer teaches two classes at the same time',
  room_double_book: 'Room booked for two classes at the same time',
  group_overlap: 'Student group in two classes at once',
  consecutive_limit: 'Lecturer teaches more than allowed consecutive periods',
  gap_limit: 'Gap between a lecturer\'s classes exceeds the allowed maximum',
};

export const getTargetLabel = (target: string): string =>
  TARGET_LABELS[target] ?? target;

export const getConditionLabel = (condition: string): string =>
  CONDITION_LABELS[condition] ?? condition;

export const getConditionsByTarget = (target: string): readonly ConditionOption[] =>
  CONDITIONS_BY_TARGET[target] ?? [];

export const getViolationConditionLabel = (violationCondition: string): string =>
  VIOLATION_CONDITION_LABELS[violationCondition] ?? violationCondition;

export const TARGET_OPTIONS: readonly { value: RuleTarget; label: string }[] = [
  { value: 'classes', label: 'Classes' },
  { value: 'lecturers', label: 'Lecturers' },
  { value: 'rooms', label: 'Rooms' },
];

export const VIOLATION_CONDITION_OPTIONS: readonly { value: string; label: string }[] = [
  { value: 'professor_overlap', label: 'Lecturer teaches two classes at the same time' },
  { value: 'room_double_book', label: 'Room booked for two classes at the same time' },
  { value: 'group_overlap', label: 'Student group in two classes at once' },
  { value: 'consecutive_limit', label: 'Lecturer teaches more than allowed consecutive periods' },
  { value: 'gap_limit', label: 'Gap between a lecturer\'s classes exceeds the allowed maximum' },
];
