import type { IGitHubService } from '../interfaces/IGitHubService.js';
import type { IGraphService } from '../interfaces/IGraphService.js';
import type { IRulesService } from '../interfaces/IRulesService.js';
import type { ICiPipelineService, RunCiParams } from '../interfaces/ICiPipelineService.js';
import type { CiResult, Conflict, WeightedScoreResult } from '../types/domain.js';

const SCHEDULE_JSON_PATH = 'schedule.json';

export class CiPipelineService implements ICiPipelineService {
  constructor(
    private readonly github: IGitHubService,
    private readonly graph: IGraphService,
    private readonly rules: IRulesService,
  ) {}

  async run(params: RunCiParams): Promise<CiResult> {
    const { proposalId, simulationId } = params;
    const ciRunId = `ci-${proposalId}-${Date.now()}`;

    const scheduleJson = await this.github.readFile(simulationId, SCHEDULE_JSON_PATH);

    let conflicts: readonly Conflict[] = [];
    let score: WeightedScoreResult = { score: 0, breakdown: [] };
    try {
      await this.graph.hydrate(ciRunId, scheduleJson);
      conflicts = await this.graph.queryConflicts(ciRunId);
      // Institution-defined score is informational alongside the hard-conflict
      // check — it doesn't (yet) affect READY/BLOCKED status.
      const metricRules = await this.rules.listMetrics();
      score = await this.graph.scoreTimetable(ciRunId, metricRules);
    } finally {
      await this.graph.flush(ciRunId);
    }

    return {
      status: conflicts.length > 0 ? 'BLOCKED' : 'READY',
      conflicts,
      score,
    };
  }
}
