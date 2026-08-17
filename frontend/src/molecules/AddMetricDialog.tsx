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
  Tooltip,
  Typography,
} from '@mui/material';
import { useAppDispatch } from '@/store/hooks';
import { createMetricRuleThunk } from '@/store/reducers/rulesSlice';
import {
  TARGET_OPTIONS,
  getConditionsByTarget,
} from '@/utils/ruleLabels';
import type { RuleTarget } from '@/utils/ruleLabels';

interface AddMetricDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onSuccess: () => void;
}

export default function AddMetricDialog({
  open,
  onClose,
  onSuccess,
}: AddMetricDialogProps): React.ReactElement {
  const dispatch = useAppDispatch();

  const [name, setName] = useState('');
  const [target, setTarget] = useState<RuleTarget>('Class');
  const [condition, setCondition] = useState('');
  const [threshold, setThreshold] = useState('');
  const [weight, setWeight] = useState('1');
  const [loading, setLoading] = useState(false);
  const [nameError, setNameError] = useState(false);
  const [conditionError, setConditionError] = useState(false);
  const [weightError, setWeightError] = useState(false);

  const conditionOptions = getConditionsByTarget(target);
  const selectedCondition = conditionOptions.find((c) => c.value === condition);
  const unit = selectedCondition?.unit ?? '';

  const handleTargetChange = (newTarget: RuleTarget): void => {
    setTarget(newTarget);
    setCondition(''); // reset condition when target changes
  };

  const handleClose = (): void => {
    setName('');
    setTarget('Class');
    setCondition('');
    setThreshold('');
    setWeight('1');
    setNameError(false);
    setConditionError(false);
    setWeightError(false);
    onClose();
  };

  const handleSubmit = async (): Promise<void> => {
    const trimmedName = name.trim();
    const parsedWeight = Number(weight);
    const hasNameError = trimmedName === '';
    const hasConditionError = condition === '';
    const hasWeightError = !Number.isFinite(parsedWeight) || parsedWeight <= 0;
    setNameError(hasNameError);
    setConditionError(hasConditionError);
    setWeightError(hasWeightError);
    if (hasNameError || hasConditionError || hasWeightError) return;

    setLoading(true);
    const result = await dispatch(createMetricRuleThunk({
      name: trimmedName,
      target,
      condition,
      threshold: Number(threshold) || 0,
      weight: parsedWeight,
    }));
    setLoading(false);

    if (createMetricRuleThunk.fulfilled.match(result)) {
      handleClose();
      onSuccess();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Metric Rule</DialogTitle>
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

        <Tooltip title="Choose the type of resource this metric measures" placement="right">
          <FormControl fullWidth required>
            <InputLabel id="metric-target-label">What to measure</InputLabel>
            <Select
              labelId="metric-target-label"
              label="What to measure"
              value={target}
              onChange={(e) => handleTargetChange(e.target.value as RuleTarget)}
            >
              {TARGET_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Tooltip>

        <FormControl fullWidth required error={conditionError}>
          <InputLabel id="metric-condition-label">How to measure it</InputLabel>
          <Select
            labelId="metric-condition-label"
            label="How to measure it"
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            disabled={conditionOptions.length === 0}
          >
            {conditionOptions.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
            ))}
          </Select>
          {conditionError && (
            <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
              Please select a condition
            </Typography>
          )}
        </FormControl>

        <TextField
          label={unit ? `Target value (${unit})` : 'Target value'}
          type="number"
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          slotProps={{ htmlInput: { min: 0 } }}
          fullWidth
        />

        <Tooltip title="How much this metric should count toward the overall institution score, relative to other metrics" placement="right">
          <TextField
            label="Weight"
            type="number"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            error={weightError}
            helperText={weightError ? 'Weight must be a positive number' : ''}
            slotProps={{ htmlInput: { min: 0, step: 'any' } }}
            required
            fullWidth
          />
        </Tooltip>
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
          Add This Metric
        </Button>
      </DialogActions>
    </Dialog>
  );
}
