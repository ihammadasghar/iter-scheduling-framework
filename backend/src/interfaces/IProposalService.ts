import type { Proposal, ProposalDetail, CreateProposalParams } from '../types/domain.js';

export interface IProposalService {
  submit(params: CreateProposalParams): Promise<Proposal>;
  list(): Promise<readonly Proposal[]>;
  get(proposalId: string): Promise<ProposalDetail>;
  merge(proposalId: string): Promise<Proposal>;
}
