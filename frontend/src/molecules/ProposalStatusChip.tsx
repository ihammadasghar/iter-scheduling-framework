import { Box, Chip, Typography } from '@mui/material';
import { defineMessages, useIntl } from 'react-intl';
import type { ProposalStatus } from '@/types';

const messages = defineMessages({
  READY: { id: 'proposalStatusChip.ready', defaultMessage: 'Ready for Review' },
  BLOCKED: { id: 'proposalStatusChip.blocked', defaultMessage: 'Has Conflicts' },
  PENDING: { id: 'proposalStatusChip.pending', defaultMessage: 'Checking…' },
  MERGED: { id: 'proposalStatusChip.merged', defaultMessage: 'Published' },
  REJECTED: { id: 'proposalStatusChip.rejected', defaultMessage: 'Closed' },
  statusAriaLabel: { id: 'proposalStatusChip.statusAriaLabel', defaultMessage: 'Status: {label}' },
});

interface ProposalStatusChipProps {
  readonly status: ProposalStatus;
}

const STATUS_COLOR = {
  READY: 'success' as const,
  BLOCKED: 'warning' as const,
  PENDING: 'info' as const,
  MERGED: 'default' as const,
  REJECTED: 'default' as const,
} satisfies Record<ProposalStatus, 'success' | 'warning' | 'info' | 'default'>;

export default function ProposalStatusChip({ status }: ProposalStatusChipProps): React.ReactElement {
  const intl = useIntl();
  const label = intl.formatMessage(messages[status]);
  return (
    <Box component="span">
      <Chip
        color={STATUS_COLOR[status]}
        label={label}
        size="small"
        aria-label={intl.formatMessage(messages.statusAriaLabel, { label })}
      />
      <Typography component="span" sx={{ display: 'none' }}>
        {label}
      </Typography>
    </Box>
  );
}
