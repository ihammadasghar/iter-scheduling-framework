import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockInstance } from 'vitest';
import type { AxiosResponse } from 'axios';
import apiClient from './apiClient';
import { rulesService } from './rulesService';
import type { MetricRule, Constraint, ApiError } from '@/types';

const axiosOk = <T>(data: T): Promise<AxiosResponse<T>> =>
  Promise.resolve({ data, status: 200, statusText: 'OK', headers: {}, config: {} as never });

const fakeMetricRule: MetricRule = {
  id: 'metric-001',
  name: 'Room Utilization',
  target: 'Room',
  condition: 'utilization',
  threshold: 80,
};

const fakeConstraint: Constraint = {
  id: 'con-001',
  name: 'Max Professor Load',
  target: 'Professor',
  violationCondition: 'max_classes_per_day > 6',
};

describe('rulesService', () => {
  let getSpy: MockInstance;
  let postSpy: MockInstance;
  let deleteSpy: MockInstance;

  beforeEach(() => {
    getSpy = vi.spyOn(apiClient, 'get');
    postSpy = vi.spyOn(apiClient, 'post');
    deleteSpy = vi.spyOn(apiClient, 'delete');
  });

  it('getMetricRules returns rules on success', async () => {
    getSpy.mockReturnValue(axiosOk([fakeMetricRule]));
    const result = await rulesService.getMetricRules();
    expect(result).toHaveLength(1);
    expect(result[0].condition).toBe('utilization');
  });

  it('getMetricRules returns empty array on 501 (Gap 1)', async () => {
    const gap1Error: ApiError = { statusCode: 501, code: 'NOT_IMPLEMENTED', message: 'Not impl' };
    getSpy.mockRejectedValue(gap1Error);
    const result = await rulesService.getMetricRules();
    expect(result).toEqual([]);
  });

  it('getMetricRules returns empty array on 404', async () => {
    const notFound: ApiError = { statusCode: 404, code: 'NOT_FOUND', message: 'Not found' };
    getSpy.mockRejectedValue(notFound);
    const result = await rulesService.getMetricRules();
    expect(result).toEqual([]);
  });

  it('getMetricRules rethrows non-gap errors', async () => {
    const serverError: ApiError = { statusCode: 500, code: 'INTERNAL_SERVER_ERROR', message: 'Boom' };
    getSpy.mockRejectedValue(serverError);
    await expect(rulesService.getMetricRules()).rejects.toMatchObject({ statusCode: 500 });
  });

  it('createMetricRule calls POST /rules/metrics', async () => {
    postSpy.mockReturnValue(axiosOk(fakeMetricRule));
    const result = await rulesService.createMetricRule({
      name: 'Room Utilization',
      target: 'Room',
      condition: 'utilization',
      threshold: 80,
    });
    expect(postSpy).toHaveBeenCalledWith('/rules/metrics', expect.objectContaining({ name: 'Room Utilization' }));
    expect(result.id).toBe('metric-001');
  });

  it('deleteMetricRule calls DELETE /rules/metrics/:id', async () => {
    deleteSpy.mockReturnValue(axiosOk(null));
    await expect(rulesService.deleteMetricRule('metric-001')).resolves.toBeUndefined();
    expect(deleteSpy).toHaveBeenCalledWith('/rules/metrics/metric-001');
  });

  it('getConstraints returns constraints on success', async () => {
    getSpy.mockReturnValue(axiosOk([fakeConstraint]));
    const result = await rulesService.getConstraints();
    expect(result[0].violationCondition).toBeTruthy();
  });

  it('getConstraints returns empty array on 501', async () => {
    const gap1Error: ApiError = { statusCode: 501, code: 'NOT_IMPLEMENTED', message: 'Not impl' };
    getSpy.mockRejectedValue(gap1Error);
    const result = await rulesService.getConstraints();
    expect(result).toEqual([]);
  });

  it('createConstraint calls POST /rules/constraints', async () => {
    postSpy.mockReturnValue(axiosOk(fakeConstraint));
    const result = await rulesService.createConstraint({
      name: 'Max Professor Load',
      target: 'Professor',
      violationCondition: 'max_classes_per_day > 6',
    });
    expect(postSpy).toHaveBeenCalledWith('/rules/constraints', expect.objectContaining({ name: 'Max Professor Load' }));
    expect(result.id).toBe('con-001');
  });

  it('deleteConstraint calls DELETE /rules/constraints/:id', async () => {
    deleteSpy.mockReturnValue(axiosOk(null));
    await expect(rulesService.deleteConstraint('con-001')).resolves.toBeUndefined();
    expect(deleteSpy).toHaveBeenCalledWith('/rules/constraints/con-001');
  });
});
