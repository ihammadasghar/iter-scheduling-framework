import { Box, IconButton, Typography } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { defineMessages, useIntl } from 'react-intl';
import { canGoPrev, canGoNext, stepWeek, formatWeekRangeLabel } from '@/utils/weekNavigation';
import type { ScheduleTimeline } from '@/types';

const messages = defineMessages({
  previousWeek: {
    id: 'weekNavigator.previousWeek',
    defaultMessage: 'Previous week',
  },
  nextWeek: {
    id: 'weekNavigator.nextWeek',
    defaultMessage: 'Next week',
  },
});

interface WeekNavigatorProps {
  readonly weekStart: string; // Monday, "YYYY-MM-DD"
  readonly onWeekChange: (nextWeekStart: string) => void;
  readonly timeline: ScheduleTimeline;
}

/**
 * Prev/next controls for paging the weekly calendar views (MyScheduleCalendar,
 * TimetableGrid) through the semester one week at a time. Fully controlled —
 * no internal state — so a host page can keep its tabs' views in sync on the
 * same week. Disables at the semester's first/last week; callers only mount
 * this once `timeline` has actually loaded (see host pages).
 */
export default function WeekNavigator({ weekStart, onWeekChange, timeline }: WeekNavigatorProps): React.ReactElement {
  const intl = useIntl();
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <IconButton
        size="small"
        aria-label={intl.formatMessage(messages.previousWeek)}
        disabled={!canGoPrev(weekStart, timeline)}
        onClick={() => onWeekChange(stepWeek(weekStart, 'prev', timeline))}
      >
        <ChevronLeftIcon fontSize="small" />
      </IconButton>
      <Typography variant="body2" sx={{ minWidth: 160, textAlign: 'center' }}>
        {formatWeekRangeLabel(weekStart)}
      </Typography>
      <IconButton
        size="small"
        aria-label={intl.formatMessage(messages.nextWeek)}
        disabled={!canGoNext(weekStart, timeline)}
        onClick={() => onWeekChange(stepWeek(weekStart, 'next', timeline))}
      >
        <ChevronRightIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}
