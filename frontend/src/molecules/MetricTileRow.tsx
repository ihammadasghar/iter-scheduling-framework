import { Card, CardContent, Stack, Typography } from '@mui/material';
import { defineMessages, useIntl } from 'react-intl';
import type { MetricResult } from '@/types';

const messages = defineMessages({
  noMetrics: {
    id: 'metricTileRow.noMetrics',
    defaultMessage: 'No metrics configured',
  },
});

interface MetricTileRowProps {
  readonly metrics: readonly MetricResult[];
}

export default function MetricTileRow({ metrics }: MetricTileRowProps): React.ReactElement {
  const intl = useIntl();
  if (metrics.length === 0) {
    return <Typography color="text.secondary">{intl.formatMessage(messages.noMetrics)}</Typography>;
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
