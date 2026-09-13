import { Alert, Box, Button } from '@mui/material';
import { defineMessages, useIntl } from 'react-intl';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { commitSimulationThunk } from '@/store/reducers/classSlice';

const messages = defineMessages({
  saveNow: {
    id: 'inactivityBanner.saveNow',
    defaultMessage: 'Save Now',
  },
  dismiss: {
    id: 'inactivityBanner.dismiss',
    defaultMessage: 'Dismiss',
  },
  body: {
    id: 'inactivityBanner.body',
    defaultMessage: "You've been away for a while. To avoid losing any unsaved changes, save your draft now or make an edit to keep your session active.",
  },
});

interface InactivityBannerProps {
  readonly simId: string;
  readonly onDismiss: () => void;
}

export default function InactivityBanner({
  simId,
  onDismiss,
}: InactivityBannerProps): React.ReactElement {
  const intl = useIntl();
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
            {intl.formatMessage(messages.saveNow)}
          </Button>
          <Button
            variant="text"
            size="small"
            color="inherit"
            onClick={onDismiss}
          >
            {intl.formatMessage(messages.dismiss)}
          </Button>
        </Box>
      }
      sx={{ borderRadius: 0 }}
    >
      {intl.formatMessage(messages.body)}
    </Alert>
  );
}
