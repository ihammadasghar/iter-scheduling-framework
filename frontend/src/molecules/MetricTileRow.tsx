import { Card, CardContent, Stack, Typography } from '@mui/material';
import type { MetricResult } from '@/types';

interface MetricTileRowProps {
  readonly metrics: readonly MetricResult[];
}

export default function MetricTileRow({ metrics }: MetricTileRowProps): React.ReactElement {
  if (metrics.length === 0) {
    return <Typography color="text.secondary">No metrics configured</Typography>;
  }

  return (
    <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
      {metrics.map((m) => (
        <Card key={m.name} sx={{ minWidth: 180 }}>
          <CardContent>
            <Typography variant="overline" color="text.secondary">
              {m.name}
            </Typography>
            <Typography variant="h4" component="p">
              {m.value}{m.unit}
            </Typography>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}
