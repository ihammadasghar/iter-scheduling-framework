import type { Proposal, ProposalDetail, CreateProposalParams } from '../types/domain.js';

export interface IProposalService {
  submit(params: CreateProposalParams): Promise<Proposal>;
  // status filters open PRs by CI label: 'ready' (default) | 'blocked' | 'all'.
  list(status?: string): Promise<readonly Proposal[]>;
  get(proposalId: string): Promise<ProposalDetail>;
  merge(proposalId: string): Promise<Proposal>;
  // Soft reject: closes the PR, keeps the simulation branch.
  reject(proposalId: string): Promise<Proposal>;
}
