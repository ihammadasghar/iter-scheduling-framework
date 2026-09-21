import { useEffect, useRef, useState } from 'react';
import { Box, Button, Paper, Tooltip } from '@mui/material';
import { Send } from '@mui/icons-material';
import { defineMessages, useIntl } from 'react-intl';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchConflictsThunk } from '@/store/reducers/conflictSlice';
import { fetchMetricsThunk } from '@/store/reducers/metricSlice';
import { fetchScoreThunk } from '@/store/reducers/scoreSlice';
import { fetchSimulationDiffThunk } from '@/store/reducers/diffSlice';

const messages = defineMessages({
  ariaLabel: {
    id: 'hud.ariaLabel',
    defaultMessage: 'Conflicts and Schedule Quality HUD',
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
  const lastPatchAt = useAppSelector((s) => s.session.lastPatchAt);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [initialised, setInitialised] = useState(false);

  // Fetch on mount
  useEffect(() => {
    void dispatch(fetchConflictsThunk(simId));
    void dispatch(fetchMetricsThunk(simId));
    void dispatch(fetchScoreThunk(simId));
    void dispatch(fetchSimulationDiffThunk(simId));
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
      void dispatch(fetchSimulationDiffThunk(simId));
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
      <Box sx={{ flex: 1 }} />

      {/* Submit proposal */}
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
