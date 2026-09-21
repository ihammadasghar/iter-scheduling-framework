import apiClient from './apiClient';
import type {
  Simulation,
  ScheduleClass,
  Conflict,
  MetricResult,
  Suggestion,
  RoomAvailability,
  PaginatedResponse,
  UpdateClassRequest,
  WeightedScoreResult,
  ApiError,
  ScheduleJson,
  RebaseResponse,
  ScheduleDiff,
} from '@/types';

export interface PreviewClassUpdateResponse {
  readonly metrics: MetricResult[];
  readonly score: WeightedScoreResult;
}

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

  getRoomAvailability(simId: string, classId: string): Promise<RoomAvailability[]> {
    return apiClient
      .get<RoomAvailability[]>(`/simulations/${simId}/classes/${classId}/room-availability`)
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

  getScore(simId: string): Promise<WeightedScoreResult> {
    return apiClient
      .get<WeightedScoreResult>(`/simulations/${simId}/score`)
      .then((r) => r.data);
  },

  // Dry-run: evaluates metrics/score against a candidate patch without
  // committing it — used to preview a suggestion's impact before applying it.
  previewClassUpdate(
    simId: string,
    classId: string,
    params: UpdateClassRequest,
  ): Promise<PreviewClassUpdateResponse> {
    return apiClient
      .post<PreviewClassUpdateResponse>(`/simulations/${simId}/classes/${classId}/preview`, params)
      .then((r) => r.data);
  },

  getSchedule(simId: string): Promise<ScheduleJson> {
    return apiClient
      .get<ScheduleJson>(`/simulations/${simId}/schedule`)
      .then((r) => r.data);
  },

  getDiff(simId: string): Promise<ScheduleDiff> {
    return apiClient
      .get<ScheduleDiff>(`/simulations/${simId}/diff`)
      .then((r) => r.data);
  },

  commitSimulation(simId: string): Promise<void> {
    return apiClient
      .post<void>(`/simulations/${simId}/commit`)
      .then(() => undefined);
  },

  // Updates a stale draft to reflect the latest published schedule while
  // preserving the user's own edits. Returns the new baseScheduleVersion so
  // the caller can update its stored copy before submitting again.
  rebaseSimulation(simId: string, baseScheduleVersion: string): Promise<RebaseResponse> {
    return apiClient
      .post<RebaseResponse>(`/simulations/${simId}/rebase`, { baseScheduleVersion })
      .then((r) => r.data);
  },

  sendHeartbeat(simId: string): Promise<void> {
    return apiClient
      .post<void>(`/simulations/${simId}/heartbeat`)
      .then(() => undefined);
  },

  // Deleting an already-gone simulation is treated as success (idempotent).
  deleteSimulation(simId: string): Promise<void> {
    return apiClient
      .delete<void>(`/simulations/${simId}`)
      .then(() => undefined)
      .catch((err: ApiError) => {
        if (isNotFound(err)) return;
        throw err;
      });
  },
};
