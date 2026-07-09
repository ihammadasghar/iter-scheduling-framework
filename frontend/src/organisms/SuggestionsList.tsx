import { useEffect, useState } from 'react';
import { Alert, Box, CircularProgress, Divider, Typography } from '@mui/material';
import SuggestionCard from '@/molecules/SuggestionCard';
import { simulationService } from '@/services/simulationService';
import { useApplySuggestion } from '@/hooks/useApplySuggestion';
import type { Suggestion } from '@/types';

interface SuggestionsListProps {
  readonly simId: string;
  readonly classId: string;
}

export default function SuggestionsList({
  simId,
  classId,
}: SuggestionsListProps): React.ReactElement {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [appliedIndex, setAppliedIndex] = useState<number | null>(null);

  const { apply, loading: applying, error: applyError, lastDelta, deltaLoading } =
    useApplySuggestion(simId);

  // Re-fetch suggestions whenever the selected class changes
  useEffect(() => {
    let cancelled = false;
    setFetchError('');
    setAppliedIndex(null);

    const load = async (): Promise<void> => {
      setLoadingSuggestions(true);
      try {
        const result = await simulationService.getClassSuggestions(simId, classId);
        if (!cancelled) setSuggestions(result);
      } catch {
        if (!cancelled) setFetchError('Could not load suggestions. Please try again.');
      } finally {
        if (!cancelled) setLoadingSuggestions(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [simId, classId]);

  const handleApply = async (index: number, suggestion: Suggestion): Promise<void> => {
    setAppliedIndex(index);
    await apply(classId, suggestion);
  };

  return (
    <Box>
      <Typography
        variant="overline"
        color="text.secondary"
        sx={{ display: 'block', px: 2, pt: 2 }}
      >
        Smart Suggestions
      </Typography>
      <Divider />

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
          <CircularProgress aria-label="Loading suggestions…" />
        </Box>
      )}

      {!loadingSuggestions && !fetchError && suggestions.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 2 }}>
          No conflict-free slots available for this class. Try moving a conflicting class first.
        </Typography>
      )}

      {!loadingSuggestions && suggestions.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, p: 2 }}>
          {suggestions.map((suggestion, index) => (
            <SuggestionCard
              key={`${suggestion.roomId}-${suggestion.timeSlotIds.join('-')}`}
              suggestion={suggestion}
              onApply={() => void handleApply(index, suggestion)}
              applying={applying && appliedIndex === index}
              metricDelta={appliedIndex === index ? (lastDelta ?? undefined) : undefined}
              loadingDelta={deltaLoading && appliedIndex === index}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}
