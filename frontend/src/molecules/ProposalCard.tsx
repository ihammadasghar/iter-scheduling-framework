import { Box, Button, Card, CardActions, CardContent, Typography } from '@mui/material';
import { Warning } from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import ProposalStatusChip from '@/molecules/ProposalStatusChip';
import { extractUserLabel } from '@/utils/formatSimulationId';
import type { Proposal } from '@/types';

interface ProposalCardProps {
  readonly proposal: Proposal;
  readonly conflictCount?: number;
}

const formatAge = (dateStr: string): string => {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return 'some time ago';
  }
};

export default function ProposalCard({
  proposal,
  conflictCount,
}: ProposalCardProps): React.ReactElement {
  const navigate = useNavigate();
  const isBlocked = proposal.status === 'BLOCKED';
  const userLabel = extractUserLabel(proposal.simulationId);

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent sx={{ pb: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Draft by {userLabel}
          </Typography>
          <ProposalStatusChip status={proposal.status} />
        </Box>

        <Typography variant="body2" color="text.secondary">
          Submitted {formatAge(proposal.createdAt)}
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
              {conflictCount} scheduling conflict{conflictCount === 1 ? '' : 's'} detected
            </Typography>
          </Box>
        )}
      </CardContent>

      <CardActions sx={{ px: 2, pb: 2 }}>
        <Button
          variant={isBlocked ? 'outlined' : 'contained'}
          onClick={() => navigate(`/admin/proposals/${proposal.id}`)}
        >
          {isBlocked ? 'Review Details →' : 'Review & Publish →'}
        </Button>
      </CardActions>
    </Card>
  );
}
