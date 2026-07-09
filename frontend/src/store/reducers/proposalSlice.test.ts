import { describe, it, expect, vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import proposalReducer, {
  fetchProposalsThunk,
  fetchBlockedProposalsThunk,
  fetchProposalDetailThunk,
  createProposalThunk,
  mergeProposalThunk,
  rejectProposalThunk,
  clearCurrentProposal,
} from './proposalSlice';
import * as proposalService from '@/services/proposalService';

vi.mock('@/services/proposalService', () => ({
  proposalService: {
    listProposals: vi.fn(),
    listBlockedProposals: vi.fn(),
    getProposal: vi.fn(),
    createProposal: vi.fn(),
    mergeProposal: vi.fn(),
    rejectProposal: vi.fn(),
  },
}));

const makeStore = () => configureStore({ reducer: { proposal: proposalReducer } });

const fakeProposal = {
  id: 'p1',
  simulationId: 'sim-alice-abc',
  status: 'READY' as const,
  createdAt: new Date().toISOString(),
};

const fakeDetail = { ...fakeProposal, diff: '', userId: 'alice' };

describe('proposalSlice', () => {
  it('initialises with empty state', () => {
    const state = makeStore().getState().proposal;
    expect(state.proposals).toEqual([]);
    expect(state.blocked).toEqual([]);
    expect(state.current).toBeNull();
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('fetchProposalsThunk.pending sets loading=true', () => {
    const store = makeStore();
    store.dispatch(fetchProposalsThunk.pending('', undefined));
    expect(store.getState().proposal.loading).toBe(true);
  });

  it('fetchProposalsThunk.fulfilled stores ready proposals', () => {
    const store = makeStore();
    store.dispatch(fetchProposalsThunk.fulfilled([fakeProposal], '', undefined));
    expect(store.getState().proposal.proposals).toHaveLength(1);
    expect(store.getState().proposal.loading).toBe(false);
  });

  it('fetchProposalsThunk.rejected sets error', () => {
    const store = makeStore();
    store.dispatch(
      fetchProposalsThunk.rejected(null, '', undefined, {
        statusCode: 500, code: 'INTERNAL_SERVER_ERROR', message: 'Server error',
      }),
    );
    expect(store.getState().proposal.error).toBe('Server error');
  });

  it('fetchBlockedProposalsThunk.fulfilled stores blocked proposals', () => {
    const store = makeStore();
    const blocked = { ...fakeProposal, status: 'BLOCKED' as const };
    store.dispatch(fetchBlockedProposalsThunk.fulfilled([blocked], '', undefined));
    expect(store.getState().proposal.blocked).toHaveLength(1);
  });

  it('fetchProposalDetailThunk.pending clears current and sets loading', () => {
    const store = makeStore();
    store.dispatch(fetchProposalDetailThunk.fulfilled(fakeDetail, '', 'p1'));
    store.dispatch(fetchProposalDetailThunk.pending('', 'p1'));
    expect(store.getState().proposal.current).toBeNull();
    expect(store.getState().proposal.loading).toBe(true);
  });

  it('fetchProposalDetailThunk.fulfilled stores proposal detail', () => {
    const store = makeStore();
    store.dispatch(fetchProposalDetailThunk.fulfilled(fakeDetail, '', 'p1'));
    expect(store.getState().proposal.current).toEqual(fakeDetail);
  });

  it('createProposalThunk.fulfilled appends proposal to list', () => {
    const store = makeStore();
    store.dispatch(createProposalThunk.fulfilled(fakeProposal, '', { simulationId: 'sim-1', description: 'test' }));
    expect(store.getState().proposal.proposals).toHaveLength(1);
  });

  it('mergeProposalThunk.fulfilled removes proposal from list', () => {
    const store = makeStore();
    store.dispatch(fetchProposalsThunk.fulfilled([fakeProposal], '', undefined));
    store.dispatch(mergeProposalThunk.fulfilled(fakeProposal, '', 'p1'));
    expect(store.getState().proposal.proposals).toHaveLength(0);
  });

  it('rejectProposalThunk.fulfilled removes from both lists', () => {
    const store = makeStore();
    const blocked = { ...fakeProposal, status: 'BLOCKED' as const };
    store.dispatch(fetchProposalsThunk.fulfilled([fakeProposal], '', undefined));
    store.dispatch(fetchBlockedProposalsThunk.fulfilled([blocked], '', undefined));
    store.dispatch(rejectProposalThunk.fulfilled('p1', '', 'p1'));
    expect(store.getState().proposal.proposals).toHaveLength(0);
    expect(store.getState().proposal.blocked).toHaveLength(0);
  });

  it('clearCurrentProposal nulls out current', () => {
    const store = makeStore();
    store.dispatch(fetchProposalDetailThunk.fulfilled(fakeDetail, '', 'p1'));
    store.dispatch(clearCurrentProposal());
    expect(store.getState().proposal.current).toBeNull();
  });

  it('async fetchProposalsThunk calls service', async () => {
    vi.mocked(proposalService.proposalService.listProposals).mockResolvedValueOnce([fakeProposal]);
    const store = makeStore();
    await store.dispatch(fetchProposalsThunk());
    expect(store.getState().proposal.proposals).toHaveLength(1);
  });

  it('async fetchBlockedProposalsThunk returns empty array on error (Gap 2)', async () => {
    vi.mocked(proposalService.proposalService.listBlockedProposals).mockRejectedValueOnce(
      new Error('not implemented'),
    );
    const store = makeStore();
    await store.dispatch(fetchBlockedProposalsThunk());
    // Gap 2: blocked should be empty, no error thrown
    expect(store.getState().proposal.blocked).toEqual([]);
  });
});
