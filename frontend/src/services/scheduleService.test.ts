import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockInstance } from 'vitest';
import type { AxiosResponse } from 'axios';
import apiClient from './apiClient';
import { scheduleService } from './scheduleService';
import type { ScheduleClass } from '@/types';

const axiosOk = <T>(data: T): Promise<AxiosResponse<T>> =>
  Promise.resolve({ data, status: 200, statusText: 'OK', headers: {}, config: {} as never });

const fakeClass: ScheduleClass = {
  id: 'CLS_00001',
  courseId: 'CRS_BIO101',
  title: 'Intro to Biology',
  professorId: 'PRF_SMITH',
  studentGroupId: 'GRP_BIO_Y1',
  roomId: 'RM_101',
  timeSlotIds: ['TS_MON_P1'],
};

describe('scheduleService', () => {
  let getSpy: MockInstance;

  beforeEach(() => {
    getSpy = vi.spyOn(apiClient, 'get');
  });

  it('getPublishedClasses calls GET /schedule/classes with page/limit params', async () => {
    getSpy.mockReturnValue(axiosOk({ data: [fakeClass], total: 1, page: 1, limit: 50 }));

    const result = await scheduleService.getPublishedClasses(1, 50);

    expect(getSpy).toHaveBeenCalledWith('/schedule/classes', { params: { page: 1, limit: 50 } });
    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
  });
});
