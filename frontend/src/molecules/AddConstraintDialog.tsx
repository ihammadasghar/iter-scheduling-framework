import { useState } from 'react';
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
import { useAppDispatch } from '@/store/hooks';
import { createConstraintThunk } from '@/store/reducers/rulesSlice';
import { TARGET_OPTIONS, VIOLATION_CONDITION_OPTIONS } from '@/utils/ruleLabels';
import type { RuleTarget } from '@/utils/ruleLabels';

interface AddConstraintDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onSuccess: () => void;
}

export default function AddConstraintDialog({
  open,
  onClose,
  onSuccess,
}: AddConstraintDialogProps): React.ReactElement {
  const dispatch = useAppDispatch();

  const [name, setName] = useState('');
  const [target, setTarget] = useState<RuleTarget>('classes');
  const [violationCondition, setViolationCondition] = useState('');
  const [loading, setLoading] = useState(false);
  const [nameError, setNameError] = useState(false);
  const [conditionError, setConditionError] = useState(false);

  const handleClose = (): void => {
    setName('');
    setTarget('classes');
    setViolationCondition('');
    setNameError(false);
    setConditionError(false);
    onClose();
  };

  const handleSubmit = async (): Promise<void> => {
    const trimmedName = name.trim();
    const hasNameError = trimmedName === '';
    const hasConditionError = violationCondition === '';
    setNameError(hasNameError);
    setConditionError(hasConditionError);
    if (hasNameError || hasConditionError) return;

    setLoading(true);
    const result = await dispatch(createConstraintThunk({
      name: trimmedName,
      target,
      violationCondition,
    }));
    setLoading(false);

    if (createConstraintThunk.fulfilled.match(result)) {
      handleClose();
      onSuccess();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Hard Constraint</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: '16px !important' }}>
        <TextField
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={nameError}
          helperText={nameError ? 'Name is required' : ''}
          required
          fullWidth
        />

        <FormControl fullWidth required>
          <InputLabel id="constraint-target-label">Applies to</InputLabel>
          <Select
            labelId="constraint-target-label"
            label="Applies to"
            value={target}
            onChange={(e) => setTarget(e.target.value as RuleTarget)}
          >
            {TARGET_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth required error={conditionError}>
          <InputLabel id="constraint-condition-label">Block proposal when</InputLabel>
          <Select
            labelId="constraint-condition-label"
            label="Block proposal when"
            value={violationCondition}
            onChange={(e) => setViolationCondition(e.target.value)}
          >
            {VIOLATION_CONDITION_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
            ))}
          </Select>
          {conditionError && (
            <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
              Please select a condition
            </Typography>
          )}
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} /> : undefined}
        >
          Add Constraint
        </Button>
      </DialogActions>
    </Dialog>
  );
}
