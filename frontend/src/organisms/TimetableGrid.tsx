import { useMemo } from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { deselectClass } from '@/store/reducers/uiSlice';
import ClassChip from '@/atoms/ClassChip';
import GridSkeleton from '@/organisms/GridSkeleton';
import {
  sortTimeSlotIds,
  formatTimeSlotLabel,
  formatRoomLabel,
  formatProfessorLabel,
  formatGroupLabel,
  uniqueSorted,
} from '@/utils/scheduleFormatters';
import type { ScheduleClass, ViewByOption } from '@/types';

interface TimetableGridProps {
  readonly conflictedClassIds?: ReadonlySet<string>;
}

// --- Pure helpers ---

const resourceIdOf = (cls: ScheduleClass, viewBy: ViewByOption): string =>
  viewBy === 'room'
    ? cls.roomId
    : viewBy === 'professor'
      ? cls.professorId
      : cls.studentGroupId;

const formatResourceLabel = (id: string, viewBy: ViewByOption): string =>
  viewBy === 'room'
    ? formatRoomLabel(id)
    : viewBy === 'professor'
      ? formatProfessorLabel(id)
      : formatGroupLabel(id);

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
}: TimetableGridProps): React.ReactElement {
  const dispatch = useAppDispatch();
  const classes = useAppSelector((s) => s.class.classes);
  const loading = useAppSelector((s) => s.class.loading);
  const viewBy = useAppSelector((s) => s.ui.viewBy);

  const sortedTsIds = useMemo(() => {
    const allIds = classes.flatMap((c) => [...c.timeSlotIds]);
    return sortTimeSlotIds(uniqueSorted(allIds));
  }, [classes]);

  const resourceIds = useMemo(() => {
    const ids = classes.map((c) => resourceIdOf(c, viewBy));
    return uniqueSorted(ids).sort();
  }, [classes, viewBy]);

  const lookup = useMemo(
    () => buildLookup(classes, sortedTsIds, viewBy),
    [classes, sortedTsIds, viewBy],
  );

  if (loading && classes.length === 0) {
    return <GridSkeleton />;
  }

  const colCount = sortedTsIds.length;

  return (
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
        {resourceIds.map((resId) => {
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
                    gridColumn: `${colIdx + 2} / span ${span}`,
                  }}
                >
                  <ClassChip
                    classItem={cls}
                    state={isConflicted ? 'conflicted' : 'default'}
                  />
                </Box>,
              );
            } else {
              cells.push(
                <Box
                  key={`${resId}-${tsId}`}
                  sx={{
                    ...cellSx,
                    gridColumn: colIdx + 2,
                  }}
                  aria-label="Empty time slot"
                />,
              );
            }
          });

          return (
            <>
              {/* Row label (sticky left) */}
              <Box key={`label-${resId}`} sx={stickyLabelSx}>
                <Tooltip title={resId} enterDelay={300}>
                  <Typography variant="caption" sx={{ fontWeight: 600 }} noWrap>
                    {formatResourceLabel(resId, viewBy)}
                  </Typography>
                </Tooltip>
              </Box>
              {cells}
            </>
          );
        })}

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
  );
}
