import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import ProposalReviewPage from './ProposalReviewPage';
import proposalReducer from '@/store/reducers/proposalSlice';
import uiReducer from '@/store/reducers/uiSlice';
import simulationReducer from '@/store/reducers/simulationSlice';
import classReducer from '@/store/reducers/classSlice';
import conflictReducer from '@/store/reducers/conflictSlice';
import metricReducer from '@/store/reducers/metricSlice';
import rulesReducer from '@/store/reducers/rulesSlice';
import sessionReducer from '@/store/reducers/sessionSlice';
import * as proposalService from '@/services/proposalService';

// Must be defined inside vi.hoisted so the mock factory can reference it safely
const { fakeProposal, mockProposalService } = vi.hoisted(() => {
  const fp = {
    id: 'p1',
    simulationId: 'sim-alice-abc123',
    status: 'READY' as const,
    createdAt: new Date().toISOString(),
    description: 'Moved Biology class',
    diff: '',
    userId: 'alice',
  };
  const svc = {
    listProposals: vi.fn().mockResolvedValue([]),
    listBlockedProposals: vi.fn().mockResolvedValue([]),
    getProposal: vi.fn().mockResolvedValue(fp),
    createProposal: vi.fn(),
    mergeProposal: vi.fn(),
    rejectProposal: vi.fn(),
  };
  return { fakeProposal: fp, mockProposalService: svc };
});

vi.mock('@/services/proposalService', () => ({
  proposalService: mockProposalService,
}));

const makeStore = () =>
  configureStore({
    reducer: {
      proposal: proposalReducer,
      ui: uiReducer,
      simulation: simulationReducer,
      class: classReducer,
      conflict: conflictReducer,
      metric: metricReducer,
      rules: rulesReducer,
      session: sessionReducer,
    },
  });

const renderPage = () =>
  render(
    <Provider store={makeStore()}>
      <MemoryRouter initialEntries={['/admin/proposals/p1']}>
        <Routes>
          <Route path="/admin/proposals/:id" element={<ProposalReviewPage />} />
          <Route path="/admin/proposals" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );

describe('ProposalReviewPage', () => {
  it('renders "Proposal Review" heading', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /proposal review/i })).toBeInTheDocument(),
    );
  });

  it('shows CI status badge for READY status', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/checked — no conflicts/i)).toBeInTheDocument(),
    );
  });

  it('shows CI status badge for BLOCKED status', async () => {
    vi.mocked(proposalService.proposalService.getProposal).mockResolvedValueOnce({
      ...fakeProposal, status: 'BLOCKED',
    });
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/has scheduling conflicts/i)).toBeInTheDocument(),
    );
  });

  it('shows Approve & Publish button', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /approve.*publish/i })).toBeInTheDocument(),
    );
  });

  it('shows Close This Proposal button', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /close this proposal/i })).toBeInTheDocument(),
    );
  });

  it('opens approve confirmation dialog on Approve click', async () => {
    renderPage();
    await waitFor(() => screen.getByRole('button', { name: /approve.*publish/i }));
    fireEvent.click(screen.getByRole('button', { name: /approve.*publish/i }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /publish changes/i })).toBeInTheDocument(),
    );
    expect(screen.getByText(/live timetable/i)).toBeInTheDocument();
  });

  it('opens close confirmation dialog on Close click', async () => {
    renderPage();
    await waitFor(() => screen.getByRole('button', { name: /close this proposal/i }));
    fireEvent.click(screen.getByRole('button', { name: /close this proposal/i }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /close this proposal\?/i })).toBeInTheDocument(),
    );
  });

  it('can cancel the approve dialog', async () => {
    renderPage();
    await waitFor(() => screen.getByRole('button', { name: /approve.*publish/i }));
    fireEvent.click(screen.getByRole('button', { name: /approve.*publish/i }));
    await waitFor(() => screen.getByRole('heading', { name: /publish changes/i }));
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: /publish changes/i })).not.toBeInTheDocument(),
    );
  });

  it('renders "Back to Proposals" button', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /back to proposals/i })).toBeInTheDocument(),
    );
  });

  it('shows disclaimer text in CI status badge', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/does not re-check/i)).toBeInTheDocument(),
    );
  });

  it('dispatches fetchProposalDetailThunk on mount', async () => {
    renderPage();
    await waitFor(() =>
      expect(vi.mocked(proposalService.proposalService.getProposal)).toHaveBeenCalledWith('p1'),
    );
  });

  it('shows merge success snackbar after approve', async () => {
    vi.mocked(proposalService.proposalService.mergeProposal).mockResolvedValueOnce(fakeProposal);
    renderPage();
    await waitFor(() => screen.getByRole('button', { name: /approve.*publish/i }));
    fireEvent.click(screen.getByRole('button', { name: /approve.*publish/i }));
    await waitFor(() => screen.getByRole('heading', { name: /publish changes/i }));
    fireEvent.click(screen.getByRole('button', { name: /yes, publish/i }));
    await waitFor(() =>
      expect(screen.getByText(/changes published to the live timetable/i)).toBeInTheDocument(),
    );
  });

  it('shows gap-3 inline error when reject is not available', async () => {
    vi.mocked(proposalService.proposalService.rejectProposal).mockRejectedValueOnce({ statusCode: 404 });
    renderPage();
    await waitFor(() => screen.getByRole('button', { name: /close this proposal/i }));
    fireEvent.click(screen.getByRole('button', { name: /close this proposal/i }));
    await waitFor(() => screen.getByRole('heading', { name: /close this proposal\?/i }));
    fireEvent.click(screen.getByRole('button', { name: /yes, close/i }));
    await waitFor(() =>
      expect(screen.getByText(/this feature is not available yet/i)).toBeInTheDocument(),
    );
  });
});
