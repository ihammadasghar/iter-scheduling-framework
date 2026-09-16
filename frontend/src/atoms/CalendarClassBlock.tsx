import { useEffect, useState } from 'react';
import { Box, Tooltip } from '@mui/material';
import { keyframes } from '@mui/material/styles';
import { WarningAmber } from '@mui/icons-material';
import { defineMessages, useIntl } from 'react-intl';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectClass, toggleInspector } from '@/store/reducers/uiSlice';
import { useScheduleNames } from '@/hooks/useScheduleNames';
import type { ScheduleNames } from '@/utils/scheduleNames';
import type { CalendarBlock } from '@/utils/calendarLayout';
import type { ScheduleClass } from '@/types';

const messages = defineMessages({
  tooltip: {
    id: 'calendarClassBlock.tooltip',
    defaultMessage: '{title} · Room: {room} · Prof: {professor}',
  },
  noRoom: {
    id: 'calendarClassBlock.noRoom',
    defaultMessage: 'No room',
  },
  conflictTooltip: {
    id: 'calendarClassBlock.conflictTooltip',
    defaultMessage: '{conflictSummary} — click for details',
  },
  conflictAriaLabel: {
    id: 'calendarClassBlock.conflictAriaLabel',
    defaultMessage: '{label} — {conflictSummary}',
  },
  selectedAriaLabel: {
    id: 'calendarClassBlock.selectedAriaLabel',
    defaultMessage: '{label} — selected',
  },
  firstRunHint: {
    id: 'calendarClassBlock.firstRunHint',
    defaultMessage: 'Click any class to see details.',
  },
  firstRunHintAriaLabel: {
    id: 'calendarClassBlock.firstRunHintAriaLabel',
    defaultMessage: '{label} — click to see details',
  },
});

// Draws the eye to the first-run hint block without relying on color, so it
// still reads correctly in both light and dark themes.
const pulseHint = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.04); }
`;

// How long the first-run hint's tooltip stays open on its own before it
// behaves like every other block's hover-only tooltip.
const FIRST_RUN_HINT_DURATION_MS = 4000;

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
  // Set on exactly one block (the earliest in the visible week) by
  // MyScheduleCalendar when the user hasn't ever selected a class yet —
  // teaches discoverability of the underlying "classes are clickable"
  // mechanic instead of letting the conflict chip win attention by default
  // (cognitive-walkthrough finding, issue #6).
  readonly showFirstRunHint?: boolean;
}

// A floor under the geometry-derived height so a single-period class never
// renders below the 44px minimum touch target (DESIGN.md's accessibility
// baseline), even on a densely-packed day.
const MIN_BLOCK_HEIGHT = 44;

export default function CalendarClassBlock({
  classItem,
  block,
  minMinutes,
  pixelsPerMinute,
  isConflicted = false,
  conflictSummary,
  showFirstRunHint = false,
}: CalendarClassBlockProps): React.ReactElement {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const selectedId = useAppSelector((s) => s.ui.selectedClassId);
  const names = useScheduleNames();
  const selected = selectedId === classItem.id;
  // Fades every other block once a class is selected, so the Inspector's
  // header text has one obvious block to tie back to instead of competing
  // with a full calendar of equally-weighted blocks (cognitive-walkthrough
  // finding, issue #7).
  const dimmed = selectedId !== null && !selected;

  // Whether this block instance ever owns the hint, locked in at mount —
  // MUI's Tooltip must stay either controlled or uncontrolled for its whole
  // lifetime, and showFirstRunHint itself flips false the instant the user
  // interacts with any class, which would otherwise switch this Tooltip
  // from controlled to uncontrolled mid-life.
  const [isHintBlock] = useState(showFirstRunHint);
  // The hint auto-opens once, then times out (or closes early once the user
  // interacts anywhere, which flips showFirstRunHint off upstream) — after
  // that it behaves like a normal hover-only tooltip.
  const [hintOpen, setHintOpen] = useState(showFirstRunHint);
  useEffect(() => {
    if (!isHintBlock) return undefined;
    if (!showFirstRunHint) {
      setHintOpen(false);
      return undefined;
    }
    const timer = setTimeout(() => setHintOpen(false), FIRST_RUN_HINT_DURATION_MS);
    return () => clearTimeout(timer);
  }, [isHintBlock, showFirstRunHint]);
  const hintActive = isHintBlock && showFirstRunHint && hintOpen;

  const buildTooltip = (cls: ScheduleClass, n: ScheduleNames): string =>
    intl.formatMessage(messages.tooltip, {
      title: cls.title,
      room: n.roomName(cls.roomId),
      professor: n.professorName(cls.professorId),
    });

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
  const roomLabel = names.roomName(classItem.roomId) || intl.formatMessage(messages.noRoom);
  const showRoomLine = height >= 50;
  const tooltipTitle = hintActive
    ? intl.formatMessage(messages.firstRunHint)
    : isConflicted && conflictSummary !== undefined
      ? intl.formatMessage(messages.conflictTooltip, { conflictSummary })
      : buildTooltip(classItem, names);
  const ariaLabel = isConflicted && conflictSummary !== undefined
    ? intl.formatMessage(messages.conflictAriaLabel, { label, conflictSummary })
    : selected ? intl.formatMessage(messages.selectedAriaLabel, { label })
    : showFirstRunHint ? intl.formatMessage(messages.firstRunHintAriaLabel, { label })
    : label;

  return (
    <Tooltip
      title={tooltipTitle}
      enterDelay={300}
      {...(isHintBlock
        ? { open: hintOpen, onOpen: () => setHintOpen(true), onClose: () => setHintOpen(false) }
        : {})}
    >
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
          border: selected ? 2 : isConflicted ? 1 : hintActive ? 2 : 0,
          borderColor: selected ? 'primary.main' : isConflicted ? 'warning.main' : hintActive ? 'info.main' : 'transparent',
          boxShadow: selected ? 4 : 1,
          opacity: dimmed ? 0.4 : 1,
          transition: 'box-shadow 0.15s, transform 0.15s, opacity 0.15s',
          animation: hintActive ? `${pulseHint} 1.4s ease-in-out infinite` : undefined,
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
