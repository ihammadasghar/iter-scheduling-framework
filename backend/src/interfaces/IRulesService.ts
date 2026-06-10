import type {
  MetricRule,
  CreateMetricRuleParams,
  Constraint,
  CreateConstraintParams,
} from '../types/domain.js';

export interface IRulesService {
  listMetrics(): Promise<readonly MetricRule[]>;
  createMetric(params: CreateMetricRuleParams): Promise<MetricRule>;
  deleteMetric(metricId: string): Promise<void>;
  listConstraints(): Promise<readonly Constraint[]>;
  createConstraint(params: CreateConstraintParams): Promise<Constraint>;
  deleteConstraint(constraintId: string): Promise<void>;
}
