import { Box, Button, Chip, CircularProgress, Typography } from '@mui/material';
import { CheckCircle } from '@mui/icons-material';
import { formatRoomLabel, formatTimeSlotFull } from '@/utils/scheduleFormatters';
import type { Suggestion, MetricDelta } from '@/types';

interface SuggestionCardProps {
  readonly suggestion: Suggestion;
  readonly onApply: () => void;
  readonly applying: boolean;
  readonly metricDelta?: MetricDelta;
  readonly loadingDelta: boolean;
}

const DeltaChip = ({ delta }: { delta: MetricDelta }): React.ReactElement => {
  const diff = delta.after - delta.before;
  const improved = diff > 0;
  const label = `${improved ? '+' : ''}${diff.toFixed(1)}${delta.unit} ${delta.name}`;
  return (
    <Chip
      label={label}
      size="small"
      color={improved ? 'success' : 'error'}
      variant="outlined"
      aria-label={`Metric change: ${label}`}
    />
  );
};

export default function SuggestionCard({
  suggestion,
  onApply,
  applying,
  metricDelta,
  loadingDelta,
}: SuggestionCardProps): React.ReactElement {
  const roomLabel = formatRoomLabel(suggestion.roomId);
  const timeLabels = [...suggestion.timeSlotIds].map(formatTimeSlotFull).join(', ');

  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
    >
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {roomLabel}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {timeLabels}
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Chip
          icon={<CheckCircle />}
          label="No conflicts"
          size="small"
          color="success"
          variant="outlined"
        />

        {loadingDelta && <CircularProgress size={16} aria-label="Computing metric impact…" />}
        {!loadingDelta && metricDelta !== undefined && <DeltaChip delta={metricDelta} />}
      </Box>

      <Button
        variant="contained"
        size="small"
        onClick={onApply}
        disabled={applying}
        startIcon={applying ? <CircularProgress size={14} color="inherit" /> : undefined}
        aria-label={`Apply suggestion: ${roomLabel} at ${timeLabels}`}
        sx={{ alignSelf: 'flex-start', mt: 0.5 }}
      >
        {applying ? 'Applying…' : 'Apply'}
      </Button>
    </Box>
  );
}
