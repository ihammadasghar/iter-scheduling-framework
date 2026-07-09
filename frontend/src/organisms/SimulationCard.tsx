import { Box, Button, Card, CardContent, CardActions, Chip, Typography, Tooltip } from '@mui/material';
import { CheckCircle, Warning } from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DeleteSimulationDialog from '@/molecules/DeleteSimulationDialog';
import type { MetricResult, Simulation } from '@/types';

interface SimulationCardProps {
  readonly simulation: Simulation;
  readonly conflictCount?: number;
  readonly metric?: MetricResult;
}

// Extract a display-friendly label from "sim-alice-a1b2c3d4" → "alice"
const extractLabel = (id: string): string => {
  const parts = id.split('-');
  // format: sim-{userId}-{hash} → parts[1] is userId
  return parts.length >= 3 ? (parts[1] ?? 'Draft') : 'Draft';
};

const formatAge = (createdAt: string): string => {
  try {
    return formatDistanceToNow(new Date(createdAt), { addSuffix: true });
  } catch {
    return 'some time ago';
  }
};

export default function SimulationCard({
  simulation,
  conflictCount,
  metric,
}: SimulationCardProps): React.ReactElement {
  const navigate = useNavigate();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const hasConflicts = conflictCount !== undefined && conflictCount > 0;
  const conflictLabel =
    conflictCount === undefined
      ? undefined
      : conflictCount === 0
        ? 'No scheduling conflicts'
        : `${conflictCount} scheduling conflict${conflictCount === 1 ? '' : 's'} found`;

  return (
    <>
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent sx={{ pb: 0 }}>
          <Typography variant="h4" component="h2" gutterBottom>
            {/* Human-readable title — never the raw ID */}
            Draft from {formatAge(simulation.createdAt)}
          </Typography>

          <Typography variant="body2" color="text.secondary" gutterBottom>
            Created by: {extractLabel(simulation.id)}
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
            <Tooltip title={`${metric.name}: current value`}>
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
            aria-label={`Open draft simulation from ${formatAge(simulation.createdAt)}`}
          >
            Open Draft
          </Button>
          <Button
            variant="outlined"
            color="error"
            onClick={() => setDeleteOpen(true)}
            aria-label={`Delete draft simulation from ${formatAge(simulation.createdAt)}`}
          >
            Delete Draft
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
