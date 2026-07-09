import apiClient from './apiClient';
import type {
  MetricRule,
  Constraint,
  CreateMetricRuleRequest,
  CreateConstraintRequest,
} from '@/types';

export const rulesService = {
  // GET /rules/metrics — rethrows all errors (including 501) so the slice can set unavailable.
  getMetricRules(): Promise<MetricRule[]> {
    return apiClient
      .get<MetricRule[]>('/rules/metrics')
      .then((r) => r.data);
  },

  createMetricRule(params: CreateMetricRuleRequest): Promise<MetricRule> {
    return apiClient
      .post<MetricRule>('/rules/metrics', params)
      .then((r) => r.data);
  },

  deleteMetricRule(id: string): Promise<void> {
    return apiClient
      .delete<void>(`/rules/metrics/${id}`)
      .then(() => undefined);
  },

  // GET /rules/constraints — rethrows all errors (including 501) so the slice can set unavailable.
  getConstraints(): Promise<Constraint[]> {
    return apiClient
      .get<Constraint[]>('/rules/constraints')
      .then((r) => r.data);
  },

  createConstraint(params: CreateConstraintRequest): Promise<Constraint> {
    return apiClient
      .post<Constraint>('/rules/constraints', params)
      .then((r) => r.data);
  },

  deleteConstraint(id: string): Promise<void> {
    return apiClient
      .delete<void>(`/rules/constraints/${id}`)
      .then(() => undefined);
  },
};
