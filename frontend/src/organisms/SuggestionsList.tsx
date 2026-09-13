import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Box, CircularProgress, Divider, Stack, Typography } from '@mui/material';
import { defineMessages, useIntl } from 'react-intl';
import SuggestionCard, { DeltaChip, ScoreDeltaChip } from '@/molecules/SuggestionCard';
import { formatTimeSlotFull } from '@/utils/scheduleFormatters';
import { simulationService } from '@/services/simulationService';
import { useApplySuggestion } from '@/hooks/useApplySuggestion';
import { useScheduleNames } from '@/hooks/useScheduleNames';
import type { ScheduleClass, Suggestion } from '@/types';

const messages = defineMessages({
  fetchError: {
    id: 'suggestionsList.fetchError',
    defaultMessage: 'Could not load suggestions. Please try again.',
  },
  heading: {
    id: 'suggestionsList.heading',
    defaultMessage: 'Smart Suggestions',
  },
  description: {
    id: 'suggestionsList.description',
    defaultMessage: 'Conflict-free rooms and times {course} could move to. Applying one moves the class immediately.',
  },
  movedTo: {
    id: 'suggestionsList.movedTo',
    defaultMessage: 'Moved to {room} · {time}',
  },
  loadingAriaLabel: {
    id: 'suggestionsList.loadingAriaLabel',
    defaultMessage: 'Loading suggestions…',
  },
  noSuggestions: {
    id: 'suggestionsList.noSuggestions',
    defaultMessage: 'No conflict-free slots available for this class. Try moving a conflicting class first.',
  },
});

interface SuggestionsListProps {
  readonly simId: string;
  readonly classId: string;
  // The class these suggestions are for — used to show "currently at X, move
  // to Y" comparisons in each card instead of the new slot in isolation.
  readonly currentClass: ScheduleClass;
}

// What was actually applied — built from the Suggestion object itself, never
// from `currentClass`, which mutates for every card the instant one
// suggestion commits (see SuggestionsList.test.tsx for the regression this
// guards against).
interface AppliedSummary {
  readonly roomLabel: string;
  readonly timeLabel: string;
}

export default function SuggestionsList({
  simId,
  classId,
  currentClass,
}: SuggestionsListProps): React.ReactElement {
  const intl = useIntl();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [appliedIndex, setAppliedIndex] = useState<number | null>(null);
  const [appliedSummary, setAppliedSummary] = useState<AppliedSummary | null>(null);

  const { apply, loading: applying, error: applyError, lastDelta, lastScoreDelta, deltaLoading } =
    useApplySuggestion(simId);
  const { courseName, roomName } = useScheduleNames();

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const loadSuggestions = useCallback(async (): Promise<void> => {
    setLoadingSuggestions(true);
    try {
      const result = await simulationService.getClassSuggestions(simId, classId);
      if (mountedRef.current) {
        setSuggestions(result);
        setFetchError('');
      }
    } catch {
      if (mountedRef.current) setFetchError(intl.formatMessage(messages.fetchError));
    } finally {
      if (mountedRef.current) setLoadingSuggestions(false);
    }
  }, [simId, classId, intl]);

  // Re-fetch suggestions whenever the selected class changes
  useEffect(() => {
    setFetchError('');
    setAppliedIndex(null);
    setAppliedSummary(null);
    void loadSuggestions();
  }, [loadSuggestions]);

  const handleApply = async (index: number, suggestion: Suggestion): Promise<void> => {
    setAppliedIndex(index);
    const succeeded = await apply(classId, suggestion);
    if (!succeeded) return;

    setAppliedSummary({
      roomLabel: roomName(suggestion.roomId),
      timeLabel: [...suggestion.timeSlotIds].map(formatTimeSlotFull).join(', '),
    });
    // The combo that was just applied is no longer a "suggestion" — it's the
    // current state — and other cards may now be stale/conflicting. Refresh
    // rather than leaving the old list sitting there looking unchanged.
    await loadSuggestions();
  };

  return (
    <Box>
      <Typography
        variant="overline"
        color="text.secondary"
        sx={{ display: 'block', px: 2, pt: 2 }}
      >
        {intl.formatMessage(messages.heading)}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ px: 2, pb: 1 }}>
        {intl.formatMessage(messages.description, { course: courseName(currentClass.courseId) })}
      </Typography>
      <Divider />

      {appliedSummary && (
        <Alert severity="success" sx={{ mx: 2, mt: 1 }}>
          <Stack spacing={0.5}>
            <Typography variant="body2">
              {intl.formatMessage(messages.movedTo, { room: appliedSummary.roomLabel, time: appliedSummary.timeLabel })}
            </Typography>
            {(lastDelta !== null || lastScoreDelta !== null) && (
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {lastDelta !== null && <DeltaChip delta={lastDelta} />}
                {lastScoreDelta !== null && <ScoreDeltaChip delta={lastScoreDelta} />}
              </Box>
            )}
          </Stack>
        </Alert>
      )}

      {applyError && (
        <Alert severity="error" sx={{ mx: 2, mt: 1 }}>
          {applyError}
        </Alert>
      )}

      {fetchError && !loadingSuggestions && (
        <Alert severity="error" sx={{ mx: 2, mt: 1 }}>
          {fetchError}
        </Alert>
      )}

      {loadingSuggestions && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress aria-label={intl.formatMessage(messages.loadingAriaLabel)} />
        </Box>
      )}

      {!loadingSuggestions && !fetchError && suggestions.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 2 }}>
          {intl.formatMessage(messages.noSuggestions)}
        </Typography>
      )}

      {!loadingSuggestions && suggestions.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, p: 2 }}>
          {suggestions.map((suggestion, index) => (
            <SuggestionCard
              key={`${suggestion.roomId}-${suggestion.timeSlotIds.join('-')}`}
              suggestion={suggestion}
              currentClass={currentClass}
              onApply={() => void handleApply(index, suggestion)}
              applying={applying && appliedIndex === index}
              loadingDelta={deltaLoading && appliedIndex === index}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}
