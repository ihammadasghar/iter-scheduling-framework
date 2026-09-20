import { Box, Chip, Typography } from '@mui/material';
import { defineMessages, useIntl } from 'react-intl';
import type { ProposalRole } from '@/types';

const messages = defineMessages({
  student: { id: 'proposalRoleChip.student', defaultMessage: 'Student' },
  professor: { id: 'proposalRoleChip.professor', defaultMessage: 'Professor' },
  roleAriaLabel: { id: 'proposalRoleChip.roleAriaLabel', defaultMessage: 'Submitted by a {label}' },
});

interface ProposalRoleChipProps {
  readonly role: ProposalRole;
}

const ROLE_COLOR = {
  student: 'default' as const,
  professor: 'info' as const,
} satisfies Record<ProposalRole, 'default' | 'info'>;

export default function ProposalRoleChip({ role }: ProposalRoleChipProps): React.ReactElement {
  const intl = useIntl();
  const label = intl.formatMessage(messages[role]);
  return (
    <Box component="span">
      <Chip
        color={ROLE_COLOR[role]}
        label={label}
        size="small"
        variant="outlined"
        aria-label={intl.formatMessage(messages.roleAriaLabel, { label })}
      />
      <Typography component="span" sx={{ display: 'none' }}>
        {label}
      </Typography>
    </Box>
  );
}
