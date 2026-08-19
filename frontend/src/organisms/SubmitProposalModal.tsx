import { useEffect, useState } from 'react';
import { Alert, Snackbar } from '@mui/material';
import CommitGate from '@/molecules/CommitGate';
import ProposalForm from '@/molecules/ProposalForm';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { createProposalThunk } from '@/store/reducers/proposalSlice';
import type { ProposalStatus } from '@/types';

type Stage = 'commit-gate' | 'proposal-form';
type SnackStatus = ProposalStatus | 'error' | null;

interface SubmitProposalModalProps {
  readonly open: boolean;
  readonly simId: string;
  readonly onClose: () => void;
}

const FALLBACK_ERROR_MESSAGE = 'Could not submit proposal. Please try again.';

// errorMessage is only read for the 'error' case — the backend's actual
// reason (e.g. "A proposal for this draft is already open") instead of a
// generic message that doesn't tell you retrying won't help.
const snackConfig = (
  status: SnackStatus,
  errorMessage: string | undefined,
): { message: string; severity: 'info' | 'success' | 'warning' | 'error' } => {
  switch (status) {
    case 'PENDING':
      return {
        message: 'Your proposal has been submitted and is being checked for conflicts…',
        severity: 'info',
      };
    case 'READY':
      return {
        message: 'Your proposal is ready for review by the scheduling office ✓',
        severity: 'success',
      };
    case 'BLOCKED':
      return {
        message:
          'Your proposal has scheduling conflicts — the scheduling office has been notified and will contact you',
        severity: 'warning',
      };
    case 'MERGED':
      return {
        message: 'Your proposal has been merged into the published schedule ✓',
        severity: 'success',
      };
    case 'error':
      return {
        message: errorMessage ?? FALLBACK_ERROR_MESSAGE,
        severity: 'error',
      };
    default:
      return { message: '', severity: 'info' };
  }
};

export default function SubmitProposalModal({
  open,
  simId,
  onClose,
}: SubmitProposalModalProps): React.ReactElement {
  const dispatch = useAppDispatch();
  const hasUnsavedChanges = useAppSelector((s) => s.session.hasUnsavedChanges);

  const [stage, setStage] = useState<Stage>('proposal-form');
  const [snackStatus, setSnackStatus] = useState<SnackStatus>(null);
  const [snackErrorMessage, setSnackErrorMessage] = useState<string | undefined>(undefined);
  const [snackOpen, setSnackOpen] = useState(false);

  // Determine starting stage whenever the modal opens
  useEffect(() => {
    if (open) {
      setStage(hasUnsavedChanges ? 'commit-gate' : 'proposal-form');
    }
  }, [open, hasUnsavedChanges]);

  const advanceToForm = (): void => setStage('proposal-form');

  const handleSubmit = async (description: string): Promise<void> => {
    onClose();

    const result = await dispatch(
      createProposalThunk({ simulationId: simId, description }),
    );

    if (createProposalThunk.fulfilled.match(result)) {
      setSnackStatus(result.payload.status);
      setSnackErrorMessage(undefined);
    } else {
      setSnackStatus('error');
      setSnackErrorMessage(result.payload?.message);
    }
    setSnackOpen(true);
  };

  const { message, severity } = snackConfig(snackStatus, snackErrorMessage);

  return (
    <>
      {stage === 'commit-gate' && (
        <CommitGate
          open={open}
          simId={simId}
          onSaved={advanceToForm}
          onSkip={advanceToForm}
          onClose={onClose}
        />
      )}

      {stage === 'proposal-form' && (
        <ProposalForm open={open} onSubmit={handleSubmit} onClose={onClose} />
      )}

      <Snackbar
        open={snackOpen}
        onClose={() => setSnackOpen(false)}
        autoHideDuration={8000}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackOpen(false)}
          severity={severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {message}
        </Alert>
      </Snackbar>
    </>
  );
}
