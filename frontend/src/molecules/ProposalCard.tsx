import { Box, Button, Card, CardActions, CardContent, Typography } from '@mui/material';
import { Warning } from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import ProposalStatusChip from '@/molecules/ProposalStatusChip';
import { extractUserLabel } from '@/utils/formatSimulationId';
import { useDateFnsLocale } from '@/utils/useDateFnsLocale';
import type { Proposal } from '@/types';

const messages = defineMessages({
  ageFallback: {
    id: 'proposalCard.ageFallback',
    defaultMessage: 'some time ago',
  },
  draftBy: {
    id: 'proposalCard.draftBy',
    defaultMessage: 'Draft by {label}',
  },
  submitted: {
    id: 'proposalCard.submitted',
    defaultMessage: 'Submitted {age}',
  },
  conflictsDetected: {
    id: 'proposalCard.conflictsDetected',
    defaultMessage: '{count, plural, one {# scheduling conflict detected} other {# scheduling conflicts detected}}',
  },
  reviewDetails: {
    id: 'proposalCard.reviewDetails',
    defaultMessage: 'Review Details →',
  },
  reviewAndPublish: {
    id: 'proposalCard.reviewAndPublish',
    defaultMessage: 'Review & Publish →',
  },
});

interface ProposalCardProps {
  readonly proposal: Proposal;
  readonly conflictCount?: number;
}

export default function ProposalCard({
  proposal,
  conflictCount,
}: ProposalCardProps): React.ReactElement {
  const intl = useIntl();
  const navigate = useNavigate();
  const dateFnsLocale = useDateFnsLocale();
  const isBlocked = proposal.status === 'BLOCKED';
  const userLabel = extractUserLabel(proposal.simulationId);

  const formatAge = (dateStr: string): string => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: dateFnsLocale });
    } catch {
      return intl.formatMessage(messages.ageFallback);
    }
  };

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent sx={{ pb: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {intl.formatMessage(messages.draftBy, { label: userLabel })}
          </Typography>
          <ProposalStatusChip status={proposal.status} />
        </Box>

        <Typography variant="body2" color="text.secondary">
          {intl.formatMessage(messages.submitted, { age: formatAge(proposal.createdAt) })}
        </Typography>

        {proposal.description && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mt: 0.5,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: 500,
            }}
          >
            {proposal.description}
          </Typography>
        )}

        {isBlocked && conflictCount !== undefined && conflictCount > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
            <Warning fontSize="small" color="warning" aria-hidden />
            <Typography variant="body2" color="warning.dark">
              {intl.formatMessage(messages.conflictsDetected, { count: conflictCount })}
            </Typography>
          </Box>
        )}
      </CardContent>

      <CardActions sx={{ px: 2, pb: 2 }}>
        <Button
          variant={isBlocked ? 'outlined' : 'contained'}
          onClick={() => navigate(`/admin/proposals/${proposal.id}`)}
        >
          {isBlocked ? intl.formatMessage(messages.reviewDetails) : intl.formatMessage(messages.reviewAndPublish)}
        </Button>
      </CardActions>
    </Card>
  );
}
