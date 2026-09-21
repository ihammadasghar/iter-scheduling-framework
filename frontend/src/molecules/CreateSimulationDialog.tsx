import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  LinearProgress,
  TextField,
} from '@mui/material';
import { defineMessages, useIntl } from 'react-intl';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { createSimulationThunk } from '@/store/reducers/simulationSlice';
import { useNavigate } from 'react-router-dom';

const messages = defineMessages({
  creatingAriaLabel: {
    id: 'createSimulationDialog.creatingAriaLabel',
    defaultMessage: 'Creating proposal…',
  },
  title: {
    id: 'createSimulationDialog.title',
    defaultMessage: 'Propose a Change',
  },
  description: {
    id: 'createSimulationDialog.description',
    defaultMessage: "You'll edit the schedule directly — no need to describe changes in words.",
  },
  nameLabel: {
    id: 'createSimulationDialog.nameLabel',
    defaultMessage: 'Your name',
  },
  namePlaceholder: {
    id: 'createSimulationDialog.namePlaceholder',
    defaultMessage: 'e.g. Alice',
  },
  nameRequiredError: {
    id: 'createSimulationDialog.nameRequiredError',
    defaultMessage: 'Please enter your name to create a proposal.',
  },
  nameHelperText: {
    id: 'createSimulationDialog.nameHelperText',
    defaultMessage: 'Used to label your draft proposal',
  },
  cancel: {
    id: 'createSimulationDialog.cancel',
    defaultMessage: 'Cancel',
  },
  startRequest: {
    id: 'createSimulationDialog.startRequest',
    defaultMessage: 'Start Proposal',
  },
});

interface CreateSimulationDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  // Set when this dialog was opened from a specific class's "Edit in a
  // Simulation" action (e.g. ClassDetailModal on the dashboard) — on success,
  // carries the class through so the new simulation can jump straight into
  // editing it instead of landing on the plain workspace view.
  readonly targetClassId?: string;
}

export default function CreateSimulationDialog({
  open,
  onClose,
  targetClassId,
}: CreateSimulationDialogProps): React.ReactElement {
  const intl = useIntl();
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
      setNameError(intl.formatMessage(messages.nameRequiredError));
      return;
    }
    setNameError('');

    const result = await dispatch(createSimulationThunk(trimmed));
    if (createSimulationThunk.fulfilled.match(result)) {
      handleClose();
      navigate(`/simulations/${result.payload.id}`, {
        state: targetClassId !== undefined ? { autoEditClassId: targetClassId } : undefined,
      });
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      {loading && <LinearProgress aria-label={intl.formatMessage(messages.creatingAriaLabel)} />}
      <DialogTitle>{intl.formatMessage(messages.title)}</DialogTitle>
      <DialogContent sx={{ pt: '16px !important', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <DialogContentText>{intl.formatMessage(messages.description)}</DialogContentText>
        <TextField
          label={intl.formatMessage(messages.nameLabel)}
          placeholder={intl.formatMessage(messages.namePlaceholder)}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleSubmit(); }}
          error={Boolean(nameError)}
          helperText={nameError || intl.formatMessage(messages.nameHelperText)}
          disabled={loading}
          autoFocus
          slotProps={{ htmlInput: { 'aria-label': intl.formatMessage(messages.nameLabel) } }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={handleClose} variant="outlined" disabled={loading}>
          {intl.formatMessage(messages.cancel)}
        </Button>
        <Button
          onClick={() => void handleSubmit()}
          variant="contained"
          disabled={loading || !name.trim()}
        >
          {intl.formatMessage(messages.startRequest)}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
