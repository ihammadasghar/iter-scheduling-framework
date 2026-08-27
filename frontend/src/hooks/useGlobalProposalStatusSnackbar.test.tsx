import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { useGlobalProposalStatusSnackbar } from './useGlobalProposalStatusSnackbar';
import proposalReducer, { createProposalThunk, clearLastSubmission } from '@/store/reducers/proposalSlice';
import type { Proposal } from '@/types';

const makeStore = () => configureStore({ reducer: { proposal: proposalReducer } });

const wrapper = (store: ReturnType<typeof makeStore>) =>
  ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );

const fakeProposal = (status: Proposal['status']): Proposal => ({
  id: 'p1',
  simulationId: 'sim-1',
  status,
  createdAt: new Date().toISOString(),
});

describe('useGlobalProposalStatusSnackbar', () => {
  it('open is false when nothing has been submitted yet', () => {
    const store = makeStore();
    const { result } = renderHook(() => useGlobalProposalStatusSnackbar(), { wrapper: wrapper(store) });
    expect(result.current.open).toBe(false);
    expect(result.current.message).toBe('');
  });

  it('opens with a success message when createProposalThunk fulfills with READY', () => {
    const store = makeStore();
    const { result } = renderHook(() => useGlobalProposalStatusSnackbar(), { wrapper: wrapper(store) });

    act(() => {
      store.dispatch(
        createProposalThunk.fulfilled(fakeProposal('READY'), '', { simulationId: 'sim-1', description: 'x', baseScheduleVersion: 'main-sha-1' }),
      );
    });

    expect(result.current.open).toBe(true);
    expect(result.current.severity).toBe('success');
    expect(result.current.message).toMatch(/ready for review/i);
  });

  it('opens with a warning message when createProposalThunk fulfills with BLOCKED', () => {
    const store = makeStore();
    const { result } = renderHook(() => useGlobalProposalStatusSnackbar(), { wrapper: wrapper(store) });

    act(() => {
      store.dispatch(
        createProposalThunk.fulfilled(fakeProposal('BLOCKED'), '', { simulationId: 'sim-1', description: 'x', baseScheduleVersion: 'main-sha-1' }),
      );
    });

    expect(result.current.open).toBe(true);
    expect(result.current.severity).toBe('warning');
    expect(result.current.message).toMatch(/scheduling conflicts/i);
  });

  it('survives being read after the submitting component would have unmounted — driven by Redux, not local state', () => {
    // Simulates: submit, then immediately navigate away (a fresh renderHook
    // instance stands in for a different page mounting afterwards).
    const store = makeStore();
    store.dispatch(
      createProposalThunk.fulfilled(fakeProposal('READY'), '', { simulationId: 'sim-1', description: 'x', baseScheduleVersion: 'main-sha-1' }),
    );

    const { result } = renderHook(() => useGlobalProposalStatusSnackbar(), { wrapper: wrapper(store) });
    expect(result.current.open).toBe(true);
  });

  it('handleClose closes the snackbar and clears lastSubmission from the store', () => {
    const store = makeStore();
    store.dispatch(
      createProposalThunk.fulfilled(fakeProposal('READY'), '', { simulationId: 'sim-1', description: 'x', baseScheduleVersion: 'main-sha-1' }),
    );
    const { result } = renderHook(() => useGlobalProposalStatusSnackbar(), { wrapper: wrapper(store) });
    expect(result.current.open).toBe(true);

    act(() => { result.current.handleClose(); });

    expect(result.current.open).toBe(false);
    expect(store.getState().proposal.lastSubmission).toBeNull();
  });

  it('does not reopen after clearLastSubmission until another submission fulfills', () => {
    const store = makeStore();
    store.dispatch(
      createProposalThunk.fulfilled(fakeProposal('READY'), '', { simulationId: 'sim-1', description: 'x', baseScheduleVersion: 'main-sha-1' }),
    );
    act(() => { store.dispatch(clearLastSubmission()); });

    const { result } = renderHook(() => useGlobalProposalStatusSnackbar(), { wrapper: wrapper(store) });
    expect(result.current.open).toBe(false);
  });
});
