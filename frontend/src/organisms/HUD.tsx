import { useEffect, useRef, useState } from 'react';
import { Box, Button, Paper, Tooltip, Typography } from '@mui/material';
import { Send } from '@mui/icons-material';
import ConflictChip from '@/molecules/ConflictChip';
import MetricChip from '@/molecules/MetricChip';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchConflictsThunk } from '@/store/reducers/conflictSlice';
import { fetchMetricsThunk } from '@/store/reducers/metricSlice';

interface HUDProps {
  readonly simId: string;
  /** Called when user clicks "Submit Proposal" — opens the modal from Task 11. */
  readonly onSubmitProposal: () => void;
}

const HUD_HEIGHT = 56;

export default function HUD({ simId, onSubmitProposal }: HUDProps): React.ReactElement {
  const dispatch = useAppDispatch();
  const conflicts = useAppSelector((s) => s.conflict.conflicts);
  const conflictLoading = useAppSelector((s) => s.conflict.loading);
  const metrics = useAppSelector((s) => s.metric.metrics);
  const metricLoading = useAppSelector((s) => s.metric.loading);
  const lastPatchAt = useAppSelector((s) => s.session.lastPatchAt);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [initialised, setInitialised] = useState(false);

  // Fetch on mount
  useEffect(() => {
    void dispatch(fetchConflictsThunk(simId));
    void dispatch(fetchMetricsThunk(simId));
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
      aria-label="Metrics and conflicts HUD"
    >
      {/* Zone 1 — Conflicts */}
      <ConflictChip conflicts={conflicts} loading={conflictLoading} />

      <Box sx={{ width: '1px', height: 28, bgcolor: 'divider', mx: 0.5 }} aria-hidden />

      {/* Zone 2 — Metrics */}
      <Box sx={{ display: 'flex', gap: 1, flex: 1, overflowX: 'auto', alignItems: 'center' }}>
        {metricLoading && metrics.length === 0 && (
          // Placeholder chips while loading for the first time
          <Typography variant="caption" color="text.secondary">
            Loading metrics…
          </Typography>
        )}
        {!metricLoading && metrics.length === 0 && (
          <Typography variant="caption" color="text.secondary">
            No metrics configured
          </Typography>
        )}
        {metrics.map((m) => (
          <MetricChip key={m.name} metric={m} loading={metricLoading} />
        ))}
      </Box>

      {/* Zone 3 — Submit proposal */}
      <Tooltip title="Submit your changes for admin review as a proposal">
        <Button
          variant="contained"
          size="small"
          startIcon={<Send />}
          onClick={onSubmitProposal}
          aria-label="Submit proposal for admin review"
          sx={{ flexShrink: 0 }}
        >
          Submit Proposal
        </Button>
      </Tooltip>
    </Paper>
  );
}
