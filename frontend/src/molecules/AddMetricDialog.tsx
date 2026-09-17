import { useEffect, useRef, useState } from 'react';
import {
  Box,
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
import { keyframes } from '@mui/material/styles';
import { defineMessages, useIntl } from 'react-intl';
import { useAppDispatch } from '@/store/hooks';
import { createMetricRuleThunk, updateMetricRuleThunk } from '@/store/reducers/rulesSlice';
import {
  getTargetOptions,
  getDirectionOptions,
  getConditionsByTarget,
  getDefaultDirection,
} from '@/utils/ruleLabels';
import type { RuleTarget } from '@/utils/ruleLabels';
import type { MetricDirection, MetricRule } from '@/types';

const messages = defineMessages({
  editTitle: {
    id: 'addMetricDialog.editTitle',
    defaultMessage: 'Edit Metric Rule',
  },
  addTitle: {
    id: 'addMetricDialog.addTitle',
    defaultMessage: 'Add Metric Rule',
  },
  nameLabel: {
    id: 'addMetricDialog.nameLabel',
    defaultMessage: 'Name',
  },
  nameRequired: {
    id: 'addMetricDialog.nameRequired',
    defaultMessage: 'Name is required',
  },
  whatToMeasureTooltip: {
    id: 'addMetricDialog.whatToMeasureTooltip',
    defaultMessage: 'Choose the type of resource this metric measures',
  },
  whatToMeasureLabel: {
    id: 'addMetricDialog.whatToMeasureLabel',
    defaultMessage: 'What to measure',
  },
  howToMeasureLabel: {
    id: 'addMetricDialog.howToMeasureLabel',
    defaultMessage: 'How to measure it',
  },
  selectConditionError: {
    id: 'addMetricDialog.selectConditionError',
    defaultMessage: 'Please select a condition',
  },
  targetChangedResetAnnouncement: {
    id: 'addMetricDialog.targetChangedResetAnnouncement',
    defaultMessage: 'Condition and Prefer were reset because What to measure changed.',
  },
  directionTooltip: {
    id: 'addMetricDialog.directionTooltip',
    defaultMessage: "Whether a higher or lower value is preferable — leave as 'No preference' for a value that should stay close to the target",
  },
  directionLabel: {
    id: 'addMetricDialog.directionLabel',
    defaultMessage: 'Prefer',
  },
  noPreference: {
    id: 'addMetricDialog.noPreference',
    defaultMessage: 'No preference (symmetric)',
  },
  conditionPrefilledAnnouncement: {
    id: 'addMetricDialog.conditionPrefilledAnnouncement',
    defaultMessage: 'Prefer was pre-filled based on the selected condition.',
  },
  targetValueWithUnit: {
    id: 'addMetricDialog.targetValueWithUnit',
    defaultMessage: 'Target value ({unit})',
  },
  targetValue: {
    id: 'addMetricDialog.targetValue',
    defaultMessage: 'Target value',
  },
  weightTooltip: {
    id: 'addMetricDialog.weightTooltip',
    defaultMessage: 'How much this metric should count toward the overall institution score, relative to other metrics',
  },
  weightLabel: {
    id: 'addMetricDialog.weightLabel',
    defaultMessage: 'Weight',
  },
  weightError: {
    id: 'addMetricDialog.weightError',
    defaultMessage: 'Weight must be a positive number',
  },
  cancel: {
    id: 'addMetricDialog.cancel',
    defaultMessage: 'Cancel',
  },
  saveChanges: {
    id: 'addMetricDialog.saveChanges',
    defaultMessage: 'Save Changes',
  },
  addThisMetric: {
    id: 'addMetricDialog.addThisMetric',
    defaultMessage: 'Add This Metric',
  },
});

// Draws the eye to a downstream field when an upstream Select silently
// resets or repopulates it (cognitive-walkthrough finding, issue #13). Same
// idiom as EditAssignmentDialog's pulsePeriodHint / CalendarClassBlock's
// pulseHint.
const pulseDependentFieldHint = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.04); }
`;

// How long a dependent-field flash + its aria-live announcement stay active.
const DEPENDENT_FIELD_HINT_DURATION_MS = 1200;

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
  const intl = useIntl();
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

  // Flashes the Condition field for DEPENDENT_FIELD_HINT_DURATION_MS whenever
  // handleTargetChange resets it (and Direction). Timer-ref pattern mirrors
  // EditAssignmentDialog's periodHintTimerRef.
  const [targetHintActive, setTargetHintActive] = useState(false);
  const targetHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTargetHintTimer = (): void => {
    if (targetHintTimerRef.current !== null) {
      clearTimeout(targetHintTimerRef.current);
      targetHintTimerRef.current = null;
    }
  };
  useEffect(() => clearTargetHintTimer, []);

  // Flashes the Direction field for DEPENDENT_FIELD_HINT_DURATION_MS whenever
  // handleConditionChange auto-fills it with a catalog default.
  const [conditionHintActive, setConditionHintActive] = useState(false);
  const conditionHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearConditionHintTimer = (): void => {
    if (conditionHintTimerRef.current !== null) {
      clearTimeout(conditionHintTimerRef.current);
      conditionHintTimerRef.current = null;
    }
  };
  useEffect(() => clearConditionHintTimer, []);

  const conditionOptions = getConditionsByTarget(intl, target);
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

    // A new target invalidates any pending condition-autofill hint.
    clearConditionHintTimer();
    setConditionHintActive(false);

    clearTargetHintTimer();
    setTargetHintActive(true);
    targetHintTimerRef.current = setTimeout(() => {
      targetHintTimerRef.current = null;
      setTargetHintActive(false);
    }, DEPENDENT_FIELD_HINT_DURATION_MS);
  };

  // Pre-fills direction from the catalog default for the newly selected
  // condition — but only here, at the moment the condition changes, so a
  // user's manual override afterward is never clobbered by a re-render.
  const handleConditionChange = (newCondition: string): void => {
    setCondition(newCondition);
    const defaultDirection = getDefaultDirection(newCondition) ?? '';
    setDirection(defaultDirection);

    // A condition pick supersedes any still-active target-reset hint, so
    // Direction's announcement doesn't show a stale "target changed" message.
    clearTargetHintTimer();
    setTargetHintActive(false);

    clearConditionHintTimer();
    // Only flash Direction if it actually changed — some conditions (e.g.
    // count) have no catalog default, so nothing visually happened.
    if (defaultDirection !== '') {
      setConditionHintActive(true);
      conditionHintTimerRef.current = setTimeout(() => {
        conditionHintTimerRef.current = null;
        setConditionHintActive(false);
      }, DEPENDENT_FIELD_HINT_DURATION_MS);
    } else {
      setConditionHintActive(false);
    }
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
    clearTargetHintTimer();
    setTargetHintActive(false);
    clearConditionHintTimer();
    setConditionHintActive(false);
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

        <Tooltip title={intl.formatMessage(messages.whatToMeasureTooltip)} placement="right">
          <FormControl fullWidth required>
            <InputLabel id="metric-target-label">{intl.formatMessage(messages.whatToMeasureLabel)}</InputLabel>
            <Select
              labelId="metric-target-label"
              label={intl.formatMessage(messages.whatToMeasureLabel)}
              value={target}
              onChange={(e) => handleTargetChange(e.target.value as RuleTarget)}
            >
              {getTargetOptions(intl).map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Tooltip>

        <FormControl
          fullWidth
          required
          error={conditionError}
          sx={{
            border: targetHintActive ? 2 : 0,
            borderColor: targetHintActive ? 'info.main' : 'transparent',
            borderRadius: 1,
            transition: 'border-color 0.15s',
            animation: targetHintActive ? `${pulseDependentFieldHint} 0.5s ease-in-out 2` : undefined,
          }}
        >
          <InputLabel id="metric-condition-label">{intl.formatMessage(messages.howToMeasureLabel)}</InputLabel>
          <Select
            labelId="metric-condition-label"
            label={intl.formatMessage(messages.howToMeasureLabel)}
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
              {intl.formatMessage(messages.selectConditionError)}
            </Typography>
          )}
          {/* Non-visual equivalent of the flash above, for screen readers. */}
          <Box
            aria-live="polite"
            sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}
          >
            {targetHintActive ? intl.formatMessage(messages.targetChangedResetAnnouncement) : ''}
          </Box>
        </FormControl>

        <Tooltip title={intl.formatMessage(messages.directionTooltip)} placement="right">
          <FormControl
            fullWidth
            sx={{
              border: (targetHintActive || conditionHintActive) ? 2 : 0,
              borderColor: (targetHintActive || conditionHintActive) ? 'info.main' : 'transparent',
              borderRadius: 1,
              transition: 'border-color 0.15s',
              animation: (targetHintActive || conditionHintActive) ? `${pulseDependentFieldHint} 0.5s ease-in-out 2` : undefined,
            }}
          >
            <InputLabel id="metric-direction-label">{intl.formatMessage(messages.directionLabel)}</InputLabel>
            <Select
              labelId="metric-direction-label"
              label={intl.formatMessage(messages.directionLabel)}
              value={direction}
              onChange={(e) => setDirection(e.target.value as MetricDirection | '')}
            >
              <MenuItem value="">{intl.formatMessage(messages.noPreference)}</MenuItem>
              {getDirectionOptions(intl).map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
              ))}
            </Select>
            {/* Non-visual equivalent of the flash above, for screen readers. */}
            <Box
              aria-live="polite"
              sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}
            >
              {targetHintActive
                ? intl.formatMessage(messages.targetChangedResetAnnouncement)
                : conditionHintActive
                  ? intl.formatMessage(messages.conditionPrefilledAnnouncement)
                  : ''}
            </Box>
          </FormControl>
        </Tooltip>

        <TextField
          label={unit ? intl.formatMessage(messages.targetValueWithUnit, { unit }) : intl.formatMessage(messages.targetValue)}
          type="number"
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          slotProps={{ htmlInput: { min: 0 } }}
          fullWidth
        />

        <Tooltip title={intl.formatMessage(messages.weightTooltip)} placement="right">
          <TextField
            label={intl.formatMessage(messages.weightLabel)}
            type="number"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            error={weightError}
            helperText={weightError ? intl.formatMessage(messages.weightError) : ''}
            slotProps={{ htmlInput: { min: 0, step: 'any' } }}
            required
            fullWidth
          />
        </Tooltip>
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
          {intl.formatMessage(isEditMode ? messages.saveChanges : messages.addThisMetric)}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
