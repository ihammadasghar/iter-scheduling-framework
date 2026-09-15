import type { Proposal, ProposalDetail, CreateProposalParams } from '../types/domain.js';

export interface IProposalService {
  submit(params: CreateProposalParams): Promise<Proposal>;
  // Facilitator/demo-only variant of submit() that skips the
  // "must not make the published schedule worse" gate — see ProposalService
  // for why that's needed to ever produce a genuinely BLOCKED proposal.
  submitUnchecked(params: CreateProposalParams): Promise<Proposal>;
  // status filters open PRs by CI label: 'ready' (default) | 'blocked' | 'all'.
  list(status?: string): Promise<readonly Proposal[]>;
  get(proposalId: string): Promise<ProposalDetail>;
  merge(proposalId: string): Promise<Proposal>;
  // Soft reject: closes the PR, keeps the simulation branch.
  reject(proposalId: string): Promise<Proposal>;
}
