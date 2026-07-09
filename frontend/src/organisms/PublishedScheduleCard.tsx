import { Box, Button, Card, CardContent, CardActions, Typography, Tooltip } from '@mui/material';
import { EventNote } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

/**
 * Static card representing the official published schedule on main.
 * "View Schedule" is a soft stub until the read-only simulation view is implemented.
 */
export default function PublishedScheduleCard(): React.ReactElement {
  const navigate = useNavigate();

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
          <Tooltip title="Opens a read-only view of the current published timetable">
            <Button
              variant="outlined"
              onClick={() => navigate('/simulations/main')}
              aria-label="View the official published schedule"
            >
              View Schedule
            </Button>
          </Tooltip>
        </CardActions>
      </Card>
    </Box>
  );
}
