import type { IGitHubService } from '../interfaces/IGitHubService.js';
import type { IGraphService } from '../interfaces/IGraphService.js';
import type { IRulesService } from '../interfaces/IRulesService.js';
import type { ICiPipelineService, RunCiParams } from '../interfaces/ICiPipelineService.js';
import { computeConflictsAndScore, isProposalAcceptable } from '../utils/ProposalGate.js';
import type { CiResult, Conflict, WeightedScoreResult } from '../types/domain.js';

const SCHEDULE_JSON_PATH = 'schedule.json';
const SOURCE_BRANCH = 'main';

export class CiPipelineService implements ICiPipelineService {
  constructor(
    private readonly github: IGitHubService,
    private readonly graph: IGraphService,
    private readonly rules: IRulesService,
  ) {}

  async run(params: RunCiParams): Promise<CiResult> {
    const { proposalId, simulationId } = params;
    const metricRules = await this.rules.listMetrics();

    // Re-evaluated against *current* main every run (not just whatever was
    // true when the PR was opened) — CI can be re-triggered later by a
    // fresh push, by which point main may have moved further. Sequential
    // with the candidate hydrate below for the same reason ProposalService
    // keeps its baseline/candidate hydrates sequential: concurrent scratch
    // hydrates against Memgraph have tripped real concurrent-write failures.
    const baseline = await computeConflictsAndScore(this.github, this.graph, SOURCE_BRANCH, metricRules);

    const ciRunId = `ci-${proposalId}-${Date.now()}`;
    const scheduleJson = await this.github.readFile(simulationId, SCHEDULE_JSON_PATH);

    let conflicts: readonly Conflict[] = [];
    let score: WeightedScoreResult = { score: 0, breakdown: [] };
    try {
      await this.graph.hydrate(ciRunId, scheduleJson);
      conflicts = await this.graph.queryConflicts(ciRunId);
      score = await this.graph.scoreTimetable(ciRunId, metricRules);
    } finally {
      await this.graph.flush(ciRunId);
    }

    return {
      // Same rule ProposalService.assertImprovesOnPublished gates PR
      // creation with: not more conflicts than main, and not a no-op when
      // conflicts are unchanged. Keeps this label consistent with the
      // pre-PR gate instead of the old absolute "zero conflicts" check.
      status: isProposalAcceptable(baseline, { conflicts, score }) ? 'READY' : 'BLOCKED',
      conflicts,
      score,
    };
  }
}
