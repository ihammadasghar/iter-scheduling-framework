// Shared baseline-vs-candidate hydration, and two deliberately different
// gates built on top of it: isSubmissionWorthwhile (ProposalService's pre-PR
// "not a no-op" check, deliberately loose) and isProposalAcceptable
// (CiPipelineService's post-PR ci:ready/ci:blocked decision, strict and
// identity-based). A candidate can clear the loose gate — opening a PR — and
// still come back BLOCKED once CI looks at which specific conflicts survived;
// that's intentional, not a bug: submission only guards against a literal
// no-op, while CI is the check that actually has to be right about whether a
// real conflict remains.
import type { IGitHubService } from '../interfaces/IGitHubService.js';
import type { IGraphService } from '../interfaces/IGraphService.js';
import type { Conflict, Constraint, MetricRule, WeightedScoreResult } from '../types/domain.js';
import { diffConflictsById } from './ScheduleDiffer.js';

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
// stay an apples-to-apples comparison in the two gates below — otherwise a
// policy constraint authored after `main` already (invisibly) violates it
// would permanently block every unrelated future proposal.
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

// The pre-PR submission gate (ProposalService.assertImprovesOnPublished).
// Deliberately loose: it only rejects a literal no-op — the same conflict
// *count* and the same score as baseline — not every candidate that still
// has a conflict. A candidate that reduces conflict count, or changes the
// score while the count holds level, is worth opening a PR for and letting
// a human review, even though CI's stricter isProposalAcceptable below may
// still label it BLOCKED.
export function isSubmissionWorthwhile(
  baseline: ConflictsAndScore,
  candidate: ConflictsAndScore,
): boolean {
  const conflictsReduced = candidate.conflicts.length < baseline.conflicts.length;
  const conflictsUnchanged = candidate.conflicts.length === baseline.conflicts.length;
  const scoreChanged = candidate.score.score !== baseline.score.score;

  return conflictsReduced || (conflictsUnchanged && scoreChanged);
}

// The post-PR ci:ready/ci:blocked decision (CiPipelineService.run). Strict
// and identity-based (diffConflictsById), not count-based: a candidate is
// only "improved" if it resolves at least one baseline conflict without
// introducing a new one. A conflict that merely survives unchanged — or is
// swapped for a different one while the count happens to stay level — is
// never labelled READY just because the weighted metric score also moved;
// that's what let a candidate still carrying a live room double-booking
// come back READY as long as some unrelated edit nudged the score. The one
// case a score change alone can still make a candidate READY is when
// neither side has any conflicts at all — there a score change is a
// genuine, conflict-free trade-off, not a no-op.
export function isProposalAcceptable(
  baseline: ConflictsAndScore,
  candidate: ConflictsAndScore,
): boolean {
  const delta = diffConflictsById(baseline.conflicts, candidate.conflicts);
  const conflictsImproved = delta.added.length === 0 && delta.resolved.length > 0;
  const noConflictsEitherSide = baseline.conflicts.length === 0 && candidate.conflicts.length === 0;
  const scoreChanged = candidate.score.score !== baseline.score.score;

  return conflictsImproved || (noConflictsEitherSide && scoreChanged);
}
