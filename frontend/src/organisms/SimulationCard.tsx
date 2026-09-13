import { Box, Button, Card, CardContent, CardActions, Chip, Typography, Tooltip } from '@mui/material';
import { CheckCircle, Warning } from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import DeleteSimulationDialog from '@/molecules/DeleteSimulationDialog';
import { useDateFnsLocale } from '@/utils/useDateFnsLocale';
import type { MetricResult, Simulation } from '@/types';

const messages = defineMessages({
  draftFallbackLabel: {
    id: 'simulationCard.draftFallbackLabel',
    defaultMessage: 'Draft',
  },
  ageFallback: {
    id: 'simulationCard.ageFallback',
    defaultMessage: 'some time ago',
  },
  title: {
    id: 'simulationCard.title',
    defaultMessage: 'Draft from {age}',
  },
  createdBy: {
    id: 'simulationCard.createdBy',
    defaultMessage: 'Created by: {label}',
  },
  noConflicts: {
    id: 'simulationCard.noConflicts',
    defaultMessage: 'No scheduling conflicts',
  },
  conflictsFound: {
    id: 'simulationCard.conflictsFound',
    defaultMessage: '{count, plural, one {# scheduling conflict found} other {# scheduling conflicts found}}',
  },
  metricTooltip: {
    id: 'simulationCard.metricTooltip',
    defaultMessage: '{name}: current value',
  },
  openDraft: {
    id: 'simulationCard.openDraft',
    defaultMessage: 'Open Draft',
  },
  openDraftAriaLabel: {
    id: 'simulationCard.openDraftAriaLabel',
    defaultMessage: 'Open draft simulation from {age}',
  },
  deleteDraft: {
    id: 'simulationCard.deleteDraft',
    defaultMessage: 'Delete Draft',
  },
  deleteDraftAriaLabel: {
    id: 'simulationCard.deleteDraftAriaLabel',
    defaultMessage: 'Delete draft simulation from {age}',
  },
});

interface SimulationCardProps {
  readonly simulation: Simulation;
  readonly conflictCount?: number;
  readonly metric?: MetricResult;
}

export default function SimulationCard({
  simulation,
  conflictCount,
  metric,
}: SimulationCardProps): React.ReactElement {
  const intl = useIntl();
  const navigate = useNavigate();
  const dateFnsLocale = useDateFnsLocale();
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Extract a display-friendly label from "sim-alice-a1b2c3d4" → "alice"
  const extractLabel = (id: string): string => {
    const parts = id.split('-');
    // format: sim-{userId}-{hash} → parts[1] is userId
    return parts.length >= 3 ? (parts[1] ?? intl.formatMessage(messages.draftFallbackLabel)) : intl.formatMessage(messages.draftFallbackLabel);
  };

  const formatAge = (createdAt: string): string => {
    try {
      return formatDistanceToNow(new Date(createdAt), { addSuffix: true, locale: dateFnsLocale });
    } catch {
      return intl.formatMessage(messages.ageFallback);
    }
  };

  const hasConflicts = conflictCount !== undefined && conflictCount > 0;
  const conflictLabel =
    conflictCount === undefined
      ? undefined
      : conflictCount === 0
        ? intl.formatMessage(messages.noConflicts)
        : intl.formatMessage(messages.conflictsFound, { count: conflictCount });

  const age = formatAge(simulation.createdAt);

  return (
    <>
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent sx={{ pb: 0 }}>
          <Typography variant="h4" component="h2" gutterBottom>
            {/* Human-readable title — never the raw ID */}
            {intl.formatMessage(messages.title, { age })}
          </Typography>

          <Typography variant="body2" color="text.secondary" gutterBottom>
            {intl.formatMessage(messages.createdBy, { label: extractLabel(simulation.id) })}
          </Typography>

          {conflictLabel !== undefined && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
              {hasConflicts ? (
                <Warning fontSize="small" color="warning" aria-hidden />
              ) : (
                <CheckCircle fontSize="small" color="success" aria-hidden />
              )}
              <Typography
                variant="body2"
                color={hasConflicts ? 'warning.dark' : 'success.dark'}
                aria-live="polite"
              >
                {conflictLabel}
              </Typography>
            </Box>
          )}

          {metric !== undefined && (
            <Tooltip title={intl.formatMessage(messages.metricTooltip, { name: metric.name })}>
              <Chip
                label={`${metric.name}: ${metric.value}${metric.unit}`}
                size="small"
                variant="outlined"
                sx={{ mt: 1 }}
              />
            </Tooltip>
          )}
        </CardContent>

        <CardActions sx={{ px: 2, pb: 2, gap: 1 }}>
          <Button
            variant="contained"
            onClick={() => navigate(`/simulations/${simulation.id}`)}
            aria-label={intl.formatMessage(messages.openDraftAriaLabel, { age })}
          >
            {intl.formatMessage(messages.openDraft)}
          </Button>
          <Button
            variant="outlined"
            color="error"
            onClick={() => setDeleteOpen(true)}
            aria-label={intl.formatMessage(messages.deleteDraftAriaLabel, { age })}
          >
            {intl.formatMessage(messages.deleteDraft)}
          </Button>
        </CardActions>
      </Card>

      <DeleteSimulationDialog
        open={deleteOpen}
        simulationId={simulation.id}
        onClose={() => setDeleteOpen(false)}
      />
    </>
  );
}
