import { Chip, CircularProgress, Tooltip } from '@mui/material';
import type { MetricResult } from '@/types';

interface MetricChipProps {
  readonly metric: MetricResult;
  readonly loading?: boolean;
}

/** Derive a plain English tooltip for a metric by name — best-effort from known names. */
const getMetricTooltip = (name: string): string => {
  const lower = name.toLowerCase();
  if (lower.includes('utilisation') || lower.includes('utilization')) {
    return 'Percentage of available room capacity currently in use';
  }
  if (lower.includes('gap') || lower.includes('idle')) {
    return 'Average idle periods between classes for professors or groups';
  }
  if (lower.includes('conflict')) {
    return 'Number of hard scheduling conflicts in this timetable';
  }
  return `Current value of the "${name}" metric`;
};

export default function MetricChip({
  metric,
  loading = false,
}: MetricChipProps): React.ReactElement {
  const label = loading
    ? metric.name
    : `${metric.name}: ${metric.value}${metric.unit}`;

  return (
    <Tooltip title={getMetricTooltip(metric.name)} enterDelay={300}>
      <Chip
        label={label}
        variant="outlined"
        icon={loading ? <CircularProgress size={14} aria-label={`Loading ${metric.name}…`} /> : undefined}
        sx={{ minHeight: 32 }}
        aria-label={`${metric.name}: ${metric.value}${metric.unit}`}
      />
    </Tooltip>
  );
}
