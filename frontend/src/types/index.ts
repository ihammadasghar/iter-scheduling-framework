// Single re-export barrel for all frontend types.
// Import from '@/types' rather than individual files.

export type {
  Simulation,
  ScheduleClass,
  ConflictType,
  Conflict,
  MetricResult,
  MetricDirection,
  Suggestion,
  RoomAvailability,
  ProposalStatus,
  ProposalRole,
  Proposal,
  ProposalDetail,
  MetricRule,
  Constraint,
  MetricScoreBreakdown,
  WeightedScoreResult,
  CiResult,
  ClassFieldDiff,
  ChangedClass,
  ScheduleDiff,
  ConflictDelta,
  ScheduleComparison,
} from './domain';

export type {
  RawTimeSlot,
  RawRoom,
  RawProfessor,
  RawStudentGroup,
  RawCourse,
  RawClass,
  ScheduleMetadata,
  ScheduleTimeline,
  ExclusionDate,
  ScheduleRoster,
  ScheduleJson,
} from './schedule';

export type {
  PaginatedResponse,
  ApiError,
  CreateSimulationRequest,
  UpdateClassRequest,
  CreateProposalRequest,
  CreateMetricRuleRequest,
  CreateConstraintRequest,
  RebaseResponse,
} from './api';

export type {
  UserRole,
  Identity,
  ViewByOption,
  ClassChipState,
  SimulationCardData,
  FieldChange,
  ClassChange,
  ConflictDisplayItem,
  MetricDelta,
} from './ui';
