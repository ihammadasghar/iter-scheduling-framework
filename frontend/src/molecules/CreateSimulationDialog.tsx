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
import { defineMessages, useIntl } from 'react-intl';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { createSimulationThunk } from '@/store/reducers/simulationSlice';
import { useNavigate } from 'react-router-dom';

const messages = defineMessages({
  creatingAriaLabel: {
    id: 'createSimulationDialog.creatingAriaLabel',
    defaultMessage: 'Creating simulation…',
  },
  title: {
    id: 'createSimulationDialog.title',
    defaultMessage: 'Request Changes',
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
    defaultMessage: 'Please enter your name to create a simulation.',
  },
  nameHelperText: {
    id: 'createSimulationDialog.nameHelperText',
    defaultMessage: 'Used to label your draft simulation',
  },
  cancel: {
    id: 'createSimulationDialog.cancel',
    defaultMessage: 'Cancel',
  },
  startRequest: {
    id: 'createSimulationDialog.startRequest',
    defaultMessage: 'Start Request',
  },
});

interface CreateSimulationDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

export default function CreateSimulationDialog({
  open,
  onClose,
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
      navigate(`/simulations/${result.payload.id}`);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      {loading && <LinearProgress aria-label={intl.formatMessage(messages.creatingAriaLabel)} />}
      <DialogTitle>{intl.formatMessage(messages.title)}</DialogTitle>
      <DialogContent sx={{ pt: '16px !important', display: 'flex', flexDirection: 'column', gap: 2 }}>
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
