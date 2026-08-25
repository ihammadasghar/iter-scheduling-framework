import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import GlobalProposalStatusSnackbar from './GlobalProposalStatusSnackbar';
import proposalReducer, { createProposalThunk } from '@/store/reducers/proposalSlice';
import type { Proposal } from '@/types';

const makeStore = () => configureStore({ reducer: { proposal: proposalReducer } });

const fakeProposal = (status: Proposal['status']): Proposal => ({
  id: 'p1',
  simulationId: 'sim-1',
  status,
  createdAt: new Date().toISOString(),
});

describe('GlobalProposalStatusSnackbar', () => {
  it('renders nothing when nothing has been submitted', () => {
    render(
      <Provider store={makeStore()}>
        <GlobalProposalStatusSnackbar />
      </Provider>,
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders a success Snackbar after a READY submission', () => {
    const store = makeStore();
    store.dispatch(
      createProposalThunk.fulfilled(fakeProposal('READY'), '', { simulationId: 'sim-1', description: 'x' }),
    );

    render(
      <Provider store={store}>
        <GlobalProposalStatusSnackbar />
      </Provider>,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/ready for review/i)).toBeInTheDocument();
  });

  it('renders regardless of which page mounts it — not tied to the submitting component', () => {
    // The whole point of this component: it's mounted once, globally, in
    // App.tsx — so it renders the result even when the page that triggered
    // the submission is no longer the one on screen.
    const store = makeStore();
    store.dispatch(
      createProposalThunk.fulfilled(fakeProposal('BLOCKED'), '', { simulationId: 'sim-1', description: 'x' }),
    );

    render(
      <Provider store={store}>
        <div>Some unrelated admin page</div>
        <GlobalProposalStatusSnackbar />
      </Provider>,
    );

    expect(screen.getByText(/some unrelated admin page/i)).toBeInTheDocument();
    expect(screen.getByText(/scheduling conflicts/i)).toBeInTheDocument();
  });
});
