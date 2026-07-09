import { Alert, Snackbar } from '@mui/material';
import { useGlobalErrorSnackbar } from '@/hooks/useGlobalErrorSnackbar';

/**
 * Single global error Snackbar — mount once in App.tsx.
 * Picks up any `error` field from the Redux store and displays it in plain English.
 */
export default function GlobalErrorSnackbar(): React.ReactElement {
  const { open, message, handleClose } = useGlobalErrorSnackbar();

  return (
    <Snackbar
      open={open}
      autoHideDuration={8000}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
    >
      <Alert severity="error" onClose={handleClose} sx={{ width: '100%' }}>
        {message}
      </Alert>
    </Snackbar>
  );
}
