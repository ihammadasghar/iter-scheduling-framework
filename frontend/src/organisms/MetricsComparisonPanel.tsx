import { Box, Stack, Typography } from '@mui/material';
import { defineMessages, useIntl } from 'react-intl';
import WeightedScoreChip from '@/molecules/WeightedScoreChip';
import MetricDeltaTile from '@/molecules/MetricDeltaTile';
import { buildMetricDeltas } from '@/utils/buildMetricDeltas';
import type { WeightedScoreResult } from '@/types';

const messages = defineMessages({
  currentlyPublished: {
    id: 'metricsComparisonPanel.currentlyPublished',
    defaultMessage: 'Currently Published:',
  },
  thisProposal: {
    id: 'metricsComparisonPanel.thisProposal',
    defaultMessage: 'This Proposal:',
  },
  noComparison: {
    id: 'metricsComparisonPanel.noComparison',
    defaultMessage: 'No institutional preferences are configured, so no per-metric comparison is available.',
  },
});

interface MetricsComparisonPanelProps {
  readonly baselineScore: WeightedScoreResult;
  readonly candidateScore: WeightedScoreResult;
}

export default function MetricsComparisonPanel({
  baselineScore,
  candidateScore,
}: MetricsComparisonPanelProps): React.ReactElement {
  const intl = useIntl();
  const deltas = buildMetricDeltas(baselineScore, candidateScore);

  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {intl.formatMessage(messages.currentlyPublished)}
        </Typography>
        <WeightedScoreChip score={baselineScore} />
        <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
          {intl.formatMessage(messages.thisProposal)}
        </Typography>
        <WeightedScoreChip score={candidateScore} />
      </Stack>

      {deltas.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {intl.formatMessage(messages.noComparison)}
        </Typography>
      ) : (
        <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
          {deltas.map((delta) => (
            <MetricDeltaTile key={delta.name} delta={delta} />
          ))}
        </Stack>
      )}
    </Box>
  );
}
