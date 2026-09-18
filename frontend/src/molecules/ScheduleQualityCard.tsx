import { Box, Card, CardContent, Tooltip, Typography } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { defineMessages, useIntl } from 'react-intl';
import { colorForScore } from '@/molecules/WeightedScoreChip';
import type { WeightedScoreResult } from '@/types';

const messages = defineMessages({
  heading: {
    id: 'scheduleQualityCard.heading',
    defaultMessage: 'Schedule Quality',
  },
  tooltipExplainer: {
    id: 'scheduleQualityCard.tooltipExplainer',
    defaultMessage: 'A weighted average of how close each metric is to its target — 100 means every metric is right on target.',
  },
  ariaLabel: {
    id: 'scheduleQualityCard.ariaLabel',
    defaultMessage: 'Schedule Quality: {baseline} to {candidate}, {delta}',
  },
  deltaImproved: {
    id: 'scheduleQualityCard.deltaImproved',
    defaultMessage: '+{delta}',
  },
  deltaWorsened: {
    id: 'scheduleQualityCard.deltaWorsened',
    defaultMessage: '{delta}',
  },
  deltaUnchanged: {
    id: 'scheduleQualityCard.deltaUnchanged',
    defaultMessage: 'No change',
  },
  unavailable: {
    id: 'scheduleQualityCard.unavailable',
    defaultMessage: 'Not available — no metric rules are configured yet.',
  },
});

interface ScheduleQualityCardProps {
  readonly baselineScore: WeightedScoreResult;
  readonly candidateScore: WeightedScoreResult;
}

export default function ScheduleQualityCard({
  baselineScore,
  candidateScore,
}: ScheduleQualityCardProps): React.ReactElement {
  const intl = useIntl();

  const hasMetrics = baselineScore.breakdown.length > 0 && candidateScore.breakdown.length > 0;
  const delta = candidateScore.score - baselineScore.score;
  const deltaColor = !hasMetrics ? 'text.secondary' : delta > 0 ? 'success.main' : delta < 0 ? 'error.main' : 'text.secondary';
  const deltaLabel = !hasMetrics
    ? ''
    : delta > 0
      ? `▲ ${intl.formatMessage(messages.deltaImproved, { delta })}`
      : delta < 0
        ? `▼ ${intl.formatMessage(messages.deltaWorsened, { delta })}`
        : intl.formatMessage(messages.deltaUnchanged);

  const ariaLabel = hasMetrics
    ? intl.formatMessage(messages.ariaLabel, { baseline: baselineScore.score, candidate: candidateScore.score, delta: deltaLabel })
    : intl.formatMessage(messages.unavailable);

  return (
    <Card
      variant="outlined"
      sx={{
        mb: 3,
        borderColor: hasMetrics ? `${colorForScore(candidateScore.score)}.main` : 'divider',
        borderWidth: 2,
      }}
      aria-label={ariaLabel}
    >
      <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, '&:last-child': { pb: 2 } }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="overline" color="text.secondary" component="div">
              {intl.formatMessage(messages.heading)}
            </Typography>
            <Tooltip title={intl.formatMessage(messages.tooltipExplainer)} enterDelay={300}>
              <InfoOutlinedIcon fontSize="inherit" color="disabled" sx={{ fontSize: '1rem' }} />
            </Tooltip>
          </Box>
          {hasMetrics ? (
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
              <Typography variant="h2" component="div">
                {baselineScore.score}
              </Typography>
              <Typography variant="h5" component="div" color="text.secondary">
                →
              </Typography>
              <Typography variant="h2" component="div">
                {candidateScore.score}
              </Typography>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              {intl.formatMessage(messages.unavailable)}
            </Typography>
          )}
        </Box>
        {hasMetrics && (
          <Typography variant="h5" component="div" sx={{ color: deltaColor, fontWeight: 700 }}>
            {deltaLabel}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
