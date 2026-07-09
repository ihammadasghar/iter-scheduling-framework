import apiClient from './apiClient';
import type { Proposal, ProposalDetail, CreateProposalRequest, ApiError } from '@/types';

const isGap = (err: ApiError): boolean =>
  err.statusCode === 404 || err.statusCode === 405 || err.statusCode === 501;

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

  // Gap 2 — GET /proposals?status=blocked not yet implemented.
  // Returns empty array on any error rather than surfacing it to users.
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

  // Gap 3 — POST /proposals/:id/reject not yet implemented.
  // Returns silently on 404/405; rethrows all other errors.
  rejectProposal(id: string): Promise<void> {
    return apiClient
      .post<void>(`/proposals/${id}/reject`)
      .then(() => undefined)
      .catch((err: ApiError) => {
        if (isGap(err)) return;
        throw err;
      });
  },
};
