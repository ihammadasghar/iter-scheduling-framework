import { useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import { defineMessages, useIntl } from 'react-intl';
import { useAppDispatch } from '@/store/hooks';
import { deleteSimulationThunk } from '@/store/reducers/simulationSlice';

const messages = defineMessages({
  title: {
    id: 'deleteSimulationDialog.title',
    defaultMessage: 'Delete this draft?',
  },
  body: {
    id: 'deleteSimulationDialog.body',
    defaultMessage: 'Are you sure you want to delete this draft? This cannot be undone.',
  },
  error: {
    id: 'deleteSimulationDialog.error',
    defaultMessage: 'Could not delete — please try again later.',
  },
  cancel: {
    id: 'deleteSimulationDialog.cancel',
    defaultMessage: 'Cancel',
  },
  confirm: {
    id: 'deleteSimulationDialog.confirm',
    defaultMessage: 'Yes, Delete Draft',
  },
});

interface DeleteSimulationDialogProps {
  readonly open: boolean;
  readonly simulationId: string;
  readonly onClose: () => void;
}

export default function DeleteSimulationDialog({
  open,
  simulationId,
  onClose,
}: DeleteSimulationDialogProps): React.ReactElement {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleClose = (): void => {
    setError('');
    onClose();
  };

  const handleConfirm = async (): Promise<void> => {
    setLoading(true);
    setError('');

    const result = await dispatch(deleteSimulationThunk(simulationId));

    setLoading(false);
    if (deleteSimulationThunk.fulfilled.match(result)) {
      handleClose();
    } else {
      setError(intl.formatMessage(messages.error));
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>{intl.formatMessage(messages.title)}</DialogTitle>
      <DialogContent sx={{ pt: '16px !important', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="body1">
          {intl.formatMessage(messages.body)}
        </Typography>
        {error && (
          <Alert severity="error" onClose={() => setError('')}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={handleClose} variant="outlined" disabled={loading}>
          {intl.formatMessage(messages.cancel)}
        </Button>
        <Button
          onClick={() => void handleConfirm()}
          variant="contained"
          color="error"
          disabled={loading}
        >
          {intl.formatMessage(messages.confirm)}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
