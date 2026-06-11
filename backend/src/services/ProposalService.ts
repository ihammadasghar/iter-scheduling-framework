import { ApiError } from '../types/ApiError.js';
import type { IGitHubService } from '../interfaces/IGitHubService.js';
import type { IGraphService } from '../interfaces/IGraphService.js';
import type { IProposalService } from '../interfaces/IProposalService.js';
import type { Proposal, CreateProposalParams } from '../types/domain.js';

export class ProposalService implements IProposalService {
  constructor(
    private readonly github: IGitHubService,
    private readonly graph: IGraphService,
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

    return {
      id: prId,
      simulationId,
      status: 'PENDING',
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
