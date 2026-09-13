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
import { defineMessages, useIntl } from 'react-intl';
import { useAppSelector } from '@/store/hooks';

const messages = defineMessages({
  title: {
    id: 'proposalForm.title',
    defaultMessage: 'Submit Proposal for Review',
  },
  conflictWarning: {
    id: 'proposalForm.conflictWarning',
    defaultMessage: 'Your draft has {count, plural, one {# scheduling conflict} other {# scheduling conflicts}}. The scheduling office will see these and may ask you to fix them before approving.',
  },
  explainLabel: {
    id: 'proposalForm.explainLabel',
    defaultMessage: 'Explain your changes',
  },
  explainPlaceholder: {
    id: 'proposalForm.explainPlaceholder',
    defaultMessage: 'Describe what you changed and why — e.g. moved Biology 101 to Tuesday to resolve a room conflict with Chemistry.',
  },
  descriptionRequiredError: {
    id: 'proposalForm.descriptionRequiredError',
    defaultMessage: 'Please describe your changes before submitting.',
  },
  helperText: {
    id: 'proposalForm.helperText',
    defaultMessage: 'Required — this helps the scheduling office review your proposal.',
  },
  cancel: {
    id: 'proposalForm.cancel',
    defaultMessage: 'Cancel',
  },
  submitting: {
    id: 'proposalForm.submitting',
    defaultMessage: 'Submitting…',
  },
  submitForReview: {
    id: 'proposalForm.submitForReview',
    defaultMessage: 'Submit for Review →',
  },
  submitAriaLabel: {
    id: 'proposalForm.submitAriaLabel',
    defaultMessage: 'Submit proposal for review',
  },
});

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
  const intl = useIntl();
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
      setDescriptionError(intl.formatMessage(messages.descriptionRequiredError));
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
      <DialogTitle id="proposal-form-title">{intl.formatMessage(messages.title)}</DialogTitle>
      <DialogContent
        sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}
      >
        {conflictCount > 0 && (
          <Alert severity="warning">
            {intl.formatMessage(messages.conflictWarning, { count: conflictCount })}
          </Alert>
        )}

        <TextField
          label={intl.formatMessage(messages.explainLabel)}
          placeholder={intl.formatMessage(messages.explainPlaceholder)}
          multiline
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          error={Boolean(descriptionError)}
          helperText={descriptionError || intl.formatMessage(messages.helperText)}
          disabled={submitting}
          slotProps={{ htmlInput: { 'aria-label': intl.formatMessage(messages.explainLabel) } }}
          autoFocus
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={handleClose} variant="outlined" disabled={submitting}>
          {intl.formatMessage(messages.cancel)}
        </Button>
        <Button
          variant="contained"
          size="large"
          onClick={() => void handleSubmit()}
          disabled={submitting || !description.trim()}
          startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : undefined}
          aria-label={intl.formatMessage(messages.submitAriaLabel)}
        >
          {submitting ? intl.formatMessage(messages.submitting) : intl.formatMessage(messages.submitForReview)}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
