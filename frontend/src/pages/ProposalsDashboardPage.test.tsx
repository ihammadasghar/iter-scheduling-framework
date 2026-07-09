import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import ProposalsDashboardPage from './ProposalsDashboardPage';
import proposalReducer from '@/store/reducers/proposalSlice';
import uiReducer from '@/store/reducers/uiSlice';
import simulationReducer from '@/store/reducers/simulationSlice';
import classReducer from '@/store/reducers/classSlice';
import conflictReducer from '@/store/reducers/conflictSlice';
import metricReducer from '@/store/reducers/metricSlice';
import rulesReducer from '@/store/reducers/rulesSlice';
import sessionReducer from '@/store/reducers/sessionSlice';
import * as proposalService from '@/services/proposalService';

vi.mock('@/services/proposalService', () => ({
  proposalService: {
    listProposals: vi.fn().mockResolvedValue([]),
    listBlockedProposals: vi.fn().mockResolvedValue([]),
    getProposal: vi.fn(),
    createProposal: vi.fn(),
    mergeProposal: vi.fn(),
    rejectProposal: vi.fn(),
  },
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
      <MemoryRouter initialEntries={['/admin/proposals']}>
        <ProposalsDashboardPage />
      </MemoryRouter>
    </Provider>,
  );

describe('ProposalsDashboardPage', () => {
  it('renders heading', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /proposals for review/i })).toBeInTheDocument();
  });

  it('shows empty state when no proposals after load', async () => {
    vi.mocked(proposalService.proposalService.listProposals).mockResolvedValue([]);
    vi.mocked(proposalService.proposalService.listBlockedProposals).mockResolvedValue([]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/no proposals waiting for review/i)).toBeInTheDocument(),
    );
  });

  it('shows ready section when ready proposals exist', async () => {
    vi.mocked(proposalService.proposalService.listProposals).mockResolvedValueOnce([
      {
        id: 'p1',
        simulationId: 'sim-alice-abc123',
        status: 'READY',
        createdAt: new Date().toISOString(),
        description: 'Moved class to Monday',
      },
    ]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /ready for review/i })).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /review.*publish/i })).toBeInTheDocument();
  });

  it('shows blocked section when blocked proposals exist', async () => {
    vi.mocked(proposalService.proposalService.listBlockedProposals).mockResolvedValueOnce([
      {
        id: 'p2',
        simulationId: 'sim-bob-def456',
        status: 'BLOCKED',
        createdAt: new Date().toISOString(),
      },
    ]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /has conflicts/i })).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /review details/i })).toBeInTheDocument();
  });

  it('shows error alert on fetch failure', async () => {
    vi.mocked(proposalService.proposalService.listProposals).mockRejectedValueOnce(
      new Error('Network error'),
    );
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/could not load proposals/i)).toBeInTheDocument(),
    );
  });

  it('has a Refresh List button', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /refresh list/i })).toBeInTheDocument();
  });
});
