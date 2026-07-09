import { Box, Card, CardContent, Skeleton } from '@mui/material';

/**
 * Loading placeholder matching the SimulationCard layout.
 * Shown while simulationSlice.loading === true.
 */
export default function SimulationCardSkeleton(): React.ReactElement {
  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Skeleton variant="text" width="55%" height={28} />
        <Skeleton variant="text" width="75%" height={22} />
        <Skeleton variant="text" width="40%" height={22} />
        <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
          <Skeleton variant="rounded" width={120} height={44} />
          <Skeleton variant="rounded" width={120} height={44} />
        </Box>
      </CardContent>
    </Card>
  );
}
