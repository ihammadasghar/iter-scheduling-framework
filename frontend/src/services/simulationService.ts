import apiClient from './apiClient';
import type {
  Simulation,
  ScheduleClass,
  Conflict,
  MetricResult,
  Suggestion,
  PaginatedResponse,
  UpdateClassRequest,
  ApiError,
} from '@/types';

// Returns true when an ApiError represents a "not found / gone" response.
const isNotFound = (err: ApiError): boolean => err.statusCode === 404;

export const simulationService = {
  createSimulation(userId: string): Promise<Simulation> {
    return apiClient
      .post<Simulation>('/simulations', { userId })
      .then((r) => r.data);
  },

  getSimulationClasses(
    simId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedResponse<ScheduleClass>> {
    return apiClient
      .get<PaginatedResponse<ScheduleClass>>(
        `/simulations/${simId}/classes`,
        { params: { page, limit } },
      )
      .then((r) => r.data);
  },

  updateClass(
    simId: string,
    classId: string,
    params: UpdateClassRequest,
  ): Promise<ScheduleClass> {
    return apiClient
      .patch<ScheduleClass>(`/simulations/${simId}/classes/${classId}`, params)
      .then((r) => r.data);
  },

  getClassSuggestions(simId: string, classId: string): Promise<Suggestion[]> {
    return apiClient
      .get<Suggestion[]>(`/simulations/${simId}/classes/${classId}/suggestions`)
      .then((r) => r.data);
  },

  getConflicts(simId: string): Promise<Conflict[]> {
    return apiClient
      .get<Conflict[]>(`/simulations/${simId}/conflicts`)
      .then((r) => r.data);
  },

  getMetrics(simId: string): Promise<MetricResult[]> {
    return apiClient
      .get<MetricResult[]>(`/simulations/${simId}/metrics`)
      .then((r) => r.data);
  },

  commitSimulation(simId: string): Promise<void> {
    return apiClient
      .post<void>(`/simulations/${simId}/commit`)
      .then(() => undefined);
  },

  sendHeartbeat(simId: string): Promise<void> {
    return apiClient
      .post<void>(`/simulations/${simId}/heartbeat`)
      .then(() => undefined);
  },

  // Gap 4 — DELETE /simulations/:id not yet implemented.
  // Returns silently on 404/405; rethrows all other errors.
  deleteSimulation(simId: string): Promise<void> {
    return apiClient
      .delete<void>(`/simulations/${simId}`)
      .then(() => undefined)
      .catch((err: ApiError) => {
        if (isNotFound(err) || err.statusCode === 405) return;
        throw err;
      });
  },
};
