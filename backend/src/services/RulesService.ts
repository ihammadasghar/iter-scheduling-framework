import { ApiError } from '../types/ApiError.js';
import type { IRulesService } from '../interfaces/IRulesService.js';
import type {
  MetricRule,
  CreateMetricRuleParams,
  Constraint,
  CreateConstraintParams,
} from '../types/domain.js';

export class RulesService implements IRulesService {
  async listMetrics(): Promise<readonly MetricRule[]> {
    throw ApiError.notImplemented();
  }

  async createMetric(_params: CreateMetricRuleParams): Promise<MetricRule> {
    throw ApiError.notImplemented();
  }

  async deleteMetric(_metricId: string): Promise<void> {
    throw ApiError.notImplemented();
  }

  async listConstraints(): Promise<readonly Constraint[]> {
    throw ApiError.notImplemented();
  }

  async createConstraint(_params: CreateConstraintParams): Promise<Constraint> {
    throw ApiError.notImplemented();
  }

  async deleteConstraint(_constraintId: string): Promise<void> {
    throw ApiError.notImplemented();
  }
}
