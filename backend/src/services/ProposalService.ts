import { ApiError } from '../types/ApiError.js';
import type { IGitHubService } from '../interfaces/IGitHubService.js';
import type { IGraphService } from '../interfaces/IGraphService.js';
import type { ICiPipelineService } from '../interfaces/ICiPipelineService.js';
import type { IProposalService } from '../interfaces/IProposalService.js';
import type { Proposal, ProposalDetail, CreateProposalParams } from '../types/domain.js';

const CI_LABEL_READY = 'ci:ready';
const CI_LABEL_BLOCKED = 'ci:blocked';

export class ProposalService implements IProposalService {
  constructor(
    private readonly github: IGitHubService,
    private readonly graph: IGraphService,
    private readonly ciPipeline: ICiPipelineService,
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

  async list(): Promise<readonly Proposal[]> {
    const prIds = await this.github.listOpenPullRequests();
    const prs = await Promise.all(prIds.map((id) => this.github.getPullRequest(id)));

    return prIds
      .map((id, i) => ({ id, pr: prs[i]! }))
      .filter(({ pr }) => pr.labels.includes(CI_LABEL_READY))
      .map(({ id, pr }) => toProposal(id, pr.head, pr.labels, pr.createdAt));
  }

  async get(proposalId: string): Promise<ProposalDetail> {
    const [pr, diff] = await Promise.all([
      this.github.getPullRequest(proposalId),
      this.github.getPullRequestDiff(proposalId),
    ]);

    return {
      ...toProposal(proposalId, pr.head, pr.labels, pr.createdAt),
      diff,
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
