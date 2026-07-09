// API request and response shapes for all backend endpoints.

// --- Generic ---

export interface PaginatedResponse<T> {
  readonly data: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
}

export interface ApiError {
  readonly statusCode: number;
  readonly code: string;
  readonly message: string;
}

// --- Simulations ---

export interface CreateSimulationRequest {
  readonly userId: string;
}

export interface UpdateClassRequest {
  readonly roomId?: string;
  readonly professorId?: string;
  readonly timeSlotIds?: readonly string[];
}

// --- Proposals ---

export interface CreateProposalRequest {
  readonly simulationId: string;
  readonly description: string;
}

// --- Rules ---

export interface CreateMetricRuleRequest {
  readonly name: string;
  readonly target: string;
  readonly condition: string;
  readonly threshold: number;
}

export interface CreateConstraintRequest {
  readonly name: string;
  readonly target: string;
  readonly violationCondition: string;
}
