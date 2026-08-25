import { Alert, Snackbar } from '@mui/material';
import { useGlobalProposalStatusSnackbar } from '@/hooks/useGlobalProposalStatusSnackbar';

/**
 * Single global proposal-submission-result Snackbar — mount once in App.tsx,
 * alongside GlobalErrorSnackbar. Picks up `state.proposal.lastSubmission`
 * and displays it in plain English, from any page, since submission itself
 * (e.g. from the timetable HUD) and reviewing the result (e.g. switching to
 * admin view) can happen on different pages in quick succession.
 */
export default function GlobalProposalStatusSnackbar(): React.ReactElement {
  const { open, message, severity, handleClose } = useGlobalProposalStatusSnackbar();

  return (
    <Snackbar
      open={open}
      autoHideDuration={8000}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert severity={severity} variant="filled" onClose={handleClose} sx={{ width: '100%' }}>
        {message}
      </Alert>
    </Snackbar>
  );
}
