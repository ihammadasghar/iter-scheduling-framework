import { Box, Button, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import { CheckCircle, WarningAmber, ArrowDownward } from '@mui/icons-material';
import { defineMessages, useIntl } from 'react-intl';
import { formatTimeSlotFull } from '@/utils/scheduleFormatters';
import { useScheduleNames } from '@/hooks/useScheduleNames';
import type { ScoreDelta } from '@/hooks/useApplySuggestion';
import type { Suggestion, MetricDelta, ScheduleClass } from '@/types';

const messages = defineMessages({
  metricChangeAriaLabel: {
    id: 'suggestionCard.metricChangeAriaLabel',
    defaultMessage: 'Metric change: {label}',
  },
  scoreLabel: {
    id: 'suggestionCard.scoreLabel',
    defaultMessage: '{sign}{diff} score',
  },
  scoreChangeAriaLabel: {
    id: 'suggestionCard.scoreChangeAriaLabel',
    defaultMessage: 'Institution score change: {label}',
  },
  noTimeSet: {
    id: 'suggestionCard.noTimeSet',
    defaultMessage: 'no time set',
  },
  currently: {
    id: 'suggestionCard.currently',
    defaultMessage: 'Currently: {room} · {time}',
  },
  moveTo: {
    id: 'suggestionCard.moveTo',
    defaultMessage: 'Move to {room} · {time}',
  },
  noConflicts: {
    id: 'suggestionCard.noConflicts',
    defaultMessage: 'No conflicts',
  },
  mayStillConflict: {
    id: 'suggestionCard.mayStillConflict',
    defaultMessage: 'May still conflict',
  },
  computingImpactAriaLabel: {
    id: 'suggestionCard.computingImpactAriaLabel',
    defaultMessage: 'Computing metric impact…',
  },
  moveButtonAriaLabel: {
    id: 'suggestionCard.moveButtonAriaLabel',
    defaultMessage: 'Move {title} to {room} at {time}',
  },
  applying: {
    id: 'suggestionCard.applying',
    defaultMessage: 'Applying…',
  },
  moveToButton: {
    id: 'suggestionCard.moveToButton',
    defaultMessage: 'Move to {room}',
  },
});

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
  const intl = useIntl();
  const diff = delta.after - delta.before;
  // 'lower_is_better' is the only direction that flips the comparison;
  // 'higher_is_better' and an absent direction both keep today's default —
  // see MetricDeltaTile.tsx's identical logic on the other MetricDelta path.
  const improved = delta.direction === 'lower_is_better' ? diff < 0 : diff > 0;
  const label = `${diff > 0 ? '+' : ''}${diff.toFixed(1)}${delta.unit} ${delta.name}`;
  return (
    <Chip
      label={label}
      size="small"
      color={improved ? 'success' : 'error'}
      variant="outlined"
      aria-label={intl.formatMessage(messages.metricChangeAriaLabel, { label })}
    />
  );
};

export const ScoreDeltaChip = ({ delta }: { delta: ScoreDelta }): React.ReactElement => {
  const intl = useIntl();
  const diff = delta.after - delta.before;
  const improved = diff > 0;
  const label = intl.formatMessage(messages.scoreLabel, { sign: improved ? '+' : '', diff: diff.toFixed(1) });
  return (
    <Chip
      label={label}
      size="small"
      color={improved ? 'success' : 'error'}
      variant="outlined"
      aria-label={intl.formatMessage(messages.scoreChangeAriaLabel, { label })}
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
  const intl = useIntl();
  const { roomName } = useScheduleNames();
  const roomLabel = roomName(suggestion.roomId);
  const timeLabels = [...suggestion.timeSlotIds].map(formatTimeSlotFull).join(', ');
  const currentRoomLabel = roomName(currentClass.roomId);
  const currentTimeLabels = [...currentClass.timeSlotIds].map(formatTimeSlotFull).join(', ') || intl.formatMessage(messages.noTimeSet);

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
          {intl.formatMessage(messages.currently, { room: currentRoomLabel, time: currentTimeLabels })}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <ArrowDownward fontSize="inherit" color="primary" aria-hidden />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {intl.formatMessage(messages.moveTo, { room: roomLabel, time: timeLabels })}
          </Typography>
        </Box>
      </Stack>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        {suggestion.conflictFree ? (
          <Chip
            icon={<CheckCircle />}
            label={intl.formatMessage(messages.noConflicts)}
            size="small"
            color="success"
            variant="outlined"
          />
        ) : (
          <Chip
            icon={<WarningAmber />}
            label={intl.formatMessage(messages.mayStillConflict)}
            size="small"
            color="warning"
            variant="outlined"
          />
        )}

        {loadingDelta && <CircularProgress size={16} aria-label={intl.formatMessage(messages.computingImpactAriaLabel)} />}
        {!loadingDelta && metricDelta !== undefined && <DeltaChip delta={metricDelta} />}
        {!loadingDelta && scoreDelta !== undefined && <ScoreDeltaChip delta={scoreDelta} />}
      </Box>

      <Button
        variant="contained"
        size="small"
        onClick={onApply}
        disabled={applying}
        startIcon={applying ? <CircularProgress size={14} color="inherit" /> : undefined}
        aria-label={intl.formatMessage(messages.moveButtonAriaLabel, { title: currentClass.title, room: roomLabel, time: timeLabels })}
        sx={{ alignSelf: 'flex-start', mt: 0.5 }}
      >
        {applying ? intl.formatMessage(messages.applying) : intl.formatMessage(messages.moveToButton, { room: roomLabel })}
      </Button>
    </Box>
  );
}
