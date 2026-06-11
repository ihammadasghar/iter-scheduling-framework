import { ApiError } from '../types/ApiError.js';
import type { IGitHubService } from '../interfaces/IGitHubService.js';
import type { IGraphService } from '../interfaces/IGraphService.js';
import type { ICiPipelineService } from '../interfaces/ICiPipelineService.js';
import type { IProposalService } from '../interfaces/IProposalService.js';
import type { Proposal, CreateProposalParams } from '../types/domain.js';

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
    await this.github.addPullRequestComment(prId, formatCiComment(ciResult.status, ciResult.conflicts.length));

    return {
      id: prId,
      simulationId,
      status: ciResult.status,
      createdAt: new Date().toISOString(),
    };
  }

  async list(): Promise<readonly Proposal[]> {
    throw ApiError.notImplemented();
  }

  async get(_proposalId: string): Promise<Proposal> {
    throw ApiError.notImplemented();
  }

  async merge(_proposalId: string): Promise<void> {
    throw ApiError.notImplemented();
  }
}

function formatCiComment(status: 'READY' | 'BLOCKED', conflictCount: number): string {
  if (status === 'READY') {
    return '✅ **CI passed** — No hard constraint conflicts detected. This proposal is ready to merge.';
  }
  return `❌ **CI failed** — ${conflictCount} hard constraint conflict${conflictCount === 1 ? '' : 's'} detected. Fix the conflicts and push again to re-trigger CI.`;
}
