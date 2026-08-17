import { Box, Chip, Tooltip, Typography } from '@mui/material';
import type { WeightedScoreResult } from '@/types';

interface WeightedScoreChipProps {
  readonly score: WeightedScoreResult;
}

type ScoreColor = 'success' | 'warning' | 'error';

const colorForScore = (score: number): ScoreColor => {
  if (score >= 80) return 'success';
  if (score >= 50) return 'warning';
  return 'error';
};

const formatBreakdownLine = (
  entry: WeightedScoreResult['breakdown'][number],
): string =>
  `${entry.name}: ${entry.value}${entry.unit} (target ${entry.threshold}${entry.unit}, weight ${entry.weight})`;

export default function WeightedScoreChip({ score }: WeightedScoreChipProps): React.ReactElement {
  const hasMetrics = score.breakdown.length > 0;
  const label = hasMetrics ? `Score: ${score.score}/100` : 'Score: no metrics defined';

  const tooltip = hasMetrics ? (
    <Box>
      <Typography variant="caption" component="div" sx={{ fontWeight: 600, mb: 0.5 }}>
        Institution-defined score
      </Typography>
      {score.breakdown.map((entry) => (
        <Typography key={entry.name} variant="caption" component="div">
          {formatBreakdownLine(entry)}
        </Typography>
      ))}
    </Box>
  ) : (
    'No institution metric rules are configured, so no score can be computed yet.'
  );

  return (
    <Tooltip title={tooltip} enterDelay={300}>
      <Chip
        label={label}
        variant="outlined"
        color={hasMetrics ? colorForScore(score.score) : 'default'}
        aria-label={label}
      />
    </Tooltip>
  );
}
