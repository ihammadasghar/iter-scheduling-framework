import apiClient from './apiClient';
import type { ScheduleClass, PaginatedResponse, ScheduleRoster } from '@/types';

export const scheduleService = {
  // GET /schedule/classes — read-only, paginated view of the currently
  // published (main) schedule. No simulation session involved.
  getPublishedClasses(page: number, limit: number): Promise<PaginatedResponse<ScheduleClass>> {
    return apiClient
      .get<PaginatedResponse<ScheduleClass>>('/schedule/classes', { params: { page, limit } })
      .then((r) => r.data);
  },

  // GET /schedule/roster — master data (rooms/professors/courses/groups/
  // slots) for the published schedule, so IDs can be resolved to real names.
  getPublishedRoster(): Promise<ScheduleRoster> {
    return apiClient
      .get<ScheduleRoster>('/schedule/roster')
      .then((r) => r.data);
  },
};
