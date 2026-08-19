import { Card, CardContent, Stack, Typography } from '@mui/material';
import { CheckCircle, Warning } from '@mui/icons-material';

interface HealthSummaryTileProps {
  readonly conflictCount: number;
}

export default function HealthSummaryTile({
  conflictCount,
}: HealthSummaryTileProps): React.ReactElement {
  const healthy = conflictCount === 0;
  const label = healthy
    ? 'No scheduling conflicts'
    : `${conflictCount} scheduling conflict${conflictCount === 1 ? '' : 's'} found`;

  return (
    <Card>
      <CardContent>
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ alignItems: 'center' }}
        >
          {healthy ? (
            <CheckCircle color="success" fontSize="large" aria-hidden />
          ) : (
            <Warning color="warning" fontSize="large" aria-hidden />
          )}
          <Typography variant="h5" component="p">
            {label}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}
