import { Box, Chip, Typography } from '@mui/material';
import ProposalCard from '@/molecules/ProposalCard';
import type { Proposal } from '@/types';

interface ProposalSectionProps {
  readonly title: string;
  readonly subtitle: string;
  readonly proposals: readonly Proposal[];
  readonly status: 'ready' | 'blocked';
}

export default function ProposalSection({
  title,
  subtitle,
  proposals,
  status,
}: ProposalSectionProps): React.ReactElement | null {
  if (proposals.length === 0) return null;

  return (
    <Box sx={{ mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
        <Typography variant="h6" component="h2">
          {title}
        </Typography>
        <Chip
          color={status === 'ready' ? 'success' : 'warning'}
          label={proposals.length}
          size="small"
          aria-label={`${proposals.length} proposal${proposals.length === 1 ? '' : 's'}`}
        />
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {subtitle}
      </Typography>
      {proposals.map((p) => (
        <ProposalCard key={p.id} proposal={p} />
      ))}
    </Box>
  );
}
