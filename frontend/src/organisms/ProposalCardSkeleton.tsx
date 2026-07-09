import { Box, Card, CardContent, Skeleton } from '@mui/material';

export default function ProposalCardSkeleton(): React.ReactElement {
  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Skeleton variant="text" width={160} height={24} />
          <Skeleton variant="rectangular" width={80} height={22} sx={{ borderRadius: 4 }} />
        </Box>
        <Skeleton variant="text" width={120} height={18} />
        <Skeleton variant="text" width={280} height={18} sx={{ mt: 0.5 }} />
        <Box sx={{ mt: 1.5 }}>
          <Skeleton variant="rectangular" width={140} height={36} sx={{ borderRadius: 1 }} />
        </Box>
      </CardContent>
    </Card>
  );
}
