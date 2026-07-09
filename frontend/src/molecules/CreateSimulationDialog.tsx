import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  TextField,
} from '@mui/material';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { createSimulationThunk } from '@/store/reducers/simulationSlice';
import { useNavigate } from 'react-router-dom';

interface CreateSimulationDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

export default function CreateSimulationDialog({
  open,
  onClose,
}: CreateSimulationDialogProps): React.ReactElement {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const loading = useAppSelector((state) => state.simulation.loading);

  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');

  const handleClose = (): void => {
    setName('');
    setNameError('');
    onClose();
  };

  const handleSubmit = async (): Promise<void> => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Please enter your name to create a simulation.');
      return;
    }
    setNameError('');

    const result = await dispatch(createSimulationThunk(trimmed));
    if (createSimulationThunk.fulfilled.match(result)) {
      handleClose();
      navigate(`/simulations/${result.payload.id}`);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      {loading && <LinearProgress aria-label="Creating simulation…" />}
      <DialogTitle>Create New Simulation</DialogTitle>
      <DialogContent sx={{ pt: '16px !important', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          label="Your name"
          placeholder="e.g. Alice"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleSubmit(); }}
          error={Boolean(nameError)}
          helperText={nameError || 'Used to label your draft simulation'}
          disabled={loading}
          autoFocus
          slotProps={{ htmlInput: { 'aria-label': 'Your name' } }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={handleClose} variant="outlined" disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={() => void handleSubmit()}
          variant="contained"
          disabled={loading || !name.trim()}
        >
          Create Simulation
        </Button>
      </DialogActions>
    </Dialog>
  );
}
