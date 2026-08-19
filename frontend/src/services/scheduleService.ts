import apiClient from './apiClient';
import type { ScheduleClass, PaginatedResponse } from '@/types';

export const scheduleService = {
  // GET /schedule/classes — read-only, paginated view of the currently
  // published (main) schedule. No simulation session involved.
  getPublishedClasses(page: number, limit: number): Promise<PaginatedResponse<ScheduleClass>> {
    return apiClient
      .get<PaginatedResponse<ScheduleClass>>('/schedule/classes', { params: { page, limit } })
      .then((r) => r.data);
  },
};
