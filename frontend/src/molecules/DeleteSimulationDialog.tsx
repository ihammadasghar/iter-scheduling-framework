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
import { useAppDispatch } from '@/store/hooks';
import { deleteSimulationThunk } from '@/store/reducers/simulationSlice';

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
      // Gap 4: delete endpoint not yet implemented — show inline error rather than crashing
      setError('Could not delete — please try again later.');
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Delete this draft?</DialogTitle>
      <DialogContent sx={{ pt: '16px !important', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="body1">
          Are you sure you want to delete this draft? This cannot be undone.
        </Typography>
        {error && (
          <Alert severity="error" onClose={() => setError('')}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={handleClose} variant="outlined" disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={() => void handleConfirm()}
          variant="contained"
          color="error"
          disabled={loading}
        >
          Yes, Delete Draft
        </Button>
      </DialogActions>
    </Dialog>
  );
}
