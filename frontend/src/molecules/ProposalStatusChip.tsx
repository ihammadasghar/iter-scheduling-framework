import { Box, Chip, Typography } from '@mui/material';
import type { ProposalStatus } from '@/types';

interface ProposalStatusChipProps {
  readonly status: ProposalStatus;
}

const STATUS_CONFIG = {
  READY: { color: 'success' as const, label: 'Ready for Review' },
  BLOCKED: { color: 'warning' as const, label: 'Has Conflicts' },
  PENDING: { color: 'info' as const, label: 'Checking…' },
  MERGED: { color: 'default' as const, label: 'Published' },
  REJECTED: { color: 'default' as const, label: 'Closed' },
} satisfies Record<ProposalStatus, { color: 'success' | 'warning' | 'info' | 'default'; label: string }>;

export default function ProposalStatusChip({ status }: ProposalStatusChipProps): React.ReactElement {
  const config = STATUS_CONFIG[status];
  return (
    <Box component="span">
      <Chip
        color={config.color}
        label={config.label}
        size="small"
        aria-label={`Status: ${config.label}`}
      />
      <Typography component="span" sx={{ display: 'none' }}>
        {config.label}
      </Typography>
    </Box>
  );
}
