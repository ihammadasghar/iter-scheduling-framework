import { Box, Button, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import { CheckCircle, WarningAmber, ArrowDownward } from '@mui/icons-material';
import { formatTimeSlotFull } from '@/utils/scheduleFormatters';
import { useScheduleNames } from '@/hooks/useScheduleNames';
import type { ScoreDelta } from '@/hooks/useApplySuggestion';
import type { Suggestion, MetricDelta, ScheduleClass } from '@/types';

interface SuggestionCardProps {
  readonly suggestion: Suggestion;
  // The class this suggestion applies to, at its current room/time — shown
  // alongside the suggested slot so it reads as a change, not a slot in
  // isolation.
  readonly currentClass: ScheduleClass;
  readonly onApply: () => void;
  readonly applying: boolean;
  readonly metricDelta?: MetricDelta;
  readonly scoreDelta?: ScoreDelta;
  readonly loadingDelta: boolean;
}

export const DeltaChip = ({ delta }: { delta: MetricDelta }): React.ReactElement => {
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

export const ScoreDeltaChip = ({ delta }: { delta: ScoreDelta }): React.ReactElement => {
  const diff = delta.after - delta.before;
  const improved = diff > 0;
  const label = `${improved ? '+' : ''}${diff.toFixed(1)} score`;
  return (
    <Chip
      label={label}
      size="small"
      color={improved ? 'success' : 'error'}
      variant="outlined"
      aria-label={`Institution score change: ${label}`}
    />
  );
};

export default function SuggestionCard({
  suggestion,
  currentClass,
  onApply,
  applying,
  metricDelta,
  scoreDelta,
  loadingDelta,
}: SuggestionCardProps): React.ReactElement {
  const { roomName } = useScheduleNames();
  const roomLabel = roomName(suggestion.roomId);
  const timeLabels = [...suggestion.timeSlotIds].map(formatTimeSlotFull).join(', ');
  const currentRoomLabel = roomName(currentClass.roomId);
  const currentTimeLabels = [...currentClass.timeSlotIds].map(formatTimeSlotFull).join(', ') || 'no time set';

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
      {/* Before/after comparison — this is the change applying will make, not a slot in isolation */}
      <Stack spacing={0.25}>
        <Typography variant="caption" color="text.secondary">
          Currently: {currentRoomLabel} · {currentTimeLabels}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <ArrowDownward fontSize="inherit" color="primary" aria-hidden />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Move to {roomLabel} · {timeLabels}
          </Typography>
        </Box>
      </Stack>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        {suggestion.conflictFree ? (
          <Chip
            icon={<CheckCircle />}
            label="No conflicts"
            size="small"
            color="success"
            variant="outlined"
          />
        ) : (
          <Chip
            icon={<WarningAmber />}
            label="May still conflict"
            size="small"
            color="warning"
            variant="outlined"
          />
        )}

        {loadingDelta && <CircularProgress size={16} aria-label="Computing metric impact…" />}
        {!loadingDelta && metricDelta !== undefined && <DeltaChip delta={metricDelta} />}
        {!loadingDelta && scoreDelta !== undefined && <ScoreDeltaChip delta={scoreDelta} />}
      </Box>

      <Button
        variant="contained"
        size="small"
        onClick={onApply}
        disabled={applying}
        startIcon={applying ? <CircularProgress size={14} color="inherit" /> : undefined}
        aria-label={`Move ${currentClass.title} to ${roomLabel} at ${timeLabels}`}
        sx={{ alignSelf: 'flex-start', mt: 0.5 }}
      >
        {applying ? 'Applying…' : `Move to ${roomLabel}`}
      </Button>
    </Box>
  );
}
