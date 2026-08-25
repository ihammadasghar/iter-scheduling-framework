import { Card, CardContent, Stack, Typography } from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import type { MetricDelta } from '@/types';

interface MetricDeltaTileProps {
  readonly delta: MetricDelta;
}

export default function MetricDeltaTile({ delta }: MetricDeltaTileProps): React.ReactElement {
  const changed = delta.before !== delta.after;
  const improved = delta.after > delta.before;
  const afterColor = !changed ? 'text.primary' : improved ? 'success.main' : 'error.main';

  return (
    <Card sx={{ minWidth: 220 }}>
      <CardContent>
        <Typography variant="overline" color="text.secondary">
          {delta.name}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Typography variant="h6" component="span" color="text.secondary">
            {delta.before}{delta.unit}
          </Typography>
          <ArrowForwardIcon fontSize="small" color="action" aria-hidden />
          <Typography variant="h6" component="span" sx={{ color: afterColor, fontWeight: 600 }}>
            {delta.after}{delta.unit}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}
