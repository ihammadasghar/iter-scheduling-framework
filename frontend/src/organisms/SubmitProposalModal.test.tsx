import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import SubmitProposalModal from './SubmitProposalModal';
import sessionReducer from '@/store/reducers/sessionSlice';
import proposalReducer from '@/store/reducers/proposalSlice';
import conflictReducer from '@/store/reducers/conflictSlice';
import { proposalService } from '@/services/proposalService';
import type { Conflict, Proposal } from '@/types';

vi.mock('@/services/proposalService', () => ({
  proposalService: {
    createProposal: vi.fn(),
    listProposals: vi.fn().mockResolvedValue([]),
    listBlockedProposals: vi.fn().mockResolvedValue([]),
  },
}));
vi.mock('@/services/simulationService', () => ({
  simulationService: {
    commitSimulation: vi.fn().mockResolvedValue(undefined),
  },
}));

const makeStore = (overrides: {
  hasUnsavedChanges?: boolean;
  conflictCount?: number;
} = {}) =>
  configureStore({
    reducer: {
      session: sessionReducer,
      proposal: proposalReducer,
      conflict: conflictReducer,
    },
    preloadedState: {
      session: {
        simulationId: 'sim-test',
        lastHeartbeat: 0,
        expired: false,
        hasUnsavedChanges: overrides.hasUnsavedChanges ?? false,
        lastPatchAt: 0,
      },
      conflict: {
        conflicts: Array.from({ length: overrides.conflictCount ?? 0 }, (_, i) => ({
          id: `c${i}`,
          type: 'ROOM_DOUBLE_BOOK' as const,
          classIds: ['CLS_001', 'CLS_002'] as const as readonly [string, string],
          message: '',
        })) as Conflict[],
        loading: false,
        lastFetchedAt: null,
        error: null,
      },
    },
  });

const render_ = (overrides = {}) => {
  const store = makeStore(overrides);
  const onClose = vi.fn();
  render(
    <Provider store={store}>
      <SubmitProposalModal open simId="sim-test" onClose={onClose} />
    </Provider>,
  );
  return { store, onClose };
};

describe('SubmitProposalModal', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('CommitGate (stage 1)', () => {
    it('shows commit gate when hasUnsavedChanges is true', () => {
      render_({ hasUnsavedChanges: true });
      expect(screen.getByRole('heading', { name: /unsaved changes/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /save my changes first/i })).toBeInTheDocument();
    });

    it('skips commit gate when hasUnsavedChanges is false', () => {
      render_({ hasUnsavedChanges: false });
      expect(screen.queryByText(/unsaved changes/i)).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /submit proposal for review/i })).toBeInTheDocument();
    });

    it('advances to proposal form when "Submit Without Saving" is clicked', () => {
      render_({ hasUnsavedChanges: true });
      fireEvent.click(screen.getByRole('button', { name: /submit without saving/i }));
      expect(screen.getByRole('heading', { name: /submit proposal for review/i })).toBeInTheDocument();
    });

    it('advances to proposal form after successful save', async () => {
      render_({ hasUnsavedChanges: true });
      fireEvent.click(screen.getByRole('button', { name: /save my changes first/i }));
      await waitFor(() =>
        expect(screen.getByRole('heading', { name: /submit proposal for review/i })).toBeInTheDocument(),
      );
    });
  });

  describe('ProposalForm (stage 2)', () => {
    it('requires description before submission', () => {
      render_({ hasUnsavedChanges: false });
      expect(
        screen.getByRole('button', { name: /submit.*review/i }),
      ).toBeDisabled();
    });

    it('enables submit button when description is entered', () => {
      render_({ hasUnsavedChanges: false });
      fireEvent.change(screen.getByLabelText(/explain your changes/i), {
        target: { value: 'Moved bio lab to avoid room conflict' },
      });
      expect(screen.getByRole('button', { name: /submit.*review/i })).not.toBeDisabled();
    });

    it('shows conflict warning when conflicts exist (plain English only)', () => {
      render_({ hasUnsavedChanges: false, conflictCount: 2 });
      expect(screen.getByText(/2 scheduling conflict/i)).toBeInTheDocument();
      // No raw type codes visible
      expect(screen.queryByText(/ROOM_DOUBLE_BOOK/i)).not.toBeInTheDocument();
    });

    it('does not show conflict warning when conflicts is 0', () => {
      render_({ hasUnsavedChanges: false, conflictCount: 0 });
      expect(screen.queryByText(/scheduling conflict/i)).not.toBeInTheDocument();
    });

    // Success/error feedback is no longer rendered by this modal — it's
    // shown by the always-mounted GlobalProposalStatusSnackbar /
    // GlobalErrorSnackbar (see App.tsx), driven by proposalSlice state, so
    // it survives navigating away from this page before or as the
    // submission resolves. Coverage for the actual toast content lives in
    // useGlobalProposalStatusSnackbar.test.tsx / GlobalProposalStatusSnackbar.test.tsx
    // and proposalSlice.test.ts. What this modal owns is: closing itself and
    // dispatching the submission with the right arguments.

    it('closes the dialog and dispatches the submission on successful submit', async () => {
      const proposal: Proposal = {
        id: 'prop-1',
        simulationId: 'sim-test',
        status: 'READY',
        createdAt: new Date().toISOString(),
      };
      vi.mocked(proposalService.createProposal).mockResolvedValue(proposal);

      const { store, onClose } = render_({ hasUnsavedChanges: false });
      fireEvent.change(screen.getByLabelText(/explain your changes/i), {
        target: { value: 'Fixed room double booking' },
      });
      fireEvent.click(screen.getByRole('button', { name: /submit.*review/i }));

      await waitFor(() => expect(onClose).toHaveBeenCalled());
      await waitFor(() =>
        expect(store.getState().proposal.lastSubmission).toEqual({ status: 'READY' }),
      );
      expect(proposalService.createProposal).toHaveBeenCalledWith({
        simulationId: 'sim-test',
        description: 'Fixed room double booking',
      });
    });

    it('records a BLOCKED outcome in the store when the proposal is blocked', async () => {
      const proposal: Proposal = {
        id: 'prop-2',
        simulationId: 'sim-test',
        status: 'BLOCKED',
        createdAt: new Date().toISOString(),
      };
      vi.mocked(proposalService.createProposal).mockResolvedValue(proposal);

      const { store } = render_({ hasUnsavedChanges: false });
      fireEvent.change(screen.getByLabelText(/explain your changes/i), {
        target: { value: 'Some changes' },
      });
      fireEvent.click(screen.getByRole('button', { name: /submit.*review/i }));

      await waitFor(() =>
        expect(store.getState().proposal.lastSubmission).toEqual({ status: 'BLOCKED' }),
      );
    });

    it('records the backend\'s rejection reason in the store on API failure', async () => {
      // apiClient's interceptor always normalises rejections to this shape —
      // see services/apiClient.ts's normalizeApiError.
      vi.mocked(proposalService.createProposal).mockRejectedValue({
        statusCode: 409,
        code: 'CONFLICT',
        message: 'A proposal for this draft is already open — check My Proposals before submitting again.',
      });

      const { store } = render_({ hasUnsavedChanges: false });
      fireEvent.change(screen.getByLabelText(/explain your changes/i), {
        target: { value: 'Some changes' },
      });
      fireEvent.click(screen.getByRole('button', { name: /submit.*review/i }));

      await waitFor(() =>
        expect(store.getState().proposal.error).toBe(
          'A proposal for this draft is already open — check My Proposals before submitting again.',
        ),
      );
    });
  });
});
