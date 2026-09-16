import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Box, CircularProgress, Divider, Typography } from '@mui/material';
import { defineMessages, useIntl } from 'react-intl';
import SuggestionCard from '@/molecules/SuggestionCard';
import { simulationService } from '@/services/simulationService';
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
    defaultMessage: 'Conflict-free rooms and times {course} could move to. Selecting one fills in the fields above for you to review before applying.',
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
  // Stages a suggestion into the parent dialog's Room/Day/Period fields —
  // the dialog's own Apply Changes button remains the single commit point.
  readonly onStageSuggestion: (suggestion: Suggestion) => void;
}

export default function SuggestionsList({
  simId,
  classId,
  currentClass,
  onStageSuggestion,
}: SuggestionsListProps): React.ReactElement {
  const intl = useIntl();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const { courseName } = useScheduleNames();

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
    void loadSuggestions();
  }, [loadSuggestions]);

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
          {suggestions.map((suggestion) => (
            <SuggestionCard
              key={`${suggestion.roomId}-${suggestion.timeSlotIds.join('-')}`}
              suggestion={suggestion}
              currentClass={currentClass}
              onApply={() => onStageSuggestion(suggestion)}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}
