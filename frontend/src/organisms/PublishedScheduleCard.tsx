import { useState } from 'react';
import { Box, Button, Card, CardContent, CardActions, Typography, Tooltip, CircularProgress } from '@mui/material';
import { EventNote } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '@/store/hooks';
import { createSimulationThunk } from '@/store/reducers/simulationSlice';

const PUBLISHED_SCHEDULE_VIEWER_ID = 'viewer';

/**
 * Static card representing the official published schedule on main.
 * "View Schedule" opens it by starting a simulation from `main`, the same
 * way "Create New Simulation" does — there is no separate read-only view.
 */
export default function PublishedScheduleCard(): React.ReactElement {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleViewSchedule = async (): Promise<void> => {
    setLoading(true);
    const result = await dispatch(createSimulationThunk(PUBLISHED_SCHEDULE_VIEWER_ID));
    setLoading(false);

    if (createSimulationThunk.fulfilled.match(result)) {
      navigate(`/simulations/${result.payload.id}`);
    }
  };

  return (
    <Box sx={{ mb: 4 }}>
      <Typography
        variant="overline"
        color="text.secondary"
        component="h2"
        sx={{ display: 'block', mb: 1 }}
      >
        Published Schedule
      </Typography>
      <Card variant="outlined" sx={{ borderColor: 'primary.light' }}>
        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, pb: 0 }}>
          <EventNote color="primary" sx={{ fontSize: 40 }} aria-hidden />
          <Box>
            <Typography variant="h4" component="h3">
              Official Published Schedule
            </Typography>
            <Typography variant="body2" color="text.secondary">
              The current timetable published for students and staff. Start a simulation to
              propose changes.
            </Typography>
          </Box>
        </CardContent>
        <CardActions sx={{ px: 2, pb: 2 }}>
          <Tooltip title="Opens the current published timetable in a new simulation">
            <Box component="span">
              <Button
                variant="outlined"
                onClick={() => void handleViewSchedule()}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={16} /> : undefined}
                aria-label="View Schedule"
              >
                {loading ? 'Opening…' : 'View Schedule'}
              </Button>
            </Box>
          </Tooltip>
        </CardActions>
      </Card>
    </Box>
  );
}
