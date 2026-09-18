import { Box, Typography } from '@mui/material';
import { defineMessages, useIntl } from 'react-intl';
import MetricChip from '@/molecules/MetricChip';
import { useAppSelector } from '@/store/hooks';

const messages = defineMessages({
  loadingMetrics: {
    id: 'metricsToolbar.loadingMetrics',
    defaultMessage: 'Loading metrics…',
  },
  noMetrics: {
    id: 'metricsToolbar.noMetrics',
    defaultMessage: 'No metrics configured',
  },
});

export default function MetricsToolbar(): React.ReactElement {
  const intl = useIntl();
  const metrics = useAppSelector((s) => s.metric.metrics);
  const metricLoading = useAppSelector((s) => s.metric.loading);

  return (
    <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', alignItems: 'center', minWidth: 0, maxWidth: '100%' }}>
      {metricLoading && metrics.length === 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
          {intl.formatMessage(messages.loadingMetrics)}
        </Typography>
      )}
      {!metricLoading && metrics.length === 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
          {intl.formatMessage(messages.noMetrics)}
        </Typography>
      )}
      {metrics.map((m) => (
        <MetricChip key={m.name} metric={m} loading={metricLoading} />
      ))}
    </Box>
  );
}
