import { useEffect, useState } from 'react';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { defineMessages, useIntl } from 'react-intl';
import { useAppDispatch } from '@/store/hooks';
import { createConstraintThunk, updateConstraintThunk } from '@/store/reducers/rulesSlice';
import { getTargetOptions, getViolationConditionOptions, needsLimit } from '@/utils/ruleLabels';
import type { RuleTarget } from '@/utils/ruleLabels';
import type { Constraint } from '@/types';

const messages = defineMessages({
  editTitle: {
    id: 'addConstraintDialog.editTitle',
    defaultMessage: 'Edit Scheduling Rule',
  },
  addTitle: {
    id: 'addConstraintDialog.addTitle',
    defaultMessage: 'Add Scheduling Rule',
  },
  nameLabel: {
    id: 'addConstraintDialog.nameLabel',
    defaultMessage: 'Name',
  },
  nameRequired: {
    id: 'addConstraintDialog.nameRequired',
    defaultMessage: 'Name is required',
  },
  appliesToLabel: {
    id: 'addConstraintDialog.appliesToLabel',
    defaultMessage: 'Applies to',
  },
  blockWhenLabel: {
    id: 'addConstraintDialog.blockWhenLabel',
    defaultMessage: 'Block proposal when',
  },
  selectConditionError: {
    id: 'addConstraintDialog.selectConditionError',
    defaultMessage: 'Please select a condition',
  },
  limitLabel: {
    id: 'addConstraintDialog.limitLabel',
    defaultMessage: 'Limit',
  },
  limitError: {
    id: 'addConstraintDialog.limitError',
    defaultMessage: 'Limit must be a positive whole number',
  },
  cancel: {
    id: 'addConstraintDialog.cancel',
    defaultMessage: 'Cancel',
  },
  saveChanges: {
    id: 'addConstraintDialog.saveChanges',
    defaultMessage: 'Save Changes',
  },
  addConstraint: {
    id: 'addConstraintDialog.addConstraint',
    defaultMessage: 'Add Rule',
  },
});

interface AddConstraintDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onSuccess: () => void;
  // When set, the dialog edits this constraint instead of creating a new
  // one — pre-filled from its current values, submitting via
  // updateConstraintThunk (same id) instead of createConstraintThunk.
  readonly existingRule?: Constraint;
}

export default function AddConstraintDialog({
  open,
  onClose,
  onSuccess,
  existingRule,
}: AddConstraintDialogProps): React.ReactElement {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const isEditMode = existingRule !== undefined;

  const [name, setName] = useState('');
  const [target, setTarget] = useState<RuleTarget>('Class');
  const [violationCondition, setViolationCondition] = useState('');
  const [limit, setLimit] = useState('');
  const [loading, setLoading] = useState(false);
  const [nameError, setNameError] = useState(false);
  const [conditionError, setConditionError] = useState(false);
  const [limitError, setLimitError] = useState(false);

  const limitRequired = needsLimit(violationCondition);

  // Pre-fills every field from the constraint being edited, the moment the
  // dialog opens in edit mode — mirrors handleClose's blanking below, just
  // populating instead of resetting.
  useEffect(() => {
    if (open && existingRule) {
      setName(existingRule.name);
      setTarget(existingRule.target as RuleTarget);
      setViolationCondition(existingRule.violationCondition);
      setLimit(existingRule.limit !== undefined ? String(existingRule.limit) : '');
    }
  }, [open, existingRule]);

  const handleClose = (): void => {
    setName('');
    setTarget('Class');
    setViolationCondition('');
    setLimit('');
    setNameError(false);
    setConditionError(false);
    setLimitError(false);
    onClose();
  };

  const handleSubmit = async (): Promise<void> => {
    const trimmedName = name.trim();
    const parsedLimit = Number(limit);
    const hasNameError = trimmedName === '';
    const hasConditionError = violationCondition === '';
    const hasLimitError = limitRequired && (!Number.isInteger(parsedLimit) || parsedLimit <= 0);
    setNameError(hasNameError);
    setConditionError(hasConditionError);
    setLimitError(hasLimitError);
    if (hasNameError || hasConditionError || hasLimitError) return;

    const params = {
      name: trimmedName,
      target,
      violationCondition,
      ...(limitRequired ? { limit: parsedLimit } : {}),
    };

    setLoading(true);
    const result = existingRule
      ? await dispatch(updateConstraintThunk({ id: existingRule.id, params }))
      : await dispatch(createConstraintThunk(params));
    setLoading(false);

    const succeeded = isEditMode
      ? updateConstraintThunk.fulfilled.match(result)
      : createConstraintThunk.fulfilled.match(result);
    if (succeeded) {
      handleClose();
      onSuccess();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{intl.formatMessage(isEditMode ? messages.editTitle : messages.addTitle)}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: '16px !important' }}>
        <TextField
          label={intl.formatMessage(messages.nameLabel)}
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={nameError}
          helperText={nameError ? intl.formatMessage(messages.nameRequired) : ''}
          required
          fullWidth
        />

        <FormControl fullWidth required>
          <InputLabel id="constraint-target-label">{intl.formatMessage(messages.appliesToLabel)}</InputLabel>
          <Select
            labelId="constraint-target-label"
            label={intl.formatMessage(messages.appliesToLabel)}
            value={target}
            onChange={(e) => setTarget(e.target.value as RuleTarget)}
          >
            {getTargetOptions(intl).map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth required error={conditionError}>
          <InputLabel id="constraint-condition-label">{intl.formatMessage(messages.blockWhenLabel)}</InputLabel>
          <Select
            labelId="constraint-condition-label"
            label={intl.formatMessage(messages.blockWhenLabel)}
            value={violationCondition}
            onChange={(e) => {
              setViolationCondition(e.target.value);
              // Reset the limit when switching to a condition that doesn't
              // use one, so a stale value/error can't linger unseen.
              if (!needsLimit(e.target.value)) {
                setLimit('');
                setLimitError(false);
              }
            }}
          >
            {getViolationConditionOptions(intl).map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
            ))}
          </Select>
          {conditionError && (
            <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
              {intl.formatMessage(messages.selectConditionError)}
            </Typography>
          )}
        </FormControl>

        {limitRequired && (
          <TextField
            label={intl.formatMessage(messages.limitLabel)}
            type="number"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            error={limitError}
            helperText={limitError ? intl.formatMessage(messages.limitError) : ''}
            slotProps={{ htmlInput: { min: 1, step: 1 } }}
            required
            fullWidth
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          {intl.formatMessage(messages.cancel)}
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} /> : undefined}
        >
          {intl.formatMessage(isEditMode ? messages.saveChanges : messages.addConstraint)}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
