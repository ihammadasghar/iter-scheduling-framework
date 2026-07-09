import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MockInstance } from 'vitest';
import type { AxiosResponse } from 'axios';
import apiClient from './apiClient';
import { proposalService } from './proposalService';
import type { Proposal, ProposalDetail, ApiError } from '@/types';

const axiosOk = <T>(data: T): Promise<AxiosResponse<T>> =>
  Promise.resolve({ data, status: 200, statusText: 'OK', headers: {}, config: {} as never });

const fakeProposal: Proposal = {
  id: '42',
  simulationId: 'sim-alice-a1b2c3d4',
  status: 'READY',
  createdAt: '2026-06-11T10:15:00Z',
};

describe('proposalService', () => {
  let postSpy: MockInstance;
  let getSpy: MockInstance;

  beforeEach(() => {
    postSpy = vi.spyOn(apiClient, 'post');
    getSpy = vi.spyOn(apiClient, 'get');
  });

  it('createProposal calls POST /proposals', async () => {
    postSpy.mockReturnValue(axiosOk(fakeProposal));
    const result = await proposalService.createProposal({
      simulationId: 'sim-alice-a1b2c3d4',
      description: 'Moving BIO101',
    });
    expect(postSpy).toHaveBeenCalledWith('/proposals', {
      simulationId: 'sim-alice-a1b2c3d4',
      description: 'Moving BIO101',
    });
    expect(result.status).toBe('READY');
  });

  it('listProposals calls GET /proposals', async () => {
    getSpy.mockReturnValue(axiosOk([fakeProposal]));
    const result = await proposalService.listProposals();
    expect(getSpy).toHaveBeenCalledWith('/proposals');
    expect(result).toHaveLength(1);
  });

  it('listBlockedProposals returns empty array on any error (Gap 2)', async () => {
    getSpy.mockRejectedValue({ statusCode: 400, code: 'BAD_REQUEST', message: 'Bad' });
    const result = await proposalService.listBlockedProposals();
    expect(result).toEqual([]);
  });

  it('getProposal calls GET /proposals/:id', async () => {
    const detail: ProposalDetail = { ...fakeProposal, diff: '--- a\n+++ b' };
    getSpy.mockReturnValue(axiosOk(detail));
    const result = await proposalService.getProposal('42');
    expect(getSpy).toHaveBeenCalledWith('/proposals/42');
    expect(result.diff).toBeTruthy();
  });

  it('mergeProposal calls POST /proposals/:id/merge', async () => {
    postSpy.mockReturnValue(axiosOk({ ...fakeProposal, status: 'MERGED' }));
    const result = await proposalService.mergeProposal('42');
    expect(postSpy).toHaveBeenCalledWith('/proposals/42/merge');
    expect(result.status).toBe('MERGED');
  });

  it('rejectProposal silently ignores 404 (Gap 3)', async () => {
    const gap3Error: ApiError = { statusCode: 404, code: 'NOT_FOUND', message: 'Not found' };
    postSpy.mockRejectedValue(gap3Error);
    await expect(proposalService.rejectProposal('42')).resolves.toBeUndefined();
  });

  it('rejectProposal silently ignores 501 (Gap 3)', async () => {
    const gap3Error: ApiError = { statusCode: 501, code: 'NOT_IMPLEMENTED', message: 'Not impl' };
    postSpy.mockRejectedValue(gap3Error);
    await expect(proposalService.rejectProposal('42')).resolves.toBeUndefined();
  });

  it('rejectProposal rethrows non-gap errors', async () => {
    const serverError: ApiError = { statusCode: 500, code: 'INTERNAL_SERVER_ERROR', message: 'Boom' };
    postSpy.mockRejectedValue(serverError);
    await expect(proposalService.rejectProposal('42')).rejects.toMatchObject({ statusCode: 500 });
  });
});
