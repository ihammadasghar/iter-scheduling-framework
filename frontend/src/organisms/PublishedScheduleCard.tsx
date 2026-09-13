import { Box, Button, Card, CardContent, CardActions, Typography, Tooltip } from '@mui/material';
import { EventNote } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';

const messages = defineMessages({
  sectionLabel: {
    id: 'publishedScheduleCard.sectionLabel',
    defaultMessage: 'Published Schedule',
  },
  title: {
    id: 'publishedScheduleCard.title',
    defaultMessage: 'Official Published Schedule',
  },
  body: {
    id: 'publishedScheduleCard.body',
    defaultMessage: 'The current timetable published for students and staff. Start a simulation to propose changes.',
  },
  tooltip: {
    id: 'publishedScheduleCard.tooltip',
    defaultMessage: 'Opens a read-only view of the current published timetable',
  },
  viewAriaLabel: {
    id: 'publishedScheduleCard.viewAriaLabel',
    defaultMessage: 'View the official published schedule',
  },
  viewSchedule: {
    id: 'publishedScheduleCard.viewSchedule',
    defaultMessage: 'View Schedule',
  },
});

/**
 * Static card representing the official published schedule on main.
 * "View Schedule" opens a read-only view of the currently published timetable.
 */
export default function PublishedScheduleCard(): React.ReactElement {
  const intl = useIntl();
  const navigate = useNavigate();

  return (
    <Box sx={{ mb: 4 }}>
      <Typography
        variant="overline"
        color="text.secondary"
        component="h2"
        sx={{ display: 'block', mb: 1 }}
      >
        {intl.formatMessage(messages.sectionLabel)}
      </Typography>
      <Card variant="outlined" sx={{ borderColor: 'primary.light' }}>
        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, pb: 0 }}>
          <EventNote color="primary" sx={{ fontSize: 40 }} aria-hidden />
          <Box>
            <Typography variant="h4" component="h3">
              {intl.formatMessage(messages.title)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {intl.formatMessage(messages.body)}
            </Typography>
          </Box>
        </CardContent>
        <CardActions sx={{ px: 2, pb: 2 }}>
          <Tooltip title={intl.formatMessage(messages.tooltip)}>
            <Button
              variant="outlined"
              onClick={() => navigate('/schedule')}
              aria-label={intl.formatMessage(messages.viewAriaLabel)}
            >
              {intl.formatMessage(messages.viewSchedule)}
            </Button>
          </Tooltip>
        </CardActions>
      </Card>
    </Box>
  );
}
