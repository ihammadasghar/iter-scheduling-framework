import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockInstance } from 'vitest';
import type { AxiosResponse } from 'axios';
import apiClient from './apiClient';
import { simulationService } from './simulationService';
import type { Simulation, ScheduleClass, Conflict, MetricResult, Suggestion, ApiError } from '@/types';

// Helper to build a minimal Axios response wrapper
const axiosOk = <T>(data: T): Promise<AxiosResponse<T>> =>
  Promise.resolve({ data, status: 200, statusText: 'OK', headers: {}, config: {} as never });

const fakeSimulation: Simulation = {
  id: 'sim-alice-a1b2c3d4',
  branchId: 'sim-alice-a1b2c3d4',
  createdAt: '2026-06-11T10:00:00Z',
};

const fakeClass: ScheduleClass = {
  id: 'CLS_00001',
  courseId: 'CRS_BIO101',
  title: 'Intro to Biology',
  professorId: 'PRF_SMITH',
  studentGroupId: 'GRP_BIO_Y1',
  roomId: 'RM_101',
  timeSlotIds: ['TS_MON_P1'],
};

describe('simulationService', () => {
  let postSpy: MockInstance;
  let getSpy: MockInstance;
  let patchSpy: MockInstance;
  let deleteSpy: MockInstance;

  beforeEach(() => {
    postSpy = vi.spyOn(apiClient, 'post');
    getSpy = vi.spyOn(apiClient, 'get');
    patchSpy = vi.spyOn(apiClient, 'patch');
    deleteSpy = vi.spyOn(apiClient, 'delete');
  });

  it('createSimulation calls POST /simulations with userId', async () => {
    postSpy.mockReturnValue(axiosOk(fakeSimulation));
    const result = await simulationService.createSimulation('alice');
    expect(postSpy).toHaveBeenCalledWith('/simulations', { userId: 'alice' });
    expect(result.id).toBe('sim-alice-a1b2c3d4');
  });

  it('getSimulationClasses calls GET with correct page params', async () => {
    const page = { data: [fakeClass], total: 1, page: 1, limit: 20 };
    getSpy.mockReturnValue(axiosOk(page));
    const result = await simulationService.getSimulationClasses('sim-1', 1, 20);
    expect(getSpy).toHaveBeenCalledWith('/simulations/sim-1/classes', { params: { page: 1, limit: 20 } });
    expect(result.data).toHaveLength(1);
  });

  it('updateClass calls PATCH with params', async () => {
    patchSpy.mockReturnValue(axiosOk({ ...fakeClass, roomId: 'RM_102' }));
    const result = await simulationService.updateClass('sim-1', 'CLS_00001', { roomId: 'RM_102' });
    expect(patchSpy).toHaveBeenCalledWith(
      '/simulations/sim-1/classes/CLS_00001',
      { roomId: 'RM_102' },
    );
    expect(result.roomId).toBe('RM_102');
  });

  it('getClassSuggestions calls GET suggestions endpoint', async () => {
    const suggestions: Suggestion[] = [{ roomId: 'RM_102', timeSlotIds: ['TS_WED_P1'], conflictFree: true }];
    getSpy.mockReturnValue(axiosOk(suggestions));
    const result = await simulationService.getClassSuggestions('sim-1', 'CLS_00001');
    expect(getSpy).toHaveBeenCalledWith('/simulations/sim-1/classes/CLS_00001/suggestions');
    expect(result).toHaveLength(1);
  });

  it('getConflicts returns an array of conflicts', async () => {
    const conflicts: Conflict[] = [{
      id: 'c1',
      type: 'ROOM_DOUBLE_BOOK',
      classIds: ['CLS_00001', 'CLS_00002'],
      message: 'Room overlap',
    }];
    getSpy.mockReturnValue(axiosOk(conflicts));
    const result = await simulationService.getConflicts('sim-1');
    expect(result[0].type).toBe('ROOM_DOUBLE_BOOK');
  });

  it('getMetrics returns an array of metric results', async () => {
    const metrics: MetricResult[] = [{ name: 'Room Utilization', value: 73.4, unit: '%' }];
    getSpy.mockReturnValue(axiosOk(metrics));
    const result = await simulationService.getMetrics('sim-1');
    expect(result[0].name).toBe('Room Utilization');
  });

  it('commitSimulation calls POST commit and resolves void', async () => {
    postSpy.mockReturnValue(axiosOk(null));
    await expect(simulationService.commitSimulation('sim-1')).resolves.toBeUndefined();
    expect(postSpy).toHaveBeenCalledWith('/simulations/sim-1/commit');
  });

  it('sendHeartbeat calls POST heartbeat and resolves void', async () => {
    postSpy.mockReturnValue(axiosOk(null));
    await expect(simulationService.sendHeartbeat('sim-1')).resolves.toBeUndefined();
    expect(postSpy).toHaveBeenCalledWith('/simulations/sim-1/heartbeat');
  });

  it('deleteSimulation silently ignores 404 (Gap 4)', async () => {
    const gap4Error: ApiError = { statusCode: 404, code: 'NOT_FOUND', message: 'Not found' };
    deleteSpy.mockRejectedValue(gap4Error);
    await expect(simulationService.deleteSimulation('sim-1')).resolves.toBeUndefined();
  });

  it('deleteSimulation silently ignores 405 (Gap 4)', async () => {
    const gap4Error: ApiError = { statusCode: 405, code: 'METHOD_NOT_ALLOWED', message: 'Not allowed' };
    deleteSpy.mockRejectedValue(gap4Error);
    await expect(simulationService.deleteSimulation('sim-1')).resolves.toBeUndefined();
  });

  it('deleteSimulation rethrows non-gap errors', async () => {
    const serverError: ApiError = { statusCode: 500, code: 'INTERNAL_SERVER_ERROR', message: 'Boom' };
    deleteSpy.mockRejectedValue(serverError);
    await expect(simulationService.deleteSimulation('sim-1')).rejects.toMatchObject({ statusCode: 500 });
  });
});
