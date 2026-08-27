import { Box, IconButton, Typography } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { canGoPrev, canGoNext, stepWeek, formatWeekRangeLabel } from '@/utils/weekNavigation';
import type { ScheduleTimeline } from '@/types';

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
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <IconButton
        size="small"
        aria-label="Previous week"
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
        aria-label="Next week"
        disabled={!canGoNext(weekStart, timeline)}
        onClick={() => onWeekChange(stepWeek(weekStart, 'next', timeline))}
      >
        <ChevronRightIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}
