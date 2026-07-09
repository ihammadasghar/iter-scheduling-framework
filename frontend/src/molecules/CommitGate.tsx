import { useState } from 'react';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import { useAppDispatch } from '@/store/hooks';
import { commitSimulationThunk } from '@/store/reducers/classSlice';

interface CommitGateProps {
  readonly open: boolean;
  readonly simId: string;
  readonly onSaved: () => void;
  readonly onSkip: () => void;
  readonly onClose: () => void;
}

export default function CommitGate({
  open,
  simId,
  onSaved,
  onSkip,
  onClose,
}: CommitGateProps): React.ReactElement {
  const dispatch = useAppDispatch();
  const [saving, setSaving] = useState(false);

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    const result = await dispatch(commitSimulationThunk(simId));
    setSaving(false);
    if (commitSimulationThunk.fulfilled.match(result)) {
      onSaved();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="commit-gate-title"
    >
      <DialogTitle id="commit-gate-title">Unsaved Changes</DialogTitle>
      <DialogContent>
        <Typography variant="body1">
          You have unsaved changes in this draft. Save them before submitting so nothing is lost.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3, gap: 1, flexWrap: 'wrap' }}>
        <Button variant="text" onClick={onSkip} disabled={saving}>
          Submit Without Saving
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleSave()}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {saving ? 'Saving…' : 'Save My Changes First'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
