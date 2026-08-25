import { Box, Stack, Typography } from '@mui/material';
import WeightedScoreChip from '@/molecules/WeightedScoreChip';
import MetricDeltaTile from '@/molecules/MetricDeltaTile';
import { buildMetricDeltas } from '@/utils/buildMetricDeltas';
import type { WeightedScoreResult } from '@/types';

interface MetricsComparisonPanelProps {
  readonly baselineScore: WeightedScoreResult;
  readonly candidateScore: WeightedScoreResult;
}

export default function MetricsComparisonPanel({
  baselineScore,
  candidateScore,
}: MetricsComparisonPanelProps): React.ReactElement {
  const deltas = buildMetricDeltas(baselineScore, candidateScore);

  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Currently Published:
        </Typography>
        <WeightedScoreChip score={baselineScore} />
        <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
          This Proposal:
        </Typography>
        <WeightedScoreChip score={candidateScore} />
      </Stack>

      {deltas.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No institution metric rules are configured, so no per-metric comparison is available.
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
