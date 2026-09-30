import type { IGitHubService } from '../interfaces/IGitHubService.js';
import type { IGraphService } from '../interfaces/IGraphService.js';
import type { IRulesService } from '../interfaces/IRulesService.js';
import type { ICiPipelineService, RunCiParams } from '../interfaces/ICiPipelineService.js';
import { computeConflictsAndScore, isProposalAcceptable } from '../utils/ProposalGate.js';
import { isPolicyConstraint } from '../utils/ConstraintTranslator.js';
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
    // Only consecutive_limit/gap_limit are wired up as CI-gating policy
    // constraints (see ConstraintTranslator.ts) — the other 4
    // violationCondition values describe physical impossibilities already
    // covered unconditionally by queryConflicts's structural checks.
    const policyConstraints = (await this.rules.listConstraints()).filter((c) =>
      isPolicyConstraint(c.violationCondition),
    );

    // Re-evaluated against *current* main every run (not just whatever was
    // true when the PR was opened) — CI can be re-triggered later by a
    // fresh push, by which point main may have moved further. Sequential
    // with the candidate hydrate below for the same reason ProposalService
    // keeps its baseline/candidate hydrates sequential: concurrent scratch
    // hydrates against Memgraph have tripped real concurrent-write failures.
    const baseline = await computeConflictsAndScore(
      this.github,
      this.graph,
      SOURCE_BRANCH,
      metricRules,
      policyConstraints,
    );

    const ciRunId = `ci-${proposalId}-${Date.now()}`;
    const scheduleJson = await this.github.readFile(simulationId, SCHEDULE_JSON_PATH);

    let conflicts: readonly Conflict[] = [];
    let score: WeightedScoreResult = { score: 0, breakdown: [] };
    try {
      await this.graph.hydrate(ciRunId, scheduleJson);
      const structuralConflicts = await this.graph.queryConflicts(ciRunId);
      const constraintViolations = await this.graph.queryConstraintViolations(ciRunId, policyConstraints);
      conflicts = [...structuralConflicts, ...constraintViolations];
      score = await this.graph.scoreTimetable(ciRunId, metricRules);
    } finally {
      await this.graph.flush(ciRunId);
    }

    return {
      // Stricter than ProposalService.assertImprovesOnPublished's pre-PR
      // "not a no-op" gate: identity-based, not count-based, so a candidate
      // that reaches CI still carrying a conflict it never actually
      // resolved is BLOCKED even if an unrelated score change was enough to
      // clear the looser submission gate. See ProposalGate.ts for both
      // rules side by side.
      status: isProposalAcceptable(baseline, { conflicts, score }) ? 'READY' : 'BLOCKED',
      conflicts,
      score,
    };
  }
}
