import { useEffect, useRef, useState } from 'react';
import { Box, Button, Chip, CircularProgress, Paper, Tooltip, Typography } from '@mui/material';
import { Send } from '@mui/icons-material';
import { defineMessages, useIntl } from 'react-intl';
import ConflictChip from '@/molecules/ConflictChip';
import MetricChip from '@/molecules/MetricChip';
import WeightedScoreChip from '@/molecules/WeightedScoreChip';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchConflictsThunk } from '@/store/reducers/conflictSlice';
import { fetchMetricsThunk } from '@/store/reducers/metricSlice';
import { fetchScoreThunk } from '@/store/reducers/scoreSlice';

const messages = defineMessages({
  ariaLabel: {
    id: 'hud.ariaLabel',
    defaultMessage: 'Metrics and conflicts HUD',
  },
  loadingScoreAriaLabel: {
    id: 'hud.loadingScoreAriaLabel',
    defaultMessage: 'Loading score…',
  },
  loadingMetrics: {
    id: 'hud.loadingMetrics',
    defaultMessage: 'Loading metrics…',
  },
  noMetrics: {
    id: 'hud.noMetrics',
    defaultMessage: 'No metrics configured',
  },
  submitTooltip: {
    id: 'hud.submitTooltip',
    defaultMessage: 'Submit your changes for admin review as a proposal',
  },
  submitAriaLabel: {
    id: 'hud.submitAriaLabel',
    defaultMessage: 'Submit proposal for admin review',
  },
  submitProposal: {
    id: 'hud.submitProposal',
    defaultMessage: 'Submit Proposal',
  },
});

interface HUDProps {
  readonly simId: string;
  /** Called when user clicks "Submit Proposal" — opens the modal from Task 11. */
  readonly onSubmitProposal: () => void;
}

const HUD_HEIGHT = 56;

export default function HUD({ simId, onSubmitProposal }: HUDProps): React.ReactElement {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const conflicts = useAppSelector((s) => s.conflict.conflicts);
  const conflictLoading = useAppSelector((s) => s.conflict.loading);
  const metrics = useAppSelector((s) => s.metric.metrics);
  const metricLoading = useAppSelector((s) => s.metric.loading);
  const score = useAppSelector((s) => s.score.current);
  const scoreLoading = useAppSelector((s) => s.score.loading);
  const lastPatchAt = useAppSelector((s) => s.session.lastPatchAt);
  const hasInteractedWithClass = useAppSelector((s) => s.ui.hasInteractedWithClass);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [initialised, setInitialised] = useState(false);

  // Fetch on mount
  useEffect(() => {
    void dispatch(fetchConflictsThunk(simId));
    void dispatch(fetchMetricsThunk(simId));
    void dispatch(fetchScoreThunk(simId));
    setInitialised(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simId]);

  // Re-fetch 300ms after each successful PATCH
  useEffect(() => {
    if (!initialised || lastPatchAt === 0) return;

    if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void dispatch(fetchConflictsThunk(simId));
      void dispatch(fetchMetricsThunk(simId));
      void dispatch(fetchScoreThunk(simId));
    }, 300);

    return () => {
      if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    };
  }, [lastPatchAt, simId, dispatch, initialised]);

  return (
    <Paper
      component="footer"
      elevation={4}
      square
      sx={{
        height: HUD_HEIGHT,
        display: 'flex',
        alignItems: 'center',
        px: 2,
        gap: 2,
        flexShrink: 0,
        borderTop: '1px solid',
        borderColor: 'divider',
      }}
      aria-label={intl.formatMessage(messages.ariaLabel)}
    >
      {/* Zone 1 — Conflicts and institution-defined score */}
      <ConflictChip conflicts={conflicts} loading={conflictLoading} softened={!hasInteractedWithClass} />

      {scoreLoading && score === null && (
        <Chip
          icon={<CircularProgress size={16} aria-label={intl.formatMessage(messages.loadingScoreAriaLabel)} />}
          label={intl.formatMessage(messages.loadingScoreAriaLabel)}
          variant="outlined"
          sx={{ minHeight: 32 }}
        />
      )}
      {score !== null && <WeightedScoreChip score={score} />}

      <Box sx={{ width: '1px', height: 28, bgcolor: 'divider', mx: 0.5 }} aria-hidden />

      {/* Zone 2 — Metrics */}
      <Box sx={{ display: 'flex', gap: 1, flex: 1, overflowX: 'auto', alignItems: 'center' }}>
        {metricLoading && metrics.length === 0 && (
          // Placeholder chips while loading for the first time
          <Typography variant="caption" color="text.secondary">
            {intl.formatMessage(messages.loadingMetrics)}
          </Typography>
        )}
        {!metricLoading && metrics.length === 0 && (
          <Typography variant="caption" color="text.secondary">
            {intl.formatMessage(messages.noMetrics)}
          </Typography>
        )}
        {metrics.map((m) => (
          <MetricChip key={m.name} metric={m} loading={metricLoading} />
        ))}
      </Box>

      {/* Zone 3 — Submit proposal */}
      <Tooltip title={intl.formatMessage(messages.submitTooltip)}>
        <Button
          variant="contained"
          size="small"
          startIcon={<Send />}
          onClick={onSubmitProposal}
          aria-label={intl.formatMessage(messages.submitAriaLabel)}
          sx={{ flexShrink: 0 }}
        >
          {intl.formatMessage(messages.submitProposal)}
        </Button>
      </Tooltip>
    </Paper>
  );
}
