import { useState, useEffect, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { clearLastSubmission } from '@/store/reducers/proposalSlice';
import { proposalStatusMessage, type ProposalStatusSeverity } from '@/utils/proposalStatusMessage';

interface GlobalProposalStatusSnackbarState {
  readonly open: boolean;
  readonly message: string;
  readonly severity: ProposalStatusSeverity;
  readonly handleClose: () => void;
}

/**
 * Mirrors useGlobalErrorSnackbar, but for the *result* of a proposal
 * submission. Reads `state.proposal.lastSubmission` instead of an error
 * field, so it's driven by Redux (not local component state) — the
 * confirmation survives navigating away from the submitting page (e.g.
 * switching straight to admin view) before or as it arrives.
 */
export function useGlobalProposalStatusSnackbar(): GlobalProposalStatusSnackbarState {
  const dispatch = useAppDispatch();
  const lastSubmission = useAppSelector((s) => s.proposal.lastSubmission);

  const [open, setOpen] = useState(false);
  const [content, setContent] = useState<{ message: string; severity: ProposalStatusSeverity }>({
    message: '',
    severity: 'info',
  });

  useEffect(() => {
    if (lastSubmission !== null) {
      setContent(proposalStatusMessage(lastSubmission.status));
      setOpen(true);
    }
  }, [lastSubmission]);

  const handleClose = useCallback((): void => {
    setOpen(false);
    dispatch(clearLastSubmission());
  }, [dispatch]);

  return { open, message: content.message, severity: content.severity, handleClose };
}
