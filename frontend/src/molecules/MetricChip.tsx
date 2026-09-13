import { Chip, CircularProgress, Tooltip } from '@mui/material';
import { defineMessages, useIntl } from 'react-intl';
import type { MetricResult } from '@/types';

const messages = defineMessages({
  utilisationTooltip: {
    id: 'metricChip.utilisationTooltip',
    defaultMessage: 'Percentage of available room capacity currently in use',
  },
  gapTooltip: {
    id: 'metricChip.gapTooltip',
    defaultMessage: 'Average idle periods between classes for professors or groups',
  },
  conflictTooltip: {
    id: 'metricChip.conflictTooltip',
    defaultMessage: 'Number of hard scheduling conflicts in this timetable',
  },
  genericTooltip: {
    id: 'metricChip.genericTooltip',
    defaultMessage: 'Current value of the "{name}" metric',
  },
  loadingAriaLabel: {
    id: 'metricChip.loadingAriaLabel',
    defaultMessage: 'Loading {name}…',
  },
  valueLabel: {
    id: 'metricChip.valueLabel',
    defaultMessage: '{name}: {value}{unit}',
  },
});

interface MetricChipProps {
  readonly metric: MetricResult;
  readonly loading?: boolean;
}

export default function MetricChip({
  metric,
  loading = false,
}: MetricChipProps): React.ReactElement {
  const intl = useIntl();

  /** Derive a plain-language tooltip for a metric by name — best-effort from known names. */
  const getMetricTooltip = (name: string): string => {
    const lower = name.toLowerCase();
    if (lower.includes('utilisation') || lower.includes('utilization')) {
      return intl.formatMessage(messages.utilisationTooltip);
    }
    if (lower.includes('gap') || lower.includes('idle')) {
      return intl.formatMessage(messages.gapTooltip);
    }
    if (lower.includes('conflict')) {
      return intl.formatMessage(messages.conflictTooltip);
    }
    return intl.formatMessage(messages.genericTooltip, { name });
  };

  const valueLabel = intl.formatMessage(messages.valueLabel, { name: metric.name, value: metric.value, unit: metric.unit });
  const label = loading ? metric.name : valueLabel;

  return (
    <Tooltip title={getMetricTooltip(metric.name)} enterDelay={300}>
      <Chip
        label={label}
        variant="outlined"
        icon={loading ? <CircularProgress size={14} aria-label={intl.formatMessage(messages.loadingAriaLabel, { name: metric.name })} /> : undefined}
        sx={{ minHeight: 32 }}
        aria-label={valueLabel}
      />
    </Tooltip>
  );
}
