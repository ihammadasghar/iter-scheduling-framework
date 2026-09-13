import { Box, Chip, Tooltip, Typography } from '@mui/material';
import { defineMessages, useIntl } from 'react-intl';
import type { WeightedScoreResult } from '@/types';

const messages = defineMessages({
  scoreLabel: {
    id: 'weightedScoreChip.scoreLabel',
    defaultMessage: 'Score: {score}/100',
  },
  noMetrics: {
    id: 'weightedScoreChip.noMetrics',
    defaultMessage: 'Score: no metrics defined',
  },
  tooltipTitle: {
    id: 'weightedScoreChip.tooltipTitle',
    defaultMessage: 'Institution-defined score',
  },
  breakdownLine: {
    id: 'weightedScoreChip.breakdownLine',
    defaultMessage: '{name}: {value}{unit} (target {threshold}{unit}, weight {weight})',
  },
  noMetricsTooltip: {
    id: 'weightedScoreChip.noMetricsTooltip',
    defaultMessage: 'No institution metric rules are configured, so no score can be computed yet.',
  },
});

interface WeightedScoreChipProps {
  readonly score: WeightedScoreResult;
}

type ScoreColor = 'success' | 'warning' | 'error';

const colorForScore = (score: number): ScoreColor => {
  if (score >= 80) return 'success';
  if (score >= 50) return 'warning';
  return 'error';
};

export default function WeightedScoreChip({ score }: WeightedScoreChipProps): React.ReactElement {
  const intl = useIntl();
  const hasMetrics = score.breakdown.length > 0;
  const label = hasMetrics
    ? intl.formatMessage(messages.scoreLabel, { score: score.score })
    : intl.formatMessage(messages.noMetrics);

  const tooltip = hasMetrics ? (
    <Box>
      <Typography variant="caption" component="div" sx={{ fontWeight: 600, mb: 0.5 }}>
        {intl.formatMessage(messages.tooltipTitle)}
      </Typography>
      {score.breakdown.map((entry) => (
        <Typography key={entry.name} variant="caption" component="div">
          {intl.formatMessage(messages.breakdownLine, {
            name: entry.name,
            value: entry.value,
            unit: entry.unit,
            threshold: entry.threshold,
            weight: entry.weight,
          })}
        </Typography>
      ))}
    </Box>
  ) : (
    intl.formatMessage(messages.noMetricsTooltip)
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
