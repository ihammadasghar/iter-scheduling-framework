import type { IGitHubService } from '../interfaces/IGitHubService.js';
import type { IGraphService } from '../interfaces/IGraphService.js';
import type { ICiPipelineService, RunCiParams } from '../interfaces/ICiPipelineService.js';
import type { CiResult, Conflict } from '../types/domain.js';

const SCHEDULE_JSON_PATH = 'schedule.json';

export class CiPipelineService implements ICiPipelineService {
  constructor(
    private readonly github: IGitHubService,
    private readonly graph: IGraphService,
  ) {}

  async run(params: RunCiParams): Promise<CiResult> {
    const { proposalId, simulationId } = params;
    const ciRunId = `ci-${proposalId}-${Date.now()}`;

    const scheduleJson = await this.github.readFile(simulationId, SCHEDULE_JSON_PATH);
    await this.graph.hydrate(ciRunId, scheduleJson);

    let conflicts: readonly Conflict[] = [];
    try {
      conflicts = await this.graph.queryConflicts(ciRunId);
    } finally {
      await this.graph.flush(ciRunId);
    }

    return {
      status: conflicts.length > 0 ? 'BLOCKED' : 'READY',
      conflicts,
    };
  }
}
