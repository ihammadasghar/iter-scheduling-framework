import apiClient from './apiClient';
import type { Proposal, ProposalDetail, CreateProposalRequest } from '@/types';

export const proposalService = {
  createProposal(params: CreateProposalRequest): Promise<Proposal> {
    return apiClient
      .post<Proposal>('/proposals', params)
      .then((r) => r.data);
  },

  // GET /proposals — returns ci:ready proposals
  listProposals(): Promise<Proposal[]> {
    return apiClient
      .get<Proposal[]>('/proposals')
      .then((r) => r.data);
  },

  // BLOCKED section is supplementary — swallow failures so it doesn't take
  // down the rest of the dashboard.
  listBlockedProposals(): Promise<Proposal[]> {
    return apiClient
      .get<Proposal[]>('/proposals', { params: { status: 'blocked' } })
      .then((r) => r.data)
      .catch(() => []);
  },

  getProposal(id: string): Promise<ProposalDetail> {
    return apiClient
      .get<ProposalDetail>(`/proposals/${id}`)
      .then((r) => r.data);
  },

  mergeProposal(id: string): Promise<Proposal> {
    return apiClient
      .post<Proposal>(`/proposals/${id}/merge`)
      .then((r) => r.data);
  },

  // Soft reject: closes the PR, keeps the simulation branch.
  rejectProposal(id: string): Promise<void> {
    return apiClient
      .post<void>(`/proposals/${id}/reject`)
      .then(() => undefined);
  },
};
