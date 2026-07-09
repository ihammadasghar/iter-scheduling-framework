import { Alert, Box, Button } from '@mui/material';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { commitSimulationThunk } from '@/store/reducers/classSlice';

interface InactivityBannerProps {
  readonly simId: string;
  readonly onDismiss: () => void;
}

export default function InactivityBanner({
  simId,
  onDismiss,
}: InactivityBannerProps): React.ReactElement {
  const dispatch = useAppDispatch();
  const commitLoading = useAppSelector((s) => s.class.loading);

  const handleSaveNow = (): void => {
    void dispatch(commitSimulationThunk(simId));
  };

  return (
    <Alert
      severity="warning"
      role="status"
      aria-live="polite"
      action={
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="text"
            size="small"
            color="inherit"
            onClick={handleSaveNow}
            disabled={commitLoading}
          >
            Save Now
          </Button>
          <Button
            variant="text"
            size="small"
            color="inherit"
            onClick={onDismiss}
          >
            Dismiss
          </Button>
        </Box>
      }
      sx={{ borderRadius: 0 }}
    >
      You&apos;ve been away for a while. To avoid losing any unsaved changes, save your draft now
      or make an edit to keep your session active.
    </Alert>
  );
}
