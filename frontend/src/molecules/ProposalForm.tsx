import { useState } from 'react';
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';
import { useAppSelector } from '@/store/hooks';

interface ProposalFormProps {
  readonly open: boolean;
  readonly onSubmit: (description: string) => Promise<void>;
  readonly onClose: () => void;
}

export default function ProposalForm({
  open,
  onSubmit,
  onClose,
}: ProposalFormProps): React.ReactElement {
  const conflictCount = useAppSelector((s) => s.conflict.conflicts.length);

  const [description, setDescription] = useState('');
  const [descriptionError, setDescriptionError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleClose = (): void => {
    setDescription('');
    setDescriptionError('');
    onClose();
  };

  const handleSubmit = async (): Promise<void> => {
    const trimmed = description.trim();
    if (!trimmed) {
      setDescriptionError('Please describe your changes before submitting.');
      return;
    }
    setDescriptionError('');
    setSubmitting(true);
    await onSubmit(trimmed);
    setSubmitting(false);
    setDescription('');
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="proposal-form-title"
    >
      <DialogTitle id="proposal-form-title">Submit Proposal for Review</DialogTitle>
      <DialogContent
        sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}
      >
        {conflictCount > 0 && (
          <Alert severity="warning">
            Your draft has {conflictCount} scheduling conflict
            {conflictCount === 1 ? '' : 's'}. The scheduling office will see these and may ask
            you to fix them before approving.
          </Alert>
        )}

        <TextField
          label="Explain your changes"
          placeholder="Describe what you changed and why — e.g. moved Biology 101 to Tuesday to resolve a room conflict with Chemistry."
          multiline
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          error={Boolean(descriptionError)}
          helperText={descriptionError || 'Required — this helps the scheduling office review your proposal.'}
          disabled={submitting}
          slotProps={{ htmlInput: { 'aria-label': 'Explain your changes' } }}
          autoFocus
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={handleClose} variant="outlined" disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          size="large"
          onClick={() => void handleSubmit()}
          disabled={submitting || !description.trim()}
          startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : undefined}
          aria-label="Submit proposal for review"
        >
          {submitting ? 'Submitting…' : 'Submit for Review →'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
