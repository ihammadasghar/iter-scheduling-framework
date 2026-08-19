import { ApiError } from '../types/ApiError.js';
import type { IGitHubService } from '../interfaces/IGitHubService.js';
import type { IGraphService } from '../interfaces/IGraphService.js';
import type { ICiPipelineService } from '../interfaces/ICiPipelineService.js';
import type { IProposalService } from '../interfaces/IProposalService.js';
import type { IRulesService } from '../interfaces/IRulesService.js';
import type { Proposal, ProposalDetail, CreateProposalParams, WeightedScoreResult } from '../types/domain.js';

const CI_LABEL_READY = 'ci:ready';
const CI_LABEL_BLOCKED = 'ci:blocked';
const SCHEDULE_JSON_PATH = 'schedule.json';

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

    const prId = await this.github.createPullRequest(
      simulationId,
      'main',
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

    const score = await this.computeScore(proposalId, pr.head);

    return {
      ...toProposal(proposalId, pr.head, pr.labels, pr.createdAt),
      diff,
      score,
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

  // Computed live against the institution's *current* rules.json (not what was
  // true at submit time) — reflects the criteria the institution values now.
  private async computeScore(proposalId: string, headBranch: string): Promise<WeightedScoreResult> {
    const scoreRunId = `score-${proposalId}-${Date.now()}`;
    const scheduleJson = await this.github.readFile(headBranch, SCHEDULE_JSON_PATH);

    try {
      await this.graph.hydrate(scoreRunId, scheduleJson);
      const metricRules = await this.rulesService.listMetrics();
      return await this.graph.scoreTimetable(scoreRunId, metricRules);
    } finally {
      await this.graph.flush(scoreRunId);
    }
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
