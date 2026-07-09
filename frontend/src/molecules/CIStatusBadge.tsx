import { Box, Chip, CircularProgress, Typography } from '@mui/material';
import { CheckCircle, Warning } from '@mui/icons-material';
import type { ProposalStatus } from '@/types';

interface CIStatusBadgeProps {
  readonly status: Extract<ProposalStatus, 'READY' | 'BLOCKED' | 'PENDING'>;
}

const BADGE_CONFIG = {
  READY: {
    color: 'success' as const,
    icon: <CheckCircle fontSize="small" />,
    label: 'Checked — no conflicts',
  },
  BLOCKED: {
    color: 'warning' as const,
    icon: <Warning fontSize="small" />,
    label: 'Has scheduling conflicts',
  },
  PENDING: {
    color: 'default' as const,
    icon: <CircularProgress size={14} />,
    label: 'Checking…',
  },
} satisfies Record<CIStatusBadgeProps['status'], { color: 'success' | 'warning' | 'default'; icon: React.ReactElement; label: string }>;

export default function CIStatusBadge({ status }: CIStatusBadgeProps): React.ReactElement {
  const config = BADGE_CONFIG[status];
  return (
    <Box>
      <Chip
        color={config.color}
        icon={config.icon}
        label={config.label}
        aria-label={`CI status: ${config.label}`}
      />
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
        This check was run when the proposal was submitted. It does not re-check against changes
        made to the published schedule after that date.
      </Typography>
    </Box>
  );
}
