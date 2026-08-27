import { Fragment, useMemo, useState } from 'react';
import { Box, Typography, Tooltip, IconButton, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { ExpandMore, ExpandLess } from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { deselectClass } from '@/store/reducers/uiSlice';
import ClassChip from '@/atoms/ClassChip';
import GridSkeleton from '@/organisms/GridSkeleton';
import {
  sortTimeSlotIds,
  formatTimeSlotLabel,
  uniqueSorted,
} from '@/utils/scheduleFormatters';
import { buildConflictSummaries } from '@/utils/conflictSummaries';
import { useScheduleNames } from '@/hooks/useScheduleNames';
import type { ScheduleNames } from '@/utils/scheduleNames';
import type { ScheduleClass, ViewByOption } from '@/types';

interface TimetableGridProps {
  readonly conflictedClassIds?: ReadonlySet<string>;
  // Day names ("Monday".."Sunday") excluded for the currently-viewed week —
  // classes scheduled entirely on those days don't appear this week (see
  // weekNavigation.ts's excludedDaysForWeek).
  readonly excludedDays?: ReadonlySet<string>;
}

// --- Pure helpers ---

const resourceIdOf = (cls: ScheduleClass, viewBy: ViewByOption): string =>
  viewBy === 'room'
    ? cls.roomId
    : viewBy === 'professor'
      ? cls.professorId
      : cls.studentGroupId;

const resourceLabelOf = (id: string, viewBy: ViewByOption, names: ScheduleNames): string =>
  viewBy === 'room'
    ? names.roomName(id)
    : viewBy === 'professor'
      ? names.professorName(id)
      : names.groupName(id);

/** Index classes by [resourceId][firstTimeSlotId] for O(1) lookup. */
const buildLookup = (
  classes: readonly ScheduleClass[],
  sortedTsIds: readonly string[],
  viewBy: ViewByOption,
): Map<string, Map<string, ScheduleClass>> => {
  const map = new Map<string, Map<string, ScheduleClass>>();
  classes.forEach((cls) => {
    const resId = resourceIdOf(cls, viewBy);
    if (!map.has(resId)) map.set(resId, new Map<string, ScheduleClass>());
    // Key by the first (earliest) timeslot of this class
    const firstTsId = cls.timeSlotIds
      .slice()
      .sort((a, b) => sortedTsIds.indexOf(a) - sortedTsIds.indexOf(b))[0];
    if (firstTsId !== undefined) {
      map.get(resId)!.set(firstTsId, cls);
    }
  });
  return map;
};

/** Count how many consecutive sorted columns a class spans. */
const calcSpan = (cls: ScheduleClass, sortedTsIds: readonly string[]): number =>
  cls.timeSlotIds.filter((id) => sortedTsIds.includes(id)).length;

// --- Sticky cell style helpers ---
const stickyHeaderSx = {
  position: 'sticky',
  top: 0,
  zIndex: 10,
  bgcolor: 'background.paper',
  borderBottom: '2px solid',
  borderColor: 'divider',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  px: 1,
  py: 0.5,
  minHeight: 48,
};

const stickyLabelSx = {
  position: 'sticky',
  left: 0,
  zIndex: 5,
  bgcolor: 'background.paper',
  borderRight: '1px solid',
  borderColor: 'divider',
  display: 'flex',
  alignItems: 'center',
  px: 1,
  py: 0.5,
  minHeight: 72,
  minWidth: 100,
};

const cellSx = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  p: 0.5,
  minHeight: 72,
  borderBottom: '1px solid',
  borderRight: '1px solid',
  borderColor: 'divider',
};

export default function TimetableGrid({
  conflictedClassIds = new Set(),
  excludedDays = new Set(),
}: TimetableGridProps): React.ReactElement {
  const dispatch = useAppDispatch();
  const classes = useAppSelector((s) => s.class.classes);
  const loading = useAppSelector((s) => s.class.loading);
  const viewBy = useAppSelector((s) => s.ui.viewBy);
  const rooms = useAppSelector((s) => s.schedule.rooms);
  const timeSlots = useAppSelector((s) => s.schedule.timeSlots);
  const conflicts = useAppSelector((s) => s.conflict.conflicts);
  const names = useScheduleNames();

  const conflictSummaries = useMemo(
    () => buildConflictSummaries(conflicts, classes, names),
    [conflicts, classes, names],
  );
  const [collapsedBuildings, setCollapsedBuildings] = useState<ReadonlySet<string>>(new Set());
  const [density, setDensity] = useState<'compact' | 'comfortable'>('comfortable');
  const rowHeight = density === 'compact' ? 44 : 72;

  const buildingOf = useMemo(
    () => new Map(rooms.map((r) => [r.id, r.building])),
    [rooms],
  );

  const toggleBuilding = (building: string): void => {
    setCollapsedBuildings((prev) => {
      const next = new Set(prev);
      if (next.has(building)) next.delete(building);
      else next.add(building);
      return next;
    });
  };

  // Which weekday each time slot falls on, from the roster's authoritative
  // RawTimeSlot.day — used only for excludedDays filtering below; column
  // sorting/labeling still goes through scheduleFormatters.ts's ID parsing.
  const dayByTsId = useMemo(
    () => new Map(timeSlots.map((ts) => [ts.id, ts.day])),
    [timeSlots],
  );

  // Classes hidden this week because at least one of their slots lands on
  // an excluded day (e.g. a holiday) — filtered before column/row
  // derivation so an excluded day's columns simply don't appear that week,
  // and a resource with nothing left to show that week drops out of the
  // row list too. A class is only kept if every slot it occupies is on a
  // non-excluded day: since a class here renders as one spanning cell (not
  // one block per day, unlike MyScheduleCalendar), there's no way to show
  // "part of" a class while hiding another part — the whole occurrence
  // goes with the excluded day.
  const visibleClasses = useMemo(() => {
    if (excludedDays.size === 0) return classes;
    return classes.filter((cls) =>
      cls.timeSlotIds.every((tsId) => !excludedDays.has(dayByTsId.get(tsId) ?? '')),
    );
  }, [classes, excludedDays, dayByTsId]);

  const sortedTsIds = useMemo(() => {
    const allIds = visibleClasses.flatMap((c) => [...c.timeSlotIds]);
    return sortTimeSlotIds(uniqueSorted(allIds));
  }, [visibleClasses]);

  const resourceIds = useMemo(() => {
    const ids = visibleClasses.map((c) => resourceIdOf(c, viewBy));
    return uniqueSorted(ids).sort();
  }, [visibleClasses, viewBy]);

  const lookup = useMemo(
    () => buildLookup(visibleClasses, sortedTsIds, viewBy),
    [visibleClasses, sortedTsIds, viewBy],
  );

  if (loading && classes.length === 0) {
    return <GridSkeleton />;
  }

  const colCount = sortedTsIds.length;

  const renderResourceRow = (resId: string): React.ReactNode => {
    const rowLookup = lookup.get(resId) ?? new Map<string, ScheduleClass>();
    const cells: React.ReactNode[] = [];
    let skipCols = 0;

    sortedTsIds.forEach((tsId, colIdx) => {
      if (skipCols > 0) {
        skipCols--;
        return;
      }

      const cls = rowLookup.get(tsId);
      if (cls !== undefined) {
        const span = calcSpan(cls, sortedTsIds);
        skipCols = span - 1;
        const isConflicted = conflictedClassIds.has(cls.id);
        cells.push(
          <Box
            key={`${resId}-${tsId}`}
            sx={{
              ...cellSx,
              minHeight: rowHeight,
              gridColumn: `${colIdx + 2} / span ${span}`,
            }}
          >
            <ClassChip
              classItem={cls}
              state={isConflicted ? 'conflicted' : 'default'}
              conflictSummary={isConflicted ? conflictSummaries.get(cls.id) : undefined}
            />
          </Box>,
        );
      } else {
        cells.push(
          <Box
            key={`${resId}-${tsId}`}
            sx={{
              ...cellSx,
              minHeight: rowHeight,
              gridColumn: colIdx + 2,
            }}
            aria-label="Empty time slot"
          />,
        );
      }
    });

    return (
      <Fragment key={resId}>
        {/* Row label (sticky left) */}
        <Box key={`label-${resId}`} sx={{ ...stickyLabelSx, minHeight: rowHeight }}>
          <Tooltip title={resId} enterDelay={300}>
            <Typography variant="caption" sx={{ fontWeight: 600 }} noWrap>
              {resourceLabelOf(resId, viewBy, names)}
            </Typography>
          </Tooltip>
        </Box>
        {cells}
      </Fragment>
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'flex-end',
          px: 1,
          py: 0.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <ToggleButtonGroup
          value={density}
          exclusive
          size="small"
          aria-label="Row density"
          onChange={(_e, next: 'compact' | 'comfortable' | null) => {
            if (next !== null) setDensity(next);
          }}
        >
          <ToggleButton value="comfortable" aria-label="Comfortable row height">
            Comfortable
          </ToggleButton>
          <ToggleButton value="compact" aria-label="Compact row height">
            Compact
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Box
        onClick={() => dispatch(deselectClass())}
        sx={{
          overflow: 'auto',
          flex: 1,
          // Custom scrollbar handled by GlobalStyles
        }}
        aria-label="Timetable grid"
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: `100px repeat(${colCount}, minmax(150px, 1fr))`,
            width: 'max-content',
            minWidth: '100%',
          }}
        >
          {/* ── Row 0: sticky header ── */}
          {/* Top-left corner cell */}
          <Box sx={{ ...stickyHeaderSx, position: 'sticky', left: 0, zIndex: 20 }} />

          {sortedTsIds.map((tsId) => (
            <Box key={tsId} sx={stickyHeaderSx}>
              <Tooltip title={tsId} enterDelay={300}>
                <Typography variant="caption" sx={{ fontWeight: 600 }} noWrap>
                  {formatTimeSlotLabel(tsId)}
                </Typography>
              </Tooltip>
            </Box>
          ))}

          {/* ── Data rows ── */}
          {viewBy === 'room' ? (
            Object.entries(
              resourceIds.reduce<Record<string, string[]>>((acc, resId) => {
                const building = buildingOf.get(resId) ?? 'Other';
                (acc[building] ??= []).push(resId);
                return acc;
              }, {}),
            )
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([building, roomIds]) => {
                const collapsed = collapsedBuildings.has(building);
                const buildingConflictCount = roomIds
                  .flatMap((resId) => [...(lookup.get(resId)?.values() ?? [])])
                  .filter((cls) => conflictedClassIds.has(cls.id)).length;

                return (
                  <Fragment key={`building-${building}`}>
                    <Box
                      sx={{
                        ...stickyLabelSx,
                        minHeight: rowHeight,
                        gridColumn: `1 / span ${colCount + 1}`,
                        justifyContent: 'space-between',
                      }}
                    >
                      <Typography variant="caption" sx={{ fontWeight: 700 }}>
                        {building} · {roomIds.length} room{roomIds.length === 1 ? '' : 's'}
                        {buildingConflictCount > 0
                          ? ` · ${buildingConflictCount} conflict${buildingConflictCount === 1 ? '' : 's'}`
                          : ''}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => toggleBuilding(building)}
                        aria-label={collapsed ? `Expand ${building}` : `Collapse ${building}`}
                      >
                        {collapsed ? <ExpandMore /> : <ExpandLess />}
                      </IconButton>
                    </Box>
                    {!collapsed && roomIds.map((resId) => renderResourceRow(resId))}
                  </Fragment>
                );
              })
          ) : (
            resourceIds.map((resId) => renderResourceRow(resId))
          )}

          {/* Empty state when no classes loaded */}
          {!loading && classes.length === 0 && (
            <Box
              sx={{
                gridColumn: `1 / span ${colCount + 1}`,
                display: 'flex',
                justifyContent: 'center',
                py: 8,
              }}
            >
              <Typography color="text.secondary">
                No classes loaded. The schedule may be empty.
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
