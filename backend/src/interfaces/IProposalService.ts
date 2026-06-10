import type { Proposal, CreateProposalParams } from '../types/domain.js';

export interface IProposalService {
  submit(params: CreateProposalParams): Promise<Proposal>;
  list(): Promise<readonly Proposal[]>;
  get(proposalId: string): Promise<Proposal>;
  merge(proposalId: string): Promise<void>;
}
