import { Box, Card, CardContent, Skeleton } from '@mui/material';

export default function RuleCardSkeleton(): React.ReactElement {
  return (
    <Card variant="outlined" sx={{ mb: 1.5 }}>
      <CardContent>
        <Skeleton variant="text" width="50%" height={20} sx={{ mb: 0.5 }} />
        <Skeleton variant="text" width="70%" height={16} />
        <Skeleton variant="text" width="60%" height={16} />
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
          <Skeleton variant="circular" width={28} height={28} />
        </Box>
      </CardContent>
    </Card>
  );
}
