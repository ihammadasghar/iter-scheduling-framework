import { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { deselectClass } from '@/store/reducers/uiSlice';
import CalendarClassBlock from '@/atoms/CalendarClassBlock';
import GridSkeleton from '@/organisms/GridSkeleton';
import { useScheduleNames } from '@/hooks/useScheduleNames';
import { buildConflictSummaries } from '@/utils/conflictSummaries';
import {
  deriveDayOrder,
  computeCalendarBounds,
  filterMine,
  filterByResource,
  buildCalendarBlocks,
} from '@/utils/calendarLayout';
import type { ViewByOption } from '@/types';

interface MyScheduleCalendarProps {
  readonly conflictedClassIds?: ReadonlySet<string>;
  // When set, filters by this specific room/professor/student group instead
  // of the signed-in identity — used by the Browse tab (BrowseSchedulePanel)
  // to look up any entity's weekly calendar, not just "my own".
  readonly resource?: { readonly type: ViewByOption; readonly id: string };
  // Overrides the default "No classes are scheduled for you..." empty-state
  // copy — the Browse tab names the entity that was searched for instead.
  readonly emptyMessage?: string;
}

const PIXELS_PER_MINUTE = 1.2;
const HOUR_GUTTER_WIDTH = 64;

/** 630 → "10 AM" */
const formatHour = (minutes: number): string => {
  const hour = Math.floor(minutes / 60);
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour} ${period}`;
};

/**
 * A weekly schedule laid out as a real calendar (days as columns, time-of-day
 * going down the page). By default renders the signed-in professor/student's
 * own classes — the default landing view once they open a simulation. Pass
 * `resource` to instead show any specific room/professor/student group's
 * classes (used by BrowseSchedulePanel's "Browse" tab for ad-hoc lookups).
 * See utils/calendarLayout.ts for the pure geometry this renders. The
 * "everyone's schedule" view is the existing TimetableGrid, reachable via the
 * sibling "Full Schedule" tab.
 */
export default function MyScheduleCalendar({
  conflictedClassIds = new Set(),
  resource,
  emptyMessage,
}: MyScheduleCalendarProps): React.ReactElement {
  const dispatch = useAppDispatch();
  const classes = useAppSelector((s) => s.class.classes);
  const loading = useAppSelector((s) => s.class.loading);
  const identity = useAppSelector((s) => s.identity.identity);
  const timeSlots = useAppSelector((s) => s.schedule.timeSlots);
  const conflicts = useAppSelector((s) => s.conflict.conflicts);
  const names = useScheduleNames();

  const myClasses = useMemo(
    () => (resource ? filterByResource(classes, resource.type, resource.id) : filterMine(classes, identity)),
    [classes, identity, resource],
  );
  const timeSlotById = useMemo(() => new Map(timeSlots.map((ts) => [ts.id, ts])), [timeSlots]);
  const classById = useMemo(() => new Map(myClasses.map((c) => [c.id, c])), [myClasses]);
  const dayOrder = useMemo(() => deriveDayOrder(timeSlots), [timeSlots]);
  const bounds = useMemo(() => computeCalendarBounds(timeSlots), [timeSlots]);
  const blocks = useMemo(
    () => buildCalendarBlocks(myClasses, timeSlotById),
    [myClasses, timeSlotById],
  );
  const conflictSummaries = useMemo(
    () => buildConflictSummaries(conflicts, classes, names),
    [conflicts, classes, names],
  );

  if (loading && classes.length === 0) {
    return <GridSkeleton />;
  }

  if (myClasses.length === 0) {
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4 }}>
        <Typography color="text.secondary">
          {emptyMessage ?? 'No classes are scheduled for you in this simulation yet.'}
        </Typography>
      </Box>
    );
  }

  const totalHeight = Math.max((bounds.maxMinutes - bounds.minMinutes) * PIXELS_PER_MINUTE, 0);
  const hourMarks: number[] = [];
  for (let m = Math.ceil(bounds.minMinutes / 60) * 60; m <= bounds.maxMinutes; m += 60) {
    hourMarks.push(m);
  }

  return (
    <Box
      onClick={() => dispatch(deselectClass())}
      aria-label="My schedule calendar"
      sx={{ flex: 1, overflow: 'auto' }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `${HOUR_GUTTER_WIDTH}px repeat(${dayOrder.length}, minmax(160px, 1fr))`,
          width: 'max-content',
          minWidth: '100%',
        }}
      >
        {/* Sticky corner */}
        <Box
          sx={{
            position: 'sticky', top: 0, left: 0, zIndex: 20,
            bgcolor: 'background.paper', borderBottom: '2px solid', borderColor: 'divider',
          }}
        />
        {/* Day header row */}
        {dayOrder.map((day) => (
          <Box
            key={day}
            sx={{
              position: 'sticky', top: 0, zIndex: 10,
              bgcolor: 'background.paper', borderBottom: '2px solid', borderColor: 'divider',
              textAlign: 'center', py: 1,
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{day}</Typography>
          </Box>
        ))}

        {/* Sticky hour gutter */}
        <Box
          sx={{
            position: 'sticky', left: 0, zIndex: 5, height: totalHeight,
            bgcolor: 'background.paper', borderRight: '1px solid', borderColor: 'divider',
          }}
        >
          {hourMarks.map((m) => (
            <Typography
              key={m}
              variant="caption"
              color="text.secondary"
              sx={{
                position: 'absolute',
                top: `${(m - bounds.minMinutes) * PIXELS_PER_MINUTE - 8}px`,
                right: 4,
              }}
            >
              {formatHour(m)}
            </Typography>
          ))}
        </Box>

        {/* One column per day */}
        {dayOrder.map((day) => (
          <Box
            key={day}
            aria-label={`${day} schedule`}
            sx={{ position: 'relative', height: totalHeight, borderRight: '1px solid', borderColor: 'divider' }}
          >
            {hourMarks.map((m) => (
              <Box
                key={m}
                sx={{
                  position: 'absolute',
                  top: `${(m - bounds.minMinutes) * PIXELS_PER_MINUTE}px`,
                  left: 0, right: 0,
                  borderTop: '1px solid', borderColor: 'divider',
                }}
              />
            ))}
            {blocks
              .filter((block) => block.day === day)
              .map((block) => {
                const cls = classById.get(block.classId);
                if (cls === undefined) return null;
                const isConflicted = conflictedClassIds.has(cls.id);
                return (
                  <CalendarClassBlock
                    key={`${block.classId}-${block.day}`}
                    classItem={cls}
                    block={block}
                    minMinutes={bounds.minMinutes}
                    pixelsPerMinute={PIXELS_PER_MINUTE}
                    isConflicted={isConflicted}
                    conflictSummary={isConflicted ? conflictSummaries.get(cls.id) : undefined}
                  />
                );
              })}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
