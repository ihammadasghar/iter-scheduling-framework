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
  Tooltip,
  Typography,
} from '@mui/material';
import { useAppDispatch } from '@/store/hooks';
import { createMetricRuleThunk, updateMetricRuleThunk } from '@/store/reducers/rulesSlice';
import {
  TARGET_OPTIONS,
  DIRECTION_OPTIONS,
  getConditionsByTarget,
  getDefaultDirection,
} from '@/utils/ruleLabels';
import type { RuleTarget } from '@/utils/ruleLabels';
import type { MetricDirection, MetricRule } from '@/types';

interface AddMetricDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onSuccess: () => void;
  // When set, the dialog edits this rule instead of creating a new one —
  // pre-filled from its current values, submitting via updateMetricRuleThunk
  // (same id) instead of createMetricRuleThunk.
  readonly existingRule?: MetricRule;
}

export default function AddMetricDialog({
  open,
  onClose,
  onSuccess,
  existingRule,
}: AddMetricDialogProps): React.ReactElement {
  const dispatch = useAppDispatch();
  const isEditMode = existingRule !== undefined;

  const [name, setName] = useState('');
  const [target, setTarget] = useState<RuleTarget>('Class');
  const [condition, setCondition] = useState('');
  const [threshold, setThreshold] = useState('');
  const [weight, setWeight] = useState('1');
  // '' represents "no preference (symmetric)" — the same as direction being
  // absent entirely; only a real MetricDirection value gets sent.
  const [direction, setDirection] = useState<MetricDirection | ''>('');
  const [loading, setLoading] = useState(false);
  const [nameError, setNameError] = useState(false);
  const [conditionError, setConditionError] = useState(false);
  const [weightError, setWeightError] = useState(false);

  const conditionOptions = getConditionsByTarget(target);
  const selectedCondition = conditionOptions.find((c) => c.value === condition);
  const unit = selectedCondition?.unit ?? '';

  // Pre-fills every field from the rule being edited, the moment the dialog
  // opens in edit mode — mirrors handleClose's blanking below, just
  // populating instead of resetting. Re-runs if `existingRule` itself
  // changes while open (e.g. a different row's Edit button is clicked next),
  // but never fights a user's in-progress edits since it's gated on `open`.
  useEffect(() => {
    if (open && existingRule) {
      setName(existingRule.name);
      setTarget(existingRule.target as RuleTarget);
      setCondition(existingRule.condition);
      setThreshold(String(existingRule.threshold));
      setWeight(String(existingRule.weight));
      setDirection(existingRule.direction ?? '');
    }
  }, [open, existingRule]);

  const handleTargetChange = (newTarget: RuleTarget): void => {
    setTarget(newTarget);
    setCondition(''); // reset condition when target changes
    setDirection('');
  };

  // Pre-fills direction from the catalog default for the newly selected
  // condition — but only here, at the moment the condition changes, so a
  // user's manual override afterward is never clobbered by a re-render.
  const handleConditionChange = (newCondition: string): void => {
    setCondition(newCondition);
    setDirection(getDefaultDirection(newCondition) ?? '');
  };

  const handleClose = (): void => {
    setName('');
    setTarget('Class');
    setCondition('');
    setThreshold('');
    setWeight('1');
    setDirection('');
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

    const params = {
      name: trimmedName,
      target,
      condition,
      threshold: Number(threshold) || 0,
      weight: parsedWeight,
      ...(direction !== '' ? { direction } : {}),
    };

    setLoading(true);
    const result = existingRule
      ? await dispatch(updateMetricRuleThunk({ id: existingRule.id, params }))
      : await dispatch(createMetricRuleThunk(params));
    setLoading(false);

    const succeeded = isEditMode
      ? updateMetricRuleThunk.fulfilled.match(result)
      : createMetricRuleThunk.fulfilled.match(result);
    if (succeeded) {
      handleClose();
      onSuccess();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEditMode ? 'Edit Metric Rule' : 'Add Metric Rule'}</DialogTitle>
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
            onChange={(e) => handleConditionChange(e.target.value)}
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

        <Tooltip title="Whether a higher or lower value is preferable — leave as 'No preference' for a value that should stay close to the target" placement="right">
          <FormControl fullWidth>
            <InputLabel id="metric-direction-label">Direction</InputLabel>
            <Select
              labelId="metric-direction-label"
              label="Direction"
              value={direction}
              onChange={(e) => setDirection(e.target.value as MetricDirection | '')}
            >
              <MenuItem value="">No preference (symmetric)</MenuItem>
              {DIRECTION_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Tooltip>

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
          {isEditMode ? 'Save Changes' : 'Add This Metric'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
