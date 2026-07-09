import { useState, useEffect, useCallback } from 'react';
import { useAppSelector } from '@/store/hooks';

interface GlobalErrorSnackbarState {
  readonly open: boolean;
  readonly message: string;
  readonly handleClose: () => void;
}

/**
 * Collects the latest non-null error from all Redux slices.
 * Opens a Snackbar when any error appears; auto-hides after 8 seconds.
 * Clears when the user dismisses or when the next render has no error.
 */
export function useGlobalErrorSnackbar(): GlobalErrorSnackbarState {
  const simulationError = useAppSelector((s) => s.simulation.error);
  const classError = useAppSelector((s) => s.class.error);
  const conflictError = useAppSelector((s) => s.conflict.error);
  const metricError = useAppSelector((s) => s.metric.error);
  const proposalError = useAppSelector((s) => s.proposal.error);
  const rulesError = useAppSelector((s) => s.rules.error);

  // Pick the first non-null error
  const currentError =
    simulationError ??
    classError ??
    conflictError ??
    metricError ??
    proposalError ??
    rulesError ??
    null;

  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (currentError !== null) {
      setMessage(currentError);
      setOpen(true);
    }
  }, [currentError]);

  const handleClose = useCallback((): void => {
    setOpen(false);
  }, []);

  return { open, message, handleClose };
}
