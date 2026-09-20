import { ApiError } from '../types/ApiError.js';
import type { IGitHubService } from '../interfaces/IGitHubService.js';
import type { IGraphService } from '../interfaces/IGraphService.js';
import type { ICiPipelineService } from '../interfaces/ICiPipelineService.js';
import type { IProposalService } from '../interfaces/IProposalService.js';
import type { IRulesService } from '../interfaces/IRulesService.js';
import { parseScheduleJson } from '../utils/ScheduleHydrator.js';
import { diffConflictsById, diffSchedules } from '../utils/ScheduleDiffer.js';
import { computeConflictsAndScore, isProposalAcceptable } from '../utils/ProposalGate.js';
import type { ConflictsAndScore } from '../utils/ProposalGate.js';
import { isPolicyConstraint } from '../utils/ConstraintTranslator.js';
import type {
  Proposal,
  ProposalDetail,
  ProposalRole,
  CreateProposalParams,
  ScheduleComparison,
  MetricRule,
  Constraint,
} from '../types/domain.js';

const CI_LABEL_READY = 'ci:ready';
const CI_LABEL_BLOCKED = 'ci:blocked';
const ROLE_LABEL_STUDENT = 'role:student';
const ROLE_LABEL_PROFESSOR = 'role:professor';
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
    const { simulationId, description, baseScheduleVersion, role } = this.validateSubmitParams(params);

    await this.assertNotStale(baseScheduleVersion);
    await this.assertImprovesOnPublished(simulationId);

    return this.createProposalAndRunCi(simulationId, description, role);
  }

  // Facilitator/demo-only: creates a real, reviewable proposal without the
  // "must not make the published schedule worse" gate `submit()` enforces.
  // Exists because that gate (assertImprovesOnPublished) and the CI
  // pipeline's READY/BLOCKED label both run the same isProposalAcceptable
  // check — so a candidate that would come out BLOCKED is rejected before
  // a PR is ever opened, and a genuinely-BLOCKED proposal can never be
  // created through the normal submit path. Only reachable via HTTP when
  // GITHUB_PROVIDER=mock (see routes/proposals.ts) — never wired against a
  // real repo.
  async submitUnchecked(params: CreateProposalParams): Promise<Proposal> {
    const { simulationId, description, baseScheduleVersion, role } = this.validateSubmitParams(params);

    await this.assertNotStale(baseScheduleVersion);

    return this.createProposalAndRunCi(simulationId, description, role);
  }

  private validateSubmitParams(params: CreateProposalParams): CreateProposalParams {
    const { simulationId, description, baseScheduleVersion, role } = params;

    if (!simulationId || simulationId.trim() === '') {
      throw ApiError.badRequest('simulationId is required');
    }
    if (!description || description.trim() === '') {
      throw ApiError.badRequest('description is required');
    }
    if (!baseScheduleVersion || baseScheduleVersion.trim() === '') {
      throw ApiError.badRequest('baseScheduleVersion is required');
    }
    if (role !== undefined && role !== 'student' && role !== 'professor') {
      throw ApiError.badRequest('role must be "student" or "professor"');
    }

    return params;
  }

  private async createProposalAndRunCi(
    simulationId: string,
    description: string,
    role?: ProposalRole,
  ): Promise<Proposal> {
    const prId = await this.github.createPullRequest(
      simulationId,
      SOURCE_BRANCH,
      `Proposal: ${simulationId}`,
      description,
    );

    const ciResult = await this.ciPipeline.run({ proposalId: prId, simulationId });
    const roleLabel = roleToLabel(role);

    await Promise.all([
      this.github.addPullRequestComment(prId, formatCiComment(ciResult.status, ciResult.conflicts.length)),
      this.github.setPullRequestLabels(prId, [
        ciResult.status === 'READY' ? CI_LABEL_READY : CI_LABEL_BLOCKED,
        ...(roleLabel ? [roleLabel] : []),
      ]),
    ]);

    return {
      id: prId,
      simulationId,
      status: ciResult.status,
      createdAt: new Date().toISOString(),
      ...(role !== undefined ? { role } : {}),
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

    const role = labelsToRole(pr.labels);
    return {
      id: proposalId,
      simulationId: pr.head,
      status: 'MERGED',
      createdAt: pr.createdAt,
      ...(role !== undefined ? { role } : {}),
    };
  }

  async reject(proposalId: string): Promise<Proposal> {
    const pr = await this.github.getPullRequest(proposalId);

    await this.github.closePullRequest(proposalId);

    const role = labelsToRole(pr.labels);
    return {
      id: proposalId,
      simulationId: pr.head,
      status: 'REJECTED',
      createdAt: pr.createdAt,
      ...(role !== undefined ? { role } : {}),
    };
  }

  // Refuses a submission whose draft was forked from a `main` that no
  // longer exists — checked first, before any PR is opened, so a stale
  // submit never leaves a stray PR behind. The frontend catches the
  // MAIN_SCHEDULE_CHANGED code and offers to rebase the draft instead of
  // just showing a plain error (see ScheduleUpdatedModal).
  private async assertNotStale(baseScheduleVersion: string): Promise<void> {
    const { sha: currentMainVersion } = await this.github.readFileWithSha(SOURCE_BRANCH, SCHEDULE_JSON_PATH);

    if (baseScheduleVersion !== currentMainVersion) {
      throw ApiError.staleBase(
        'The published schedule has changed since this draft was created. Update your draft before submitting.',
      );
    }
  }

  // A proposal is only allowed through if it doesn't make the published
  // schedule worse (see ProposalGate.isProposalAcceptable for the exact
  // rule — same one CiPipelineService uses for the ci:ready/ci:blocked
  // label, so the two gates never disagree). Anything else is rejected
  // before a PR is ever opened, so a blocked attempt never leaves a stray
  // PR behind.
  private async assertImprovesOnPublished(simulationId: string): Promise<void> {
    const metricRules = await this.rulesService.listMetrics();
    const policyConstraints = await this.listPolicyConstraints();

    // Sequential, not Promise.all: each side hydrates a scratch branch into
    // the shared graph store and tears it down before the next begins.
    // Running both concurrently doubles simultaneous write load against
    // Memgraph and was observed to trip real (non-mocked) concurrent-write
    // failures under parallel test load — every other caller of
    // hydrate/flush in this codebase is likewise strictly one-at-a-time.
    const baseline = await this.computeConflictsAndScore(SOURCE_BRANCH, metricRules, policyConstraints);
    const candidate = await this.computeConflictsAndScore(simulationId, metricRules, policyConstraints);

    if (isProposalAcceptable(baseline, candidate)) {
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
    constraints: readonly Constraint[] = [],
  ): Promise<ConflictsAndScore> {
    return computeConflictsAndScore(this.github, this.graph, branch, metricRules, constraints);
  }

  // Only consecutive_limit/gap_limit are wired up as CI-gating policy
  // constraints (see ConstraintTranslator.ts) — the other 4
  // violationCondition values describe physical impossibilities already
  // covered unconditionally by queryConflicts's structural checks.
  private async listPolicyConstraints(): Promise<readonly Constraint[]> {
    const constraints = await this.rulesService.listConstraints();
    return constraints.filter((c) => isPolicyConstraint(c.violationCondition));
  }

  // Builds the full main-vs-candidate comparison shown on the proposal review
  // screen: conflicts and weighted score on both sides (computed live against
  // the institution's *current* rules.json, not what was true at submit
  // time), the resulting conflict delta, and the complete class-level change
  // list. Reuses computeConflictsAndScore's sequential hydrate/flush pattern.
  private async computeScheduleComparison(candidateBranch: string): Promise<ScheduleComparison> {
    const metricRules = await this.rulesService.listMetrics();
    const policyConstraints = await this.listPolicyConstraints();

    const baseline = await this.computeConflictsAndScore(SOURCE_BRANCH, metricRules, policyConstraints);
    const candidate = await this.computeConflictsAndScore(candidateBranch, metricRules, policyConstraints);

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
  const role = labelsToRole(labels);
  return {
    id,
    simulationId: head,
    status: labelsToStatus(labels),
    createdAt,
    ...(role !== undefined ? { role } : {}),
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

function roleToLabel(role?: ProposalRole): string | undefined {
  if (role === 'student') return ROLE_LABEL_STUDENT;
  if (role === 'professor') return ROLE_LABEL_PROFESSOR;
  return undefined;
}

function labelsToRole(labels: readonly string[]): ProposalRole | undefined {
  if (labels.includes(ROLE_LABEL_STUDENT)) return 'student';
  if (labels.includes(ROLE_LABEL_PROFESSOR)) return 'professor';
  return undefined;
}

function formatCiComment(status: 'READY' | 'BLOCKED', conflictCount: number): string {
  if (status === 'READY') {
    return "✅ **CI passed** — This proposal doesn't add any new conflicts beyond what's already published. Ready to merge.";
  }
  return `❌ **CI failed** — ${conflictCount} hard constraint conflict${conflictCount === 1 ? '' : 's'} detected, more than what's currently published. Fix the conflicts and push again to re-trigger CI.`;
}
