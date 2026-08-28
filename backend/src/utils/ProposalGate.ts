// Shared "is this candidate schedule acceptable against the published
// baseline" logic, used both by ProposalService (the pre-PR submission gate)
// and CiPipelineService (the post-PR ci:ready/ci:blocked decision). Keeping
// this in one place is what keeps those two gates from disagreeing with each
// other — see ProposalService.assertImprovesOnPublished and
// CiPipelineService.run for the two call sites.
import type { IGitHubService } from '../interfaces/IGitHubService.js';
import type { IGraphService } from '../interfaces/IGraphService.js';
import type { Conflict, Constraint, MetricRule, WeightedScoreResult } from '../types/domain.js';

const SCHEDULE_JSON_PATH = 'schedule.json';

export interface ConflictsAndScore {
  readonly conflicts: readonly Conflict[];
  readonly score: WeightedScoreResult;
}

// Hydrates `branch`'s current schedule.json into a scratch graph session
// just long enough to read its conflicts (both the 4 always-on structural
// checks and any institution-authored policy constraints) and weighted
// score, then tears the session down. `constraints` is checked against this
// same branch as `metricRules`/queryConflicts, so baseline and candidate
// stay an apples-to-apples comparison in isProposalAcceptable below —
// otherwise a policy constraint authored after `main` already (invisibly)
// violates it would permanently block every unrelated future proposal.
export async function computeConflictsAndScore(
  github: IGitHubService,
  graph: IGraphService,
  branch: string,
  metricRules: readonly MetricRule[],
  constraints: readonly Constraint[] = [],
): Promise<ConflictsAndScore> {
  const runId = `check-${branch}-${Date.now()}`;
  const scheduleJson = await github.readFile(branch, SCHEDULE_JSON_PATH);

  try {
    await graph.hydrate(runId, scheduleJson);
    const structuralConflicts = await graph.queryConflicts(runId);
    const constraintViolations = await graph.queryConstraintViolations(runId, constraints);
    const score = await graph.scoreTimetable(runId, metricRules);
    return { conflicts: [...structuralConflicts, ...constraintViolations], score };
  } finally {
    await graph.flush(runId);
  }
}

// A candidate is acceptable when it doesn't make the published schedule
// worse: either it strictly reduces hard-constraint conflicts vs. baseline,
// or — when conflicts are unchanged — it changes the weighted metric score
// at all (better or worse; the point is it's a deliberate trade-off, not a
// no-op). Anything else (more conflicts, or an identical no-op) is rejected.
export function isProposalAcceptable(
  baseline: ConflictsAndScore,
  candidate: ConflictsAndScore,
): boolean {
  const conflictsReduced = candidate.conflicts.length < baseline.conflicts.length;
  const conflictsUnchanged = candidate.conflicts.length === baseline.conflicts.length;
  const scoreChanged = candidate.score.score !== baseline.score.score;

  return conflictsReduced || (conflictsUnchanged && scoreChanged);
}
