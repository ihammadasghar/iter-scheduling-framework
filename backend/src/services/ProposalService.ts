import { ApiError } from '../types/ApiError.js';
import type { IGitHubService } from '../interfaces/IGitHubService.js';
import type { IGraphService } from '../interfaces/IGraphService.js';
import type { ICiPipelineService } from '../interfaces/ICiPipelineService.js';
import type { IProposalService } from '../interfaces/IProposalService.js';
import type { IRulesService } from '../interfaces/IRulesService.js';
import { parseScheduleJson } from '../utils/ScheduleHydrator.js';
import { diffConflictsById, diffSchedules } from '../utils/ScheduleDiffer.js';
import type {
  Proposal,
  ProposalDetail,
  CreateProposalParams,
  WeightedScoreResult,
  ScheduleComparison,
  Conflict,
  MetricRule,
} from '../types/domain.js';

const CI_LABEL_READY = 'ci:ready';
const CI_LABEL_BLOCKED = 'ci:blocked';
const SCHEDULE_JSON_PATH = 'schedule.json';
const SOURCE_BRANCH = 'main';

type ProposalListStatus = 'ready' | 'blocked' | 'all';
const VALID_LIST_STATUSES: readonly ProposalListStatus[] = ['ready', 'blocked', 'all'];

export class ProposalService implements IProposalService {
  constructor(
    private readonly github: IGitHubService,
    private readonly graph: IGraphService,
    private readonly ciPipeline: ICiPipelineService,
    private readonly rulesService: IRulesService,
  ) {}

  async submit(params: CreateProposalParams): Promise<Proposal> {
    const { simulationId, description } = params;

    if (!simulationId || simulationId.trim() === '') {
      throw ApiError.badRequest('simulationId is required');
    }
    if (!description || description.trim() === '') {
      throw ApiError.badRequest('description is required');
    }

    await this.assertImprovesOnPublished(simulationId);

    const prId = await this.github.createPullRequest(
      simulationId,
      SOURCE_BRANCH,
      `Proposal: ${simulationId}`,
      description,
    );

    const ciResult = await this.ciPipeline.run({ proposalId: prId, simulationId });

    await Promise.all([
      this.github.addPullRequestComment(prId, formatCiComment(ciResult.status, ciResult.conflicts.length)),
      this.github.setPullRequestLabels(prId, [ciResult.status === 'READY' ? CI_LABEL_READY : CI_LABEL_BLOCKED]),
    ]);

    return {
      id: prId,
      simulationId,
      status: ciResult.status,
      createdAt: new Date().toISOString(),
    };
  }

  async list(status?: string): Promise<readonly Proposal[]> {
    const filter = validateListStatus(status);

    const prIds = await this.github.listOpenPullRequests();
    const prs = await Promise.all(prIds.map((id) => this.github.getPullRequest(id)));

    const withLabelMatch = ({ pr }: { pr: { labels: readonly string[] } }): boolean => {
      if (filter === 'all') return true;
      const label = filter === 'ready' ? CI_LABEL_READY : CI_LABEL_BLOCKED;
      return pr.labels.includes(label);
    };

    return prIds
      .map((id, i) => ({ id, pr: prs[i]! }))
      .filter(withLabelMatch)
      .map(({ id, pr }) => toProposal(id, pr.head, pr.labels, pr.createdAt));
  }

  async get(proposalId: string): Promise<ProposalDetail> {
    const [pr, diff] = await Promise.all([
      this.github.getPullRequest(proposalId),
      this.github.getPullRequestDiff(proposalId),
    ]);

    const comparison = await this.computeScheduleComparison(pr.head);

    return {
      ...toProposal(proposalId, pr.head, pr.labels, pr.createdAt),
      diff,
      score: comparison.candidateScore,
      comparison,
    };
  }

  async merge(proposalId: string): Promise<Proposal> {
    const pr = await this.github.getPullRequest(proposalId);

    if (!pr.labels.includes(CI_LABEL_READY)) {
      throw ApiError.conflict('Proposal is not READY to merge — re-run CI or fix conflicts first');
    }

    await this.github.mergePullRequest(proposalId);

    return {
      id: proposalId,
      simulationId: pr.head,
      status: 'MERGED',
      createdAt: pr.createdAt,
    };
  }

  async reject(proposalId: string): Promise<Proposal> {
    const pr = await this.github.getPullRequest(proposalId);

    await this.github.closePullRequest(proposalId);

    return {
      id: proposalId,
      simulationId: pr.head,
      status: 'REJECTED',
      createdAt: pr.createdAt,
    };
  }

  // A proposal is only allowed through if it doesn't make the published
  // schedule worse: either it strictly reduces the number of hard-constraint
  // conflicts vs. what's live on `main` today, or — when conflicts are
  // unchanged — it changes the institution's weighted metric score at all
  // (better or worse; the point is the author is proposing a deliberate
  // trade-off, not a no-op). Anything else is rejected before a PR is ever
  // opened, so a blocked attempt never leaves a stray PR behind.
  private async assertImprovesOnPublished(simulationId: string): Promise<void> {
    const metricRules = await this.rulesService.listMetrics();

    // Sequential, not Promise.all: each side hydrates a scratch branch into
    // the shared graph store and tears it down before the next begins.
    // Running both concurrently doubles simultaneous write load against
    // Memgraph and was observed to trip real (non-mocked) concurrent-write
    // failures under parallel test load — every other caller of
    // hydrate/flush in this codebase is likewise strictly one-at-a-time.
    const baseline = await this.computeConflictsAndScore(SOURCE_BRANCH, metricRules);
    const candidate = await this.computeConflictsAndScore(simulationId, metricRules);

    const conflictsReduced = candidate.conflicts.length < baseline.conflicts.length;
    const conflictsUnchanged = candidate.conflicts.length === baseline.conflicts.length;
    const scoreChanged = candidate.score.score !== baseline.score.score;

    if (conflictsReduced || (conflictsUnchanged && scoreChanged)) {
      return;
    }

    throw ApiError.conflict(
      `This proposal doesn't improve the published schedule: ${candidate.conflicts.length} ` +
      `conflict${candidate.conflicts.length === 1 ? '' : 's'} vs ${baseline.conflicts.length} ` +
      `currently published, and an unchanged metric score (${candidate.score.score}). Reduce ` +
      'conflicts, or change the score, before submitting.',
    );
  }

  // Hydrates `branch`'s current schedule.json into a scratch graph session
  // just long enough to read its conflicts and weighted score, then tears
  // the session down. Used to compare a candidate branch against `main`.
  private async computeConflictsAndScore(
    branch: string,
    metricRules: readonly MetricRule[],
  ): Promise<{ conflicts: readonly Conflict[]; score: WeightedScoreResult }> {
    const runId = `check-${branch}-${Date.now()}`;
    const scheduleJson = await this.github.readFile(branch, SCHEDULE_JSON_PATH);

    try {
      await this.graph.hydrate(runId, scheduleJson);
      const conflicts = await this.graph.queryConflicts(runId);
      const score = await this.graph.scoreTimetable(runId, metricRules);
      return { conflicts, score };
    } finally {
      await this.graph.flush(runId);
    }
  }

  // Builds the full main-vs-candidate comparison shown on the proposal review
  // screen: conflicts and weighted score on both sides (computed live against
  // the institution's *current* rules.json, not what was true at submit
  // time), the resulting conflict delta, and the complete class-level change
  // list. Reuses computeConflictsAndScore's sequential hydrate/flush pattern.
  private async computeScheduleComparison(candidateBranch: string): Promise<ScheduleComparison> {
    const metricRules = await this.rulesService.listMetrics();

    const baseline = await this.computeConflictsAndScore(SOURCE_BRANCH, metricRules);
    const candidate = await this.computeConflictsAndScore(candidateBranch, metricRules);

    // Plain GitHub file reads, not Memgraph writes — safe to parallelize,
    // unlike the hydrate calls above.
    const [mainRaw, candidateRaw] = await Promise.all([
      this.github.readFile(SOURCE_BRANCH, SCHEDULE_JSON_PATH),
      this.github.readFile(candidateBranch, SCHEDULE_JSON_PATH),
    ]);

    return {
      baselineScore: baseline.score,
      candidateScore: candidate.score,
      baselineConflicts: baseline.conflicts,
      candidateConflicts: candidate.conflicts,
      conflictDelta: diffConflictsById(baseline.conflicts, candidate.conflicts),
      classDiff: diffSchedules(parseScheduleJson(mainRaw), parseScheduleJson(candidateRaw)),
    };
  }
}

function toProposal(
  id: string,
  head: string,
  labels: readonly string[],
  createdAt: string,
): Proposal {
  return {
    id,
    simulationId: head,
    status: labelsToStatus(labels),
    createdAt,
  };
}

function validateListStatus(status: string | undefined): ProposalListStatus {
  if (status === undefined) return 'ready';
  if ((VALID_LIST_STATUSES as readonly string[]).includes(status)) {
    return status as ProposalListStatus;
  }
  throw ApiError.badRequest(
    `Invalid status "${status}" — must be one of: ${VALID_LIST_STATUSES.join(', ')}`,
  );
}

function labelsToStatus(labels: readonly string[]): Proposal['status'] {
  if (labels.includes(CI_LABEL_READY)) return 'READY';
  if (labels.includes(CI_LABEL_BLOCKED)) return 'BLOCKED';
  return 'PENDING';
}

function formatCiComment(status: 'READY' | 'BLOCKED', conflictCount: number): string {
  if (status === 'READY') {
    return '✅ **CI passed** — No hard constraint conflicts detected. This proposal is ready to merge.';
  }
  return `❌ **CI failed** — ${conflictCount} hard constraint conflict${conflictCount === 1 ? '' : 's'} detected. Fix the conflicts and push again to re-trigger CI.`;
}
