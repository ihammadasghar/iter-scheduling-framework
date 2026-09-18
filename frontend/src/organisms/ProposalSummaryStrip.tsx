import { Box, Chip, Stack, Typography } from '@mui/material';
import { defineMessages, useIntl } from 'react-intl';
import CIStatusBadge from '@/molecules/CIStatusBadge';
import type { ProposalStatus } from '@/types';

const messages = defineMessages({
  automatedCheck: {
    id: 'proposalSummaryStrip.automatedCheck',
    defaultMessage: 'Automated Check',
  },
  conflictDeltaLabel: {
    id: 'proposalSummaryStrip.conflictDeltaLabel',
    defaultMessage: 'Conflict Change',
  },
  conflictDeltaReduced: {
    id: 'proposalSummaryStrip.conflictDeltaReduced',
    defaultMessage: '{count, plural, one {# fewer conflict} other {# fewer conflicts}}',
  },
  conflictDeltaIncreased: {
    id: 'proposalSummaryStrip.conflictDeltaIncreased',
    defaultMessage: '{count, plural, one {# more conflict} other {# more conflicts}}',
  },
  conflictDeltaUnchanged: {
    id: 'proposalSummaryStrip.conflictDeltaUnchanged',
    defaultMessage: 'No change in conflicts',
  },
});

interface ProposalSummaryStripProps {
  readonly ciStatus: Extract<ProposalStatus, 'READY' | 'BLOCKED' | 'PENDING'> | null;
  readonly baselineConflictCount: number;
  readonly candidateConflictCount: number;
}

export default function ProposalSummaryStrip({
  ciStatus,
  baselineConflictCount,
  candidateConflictCount,
}: ProposalSummaryStripProps): React.ReactElement {
  const intl = useIntl();

  const conflictsResolved = baselineConflictCount - candidateConflictCount;
  const conflictChip = conflictsResolved > 0
    ? { color: 'success' as const, label: intl.formatMessage(messages.conflictDeltaReduced, { count: conflictsResolved }) }
    : conflictsResolved < 0
      ? { color: 'error' as const, label: intl.formatMessage(messages.conflictDeltaIncreased, { count: -conflictsResolved }) }
      : { color: 'default' as const, label: intl.formatMessage(messages.conflictDeltaUnchanged) };

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} sx={{ mb: 3, flexWrap: 'wrap' }}>
      {ciStatus && (
        <Box>
          <Typography variant="overline" color="text.secondary" component="div">
            {intl.formatMessage(messages.automatedCheck)}
          </Typography>
          <CIStatusBadge status={ciStatus} />
        </Box>
      )}
      <Box>
        <Typography variant="overline" color="text.secondary" component="div">
          {intl.formatMessage(messages.conflictDeltaLabel)}
        </Typography>
        <Chip variant="outlined" color={conflictChip.color} label={conflictChip.label} aria-label={conflictChip.label} />
      </Box>
    </Stack>
  );
}
