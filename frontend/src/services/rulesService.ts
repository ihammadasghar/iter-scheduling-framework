import apiClient from './apiClient';
import type {
  MetricRule,
  Constraint,
  CreateMetricRuleRequest,
  CreateConstraintRequest,
  ApiError,
} from '@/types';

// Returns true for any response that indicates the rules service is unavailable.
const isUnavailable = (err: ApiError): boolean =>
  err.statusCode === 501 || err.statusCode === 404 || err.statusCode === 405;

export const rulesService = {
  // GET /rules/metrics — returns empty array on 501 (service not yet implemented).
  getMetricRules(): Promise<MetricRule[]> {
    return apiClient
      .get<MetricRule[]>('/rules/metrics')
      .then((r) => r.data)
      .catch((err: ApiError) => {
        if (isUnavailable(err)) return [];
        throw err;
      });
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

  // GET /rules/constraints — returns empty array on 501.
  getConstraints(): Promise<Constraint[]> {
    return apiClient
      .get<Constraint[]>('/rules/constraints')
      .then((r) => r.data)
      .catch((err: ApiError) => {
        if (isUnavailable(err)) return [];
        throw err;
      });
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
