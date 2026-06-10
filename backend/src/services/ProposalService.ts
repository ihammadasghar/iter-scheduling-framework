import { ApiError } from '../types/ApiError.js';
import type { IProposalService } from '../interfaces/IProposalService.js';
import type { Proposal, CreateProposalParams } from '../types/domain.js';

export class ProposalService implements IProposalService {
  async submit(_params: CreateProposalParams): Promise<Proposal> {
    throw ApiError.notImplemented();
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
