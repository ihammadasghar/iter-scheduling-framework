import type { CiResult } from '../types/domain.js';

export interface RunCiParams {
  readonly proposalId: string;
  readonly simulationId: string;
}

export interface ICiPipelineService {
  run(params: RunCiParams): Promise<CiResult>;
}
