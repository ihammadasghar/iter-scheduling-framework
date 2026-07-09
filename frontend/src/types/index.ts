// Single re-export barrel for all frontend types.
// Import from '@/types' rather than individual files.

export type {
  Simulation,
  ScheduleClass,
  ConflictType,
  Conflict,
  MetricResult,
  Suggestion,
  ProposalStatus,
  Proposal,
  ProposalDetail,
  MetricRule,
  Constraint,
  CiResult,
} from './domain';

export type {
  RawTimeSlot,
  RawRoom,
  RawProfessor,
  RawStudentGroup,
  RawCourse,
  RawClass,
  ScheduleMetadata,
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
} from './api';

export type {
  UserRole,
  ViewByOption,
  ClassChipState,
  SimulationCardData,
  FieldChange,
  ClassChange,
  ConflictDisplayItem,
  MetricDelta,
} from './ui';
