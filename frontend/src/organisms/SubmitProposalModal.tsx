import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CommitGate from '@/molecules/CommitGate';
import ProposalForm from '@/molecules/ProposalForm';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { createProposalThunk } from '@/store/reducers/proposalSlice';

type Stage = 'commit-gate' | 'proposal-form';

interface SubmitProposalModalProps {
  readonly open: boolean;
  readonly simId: string;
  readonly onClose: () => void;
}

// Success/error feedback for the submission itself is NOT rendered here —
// it lives in Redux (proposalSlice.lastSubmission / .error) and is shown by
// the always-mounted GlobalProposalStatusSnackbar / GlobalErrorSnackbar
// (see App.tsx). A Snackbar owned by this modal's local state would vanish
// the moment the user navigates away (e.g. straight to admin view to check
// the proposal) before or as the submission resolves — which is exactly the
// "no clear feedback" bug this was rewritten to fix.
export default function SubmitProposalModal({
  open,
  simId,
  onClose,
}: SubmitProposalModalProps): React.ReactElement {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const hasUnsavedChanges = useAppSelector((s) => s.session.hasUnsavedChanges);
  // Whatever main looked like when this draft was forked — sent back so the
  // backend can tell whether the published schedule has since changed (see
  // ScheduleUpdatedModal for what happens when it has).
  const baseScheduleVersion = useAppSelector(
    (s) => s.simulation.simulations.find((sim) => sim.id === simId)?.baseScheduleVersion ?? '',
  );
  const identityRole = useAppSelector((s) => s.identity.identity?.role);
  const role = identityRole === 'student' || identityRole === 'professor' ? identityRole : undefined;

  const [stage, setStage] = useState<Stage>('proposal-form');

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
      createProposalThunk({ simulationId: simId, description, baseScheduleVersion, role }),
    );
    // Only leave the editor once the submission actually went through — a
    // rejection (including the "published schedule changed" case, handled
    // by ScheduleUpdatedModal) should keep the user right where they are so
    // they can act on whatever the failure was.
    if (createProposalThunk.fulfilled.match(result)) {
      navigate('/');
    }
  };

  return (
    <>
      {stage === 'commit-gate' && (
        <CommitGate
          open={open}
          simId={simId}
          onSaved={advanceToForm}
          onClose={onClose}
        />
      )}

      {stage === 'proposal-form' && (
        <ProposalForm open={open} onSubmit={handleSubmit} onClose={onClose} />
      )}
    </>
  );
}
