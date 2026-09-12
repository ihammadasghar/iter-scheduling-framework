import { Box, Tooltip } from '@mui/material';
import { WarningAmber } from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectClass, toggleInspector } from '@/store/reducers/uiSlice';
import { useScheduleNames } from '@/hooks/useScheduleNames';
import type { ScheduleNames } from '@/utils/scheduleNames';
import type { CalendarBlock } from '@/utils/calendarLayout';
import type { ScheduleClass } from '@/types';

// Same idea as ClassChip.tsx, but positioned by real time-of-day geometry
// instead of a fixed-size grid cell — one block can be a different height
// than its neighbor, and two overlapping blocks render side-by-side.
interface CalendarClassBlockProps {
  readonly classItem: ScheduleClass;
  readonly block: CalendarBlock;
  readonly minMinutes: number;
  readonly pixelsPerMinute: number;
  readonly isConflicted?: boolean;
  readonly conflictSummary?: string;
}

// A floor under the geometry-derived height so a single-period class never
// renders below the 44px minimum touch target (DESIGN.md's accessibility
// baseline), even on a densely-packed day.
const MIN_BLOCK_HEIGHT = 44;

const buildTooltip = (cls: ScheduleClass, names: ScheduleNames): string => [
  cls.title,
  `Room: ${names.roomName(cls.roomId)}`,
  `Prof: ${names.professorName(cls.professorId)}`,
].join(' · ');

export default function CalendarClassBlock({
  classItem,
  block,
  minMinutes,
  pixelsPerMinute,
  isConflicted = false,
  conflictSummary,
}: CalendarClassBlockProps): React.ReactElement {
  const dispatch = useAppDispatch();
  const selectedId = useAppSelector((s) => s.ui.selectedClassId);
  const names = useScheduleNames();
  const selected = selectedId === classItem.id;

  const handleClick = (e: React.MouseEvent): void => {
    e.stopPropagation(); // prevent the calendar's own background deselectClass handler
    dispatch(selectClass(classItem.id));
    dispatch(toggleInspector(true));
  };

  const top = (block.startMinutes - minMinutes) * pixelsPerMinute;
  const height = Math.max(
    (block.endMinutes - block.startMinutes) * pixelsPerMinute,
    MIN_BLOCK_HEIGHT,
  );
  const widthPct = 100 / block.laneCount;
  const leftPct = widthPct * block.laneIndex;

  const label = names.courseCode(classItem.courseId);
  // A second line (room, or "No room" for ISCTE-style unscheduled classes —
  // see docs/iscte-dataset.md) so wayfinding info is visible without a
  // hover, whenever the block is tall enough to fit it without crowding.
  const roomLabel = names.roomName(classItem.roomId) || 'No room';
  const showRoomLine = height >= 50;
  const tooltipTitle = isConflicted && conflictSummary !== undefined
    ? `${conflictSummary} — click for details`
    : buildTooltip(classItem, names);
  const ariaLabel = isConflicted && conflictSummary !== undefined
    ? `${label} — ${conflictSummary}`
    : selected ? `${label} — selected` : label;

  return (
    <Tooltip title={tooltipTitle} enterDelay={300}>
      <Box
        onClick={handleClick}
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(e as unknown as React.MouseEvent); }}
        sx={{
          position: 'absolute',
          top: `${top}px`,
          height: `${height}px`,
          left: `${leftPct}%`,
          width: `calc(${widthPct}% - 4px)`,
          boxSizing: 'border-box',
          overflow: 'hidden',
          cursor: 'pointer',
          borderRadius: 1,
          px: 1,
          py: 0.5,
          fontSize: '0.75rem',
          fontWeight: 600,
          display: 'flex',
          flexDirection: 'column',
          gap: 0.25,
          border: selected ? 2 : isConflicted ? 1 : 0,
          borderColor: selected ? 'primary.main' : isConflicted ? 'warning.main' : 'transparent',
          boxShadow: selected ? 4 : 1,
          transition: 'box-shadow 0.15s, transform 0.15s',
          '&:hover': { boxShadow: selected ? 6 : 3, transform: 'translateY(-1px)' },
          bgcolor: isConflicted ? 'transparent' : selected ? 'primary.light' : 'primary.main',
          color: isConflicted ? 'text.primary' : selected ? 'primary.contrastText' : 'primary.contrastText',
          ...(isConflicted && {
            bgcolor: 'warning.light',
            // warning.light is a pale tint — use dark body text, not the
            // white contrastText meant for the solid warning.main fill.
            color: 'text.primary',
          }),
        }}
      >
        {isConflicted && <WarningAmber fontSize="inherit" />}
        <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </Box>
        {showRoomLine && (
          <Box
            component="span"
            sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.65rem', fontWeight: 400, opacity: 0.85 }}
          >
            {roomLabel}
          </Box>
        )}
      </Box>
    </Tooltip>
  );
}
