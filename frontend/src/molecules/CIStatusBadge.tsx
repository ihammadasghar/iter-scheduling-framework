import { Box, Chip, CircularProgress, Typography } from '@mui/material';
import { CheckCircle, Warning } from '@mui/icons-material';
import { defineMessages, useIntl } from 'react-intl';
import type { ProposalStatus } from '@/types';

const messages = defineMessages({
  ready: {
    id: 'ciStatusBadge.ready',
    defaultMessage: 'Checked — no conflicts',
  },
  blocked: {
    id: 'ciStatusBadge.blocked',
    defaultMessage: 'Has scheduling conflicts',
  },
  pending: {
    id: 'ciStatusBadge.pending',
    defaultMessage: 'Checking…',
  },
  ariaLabel: {
    id: 'ciStatusBadge.ariaLabel',
    defaultMessage: 'CI status: {label}',
  },
  disclaimer: {
    id: 'ciStatusBadge.disclaimer',
    defaultMessage: 'This check was run when the proposal was submitted. It does not re-check against changes made to the published schedule after that date.',
  },
});

interface CIStatusBadgeProps {
  readonly status: Extract<ProposalStatus, 'READY' | 'BLOCKED' | 'PENDING'>;
}

export default function CIStatusBadge({ status }: CIStatusBadgeProps): React.ReactElement {
  const intl = useIntl();
  const badgeConfig = {
    READY: {
      color: 'success' as const,
      icon: <CheckCircle fontSize="small" />,
      label: intl.formatMessage(messages.ready),
    },
    BLOCKED: {
      color: 'warning' as const,
      icon: <Warning fontSize="small" />,
      label: intl.formatMessage(messages.blocked),
    },
    PENDING: {
      color: 'default' as const,
      icon: <CircularProgress size={14} />,
      label: intl.formatMessage(messages.pending),
    },
  } satisfies Record<CIStatusBadgeProps['status'], { color: 'success' | 'warning' | 'default'; icon: React.ReactElement; label: string }>;
  const config = badgeConfig[status];
  return (
    <Box>
      <Chip
        color={config.color}
        icon={config.icon}
        label={config.label}
        aria-label={intl.formatMessage(messages.ariaLabel, { label: config.label })}
      />
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
        {intl.formatMessage(messages.disclaimer)}
      </Typography>
    </Box>
  );
}
