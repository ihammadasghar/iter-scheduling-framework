import { useMemo } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { TouchApp, Edit } from '@mui/icons-material';
import { defineMessages, useIntl } from 'react-intl';
import OverlayClassBlock from '@/atoms/OverlayClassBlock';
import { useScheduleNames } from '@/hooks/useScheduleNames';
import { deriveDayOrder, computeCalendarBounds, timeToMinutes } from '@/utils/calendarLayout';
import type { OverlayBlock } from '@/utils/overlayLayout';
import type { RawTimeSlot, ScheduleClass } from '@/types';

const messages = defineMessages({
  editing: { id: 'assignmentOverlayCalendar.editing', defaultMessage: 'This Class' },
  roomBusyLabel: {
    id: 'assignmentOverlayCalendar.roomBusyLabel',
    defaultMessage: 'Room {name} busy',
  },
  professorBusyLabel: {
    id: 'assignmentOverlayCalendar.professorBusyLabel',
    defaultMessage: 'Professor {name} busy',
  },
  groupBusyLabel: {
    id: 'assignmentOverlayCalendar.groupBusyLabel',
    defaultMessage: 'Student group {name} busy',
  },
  overlayAriaLabel: {
    id: 'assignmentOverlayCalendar.overlayAriaLabel',
    defaultMessage: 'Room, professor, and student group schedule overlay',
  },
  dayAvailabilityAriaLabel: {
    id: 'assignmentOverlayCalendar.dayAvailabilityAriaLabel',
    defaultMessage: '{day} availability',
  },
  useSlotAriaLabel: {
    id: 'assignmentOverlayCalendar.useSlotAriaLabel',
    defaultMessage: 'Use {day} {slotName}',
  },
  blockTooltip: {
    id: 'assignmentOverlayCalendar.blockTooltip',
    defaultMessage: '{label}: {title}',
  },
  busyTooltip: {
    id: 'assignmentOverlayCalendar.busyTooltip',
    defaultMessage: '{label} with {title}',
  },
  slotClickHint: {
    id: 'assignmentOverlayCalendar.slotClickHint',
    defaultMessage: 'Click an empty slot to set day & period.',
  },
  am: { id: 'assignmentOverlayCalendar.am', defaultMessage: 'AM' },
  pm: { id: 'assignmentOverlayCalendar.pm', defaultMessage: 'PM' },
});

interface AssignmentOverlayCalendarProps {
  // Includes an 'editing' block for the class being edited itself, at
  // whichever slot is currently selected — the caller re-derives that block
  // from the Day/Period selection each render, so it moves like any other
  // event would if you dragged it, without any separate "current vs.
  // candidate" bookkeeping here.
  readonly blocks: readonly OverlayBlock[];
  readonly classById: ReadonlyMap<string, ScheduleClass>;
  readonly timeSlots: readonly RawTimeSlot[];
  // Click-to-set shortcut for the Day/Period dropdowns — every slot's region
  // sits under the (pointer-events: none) busy blocks, so a click always
  // reaches it regardless of what's drawn on top.
  readonly onSlotClick?: (day: string, slotId: string) => void;
  // Caps the scrollable grid's height — defaults to the dialog-era 360px;
  // callers with more vertical room (e.g. a full page) can raise it.
  readonly maxHeight?: number;
}

const PIXELS_PER_MINUTE = 1;
const HOUR_GUTTER_WIDTH = 56;
// Each side-by-side lane needs enough width for an entity-name label
// ("Professor Jane Smith busy") not to be squeezed unreadable — day columns
// widen with the busiest overlap on record instead of staying at a fixed
// width regardless of how many classes stack up on the same slot.
const MIN_DAY_COLUMN_WIDTH = 160;
const MIN_LANE_WIDTH = 130;

// Busy blocks (room/professor/group) all share one neutral style now that
// the tile's own text ("Room 204 busy") identifies its source instead of a
// color/icon a user had to learn from a legend (cognitive-walkthrough
// finding, issue #29) — this is still a shared style, not per-source
// color-coding. A transparent tint of the app-wide blue (rather than flat
// gray) reads with more contrast against the page background. The 'editing'
// block keeps a solid version of that same blue, used by
// CalendarClassBlock.tsx/ClassChip.tsx for "the class I'm currently working
// with" — that's a distinct "which block am I editing" signal, so busy tiles
// stay a lighter, transparent variant to keep the editing block dominant.
const BUSY_BGCOLOR = 'rgba(52, 84, 216, 0.5)'; // transparent tint of theme.palette.primary.main — literal so it renders correctly without a ThemeProvider in tests
const BUSY_COLOR = 'text.primary';
const EDITING_BGCOLOR = 'primary.light';
const EDITING_COLOR = 'primary.contrastText';

/**
 * Overlays the room's, professor's, and student group's weekly schedules on
 * one calendar for the Edit Assignment dialog — a sibling to
 * MyScheduleCalendar.tsx (same grid geometry) but for three busy sources,
 * each labeled with an "<entity name> busy" tile, instead of one signed-in
 * identity's own classes.
 */
export default function AssignmentOverlayCalendar({
  blocks,
  classById,
  timeSlots,
  onSlotClick,
  maxHeight = 360,
}: AssignmentOverlayCalendarProps): React.ReactElement {
  const intl = useIntl();
  const names = useScheduleNames();
  const dayOrder = useMemo(() => deriveDayOrder(timeSlots), [timeSlots]);
  const bounds = useMemo(() => computeCalendarBounds(timeSlots), [timeSlots]);
  const dayColumnWidth = useMemo(
    () => Math.max(MIN_DAY_COLUMN_WIDTH, ...blocks.map((b) => b.laneCount * MIN_LANE_WIDTH)),
    [blocks],
  );

  // Room/professor/group blocks read as "<entity name> busy" instead of the
  // course code, so the tile's own text identifies its source without a
  // color legend. The 'editing' block isn't a "busy" conflict — it's the
  // class being placed — so it keeps the course code.
  const busyLabel = (block: OverlayBlock, cls: ScheduleClass): string => {
    switch (block.source) {
      case 'room':
        return intl.formatMessage(messages.roomBusyLabel, { name: names.roomName(cls.roomId) });
      case 'professor':
        return intl.formatMessage(messages.professorBusyLabel, { name: names.professorName(cls.professorId) });
      case 'group':
        return intl.formatMessage(messages.groupBusyLabel, { name: names.groupName(cls.studentGroupId) });
      case 'editing':
        return names.courseCode(cls.courseId);
    }
  };

  /** 630 → "10 AM" */
  const formatHour = (minutes: number): string => {
    const hour = Math.floor(minutes / 60);
    const period = hour >= 12 ? intl.formatMessage(messages.pm) : intl.formatMessage(messages.am);
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    return `${displayHour} ${period}`;
  };

  const totalHeight = Math.max((bounds.maxMinutes - bounds.minMinutes) * PIXELS_PER_MINUTE, 0);
  const hourMarks: number[] = [];
  for (let m = Math.ceil(bounds.minMinutes / 60) * 60; m <= bounds.maxMinutes; m += 60) {
    hourMarks.push(m);
  }

  return (
    <Box>
      {onSlotClick !== undefined && (
        <Stack direction="row" spacing={0.5} sx={{ mb: 1, alignItems: 'center' }}>
          <TouchApp fontSize="small" color="action" />
          <Typography variant="caption" color="text.secondary">
            {intl.formatMessage(messages.slotClickHint)}
          </Typography>
        </Stack>
      )}

      <Box
        aria-label={intl.formatMessage(messages.overlayAriaLabel)}
        sx={{ overflow: 'auto', maxHeight, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: `${HOUR_GUTTER_WIDTH}px repeat(${dayOrder.length}, minmax(${dayColumnWidth}px, 1fr))`,
            width: 'max-content',
            minWidth: '100%',
          }}
        >
          <Box sx={{
            position: 'sticky', top: 0, left: 0, zIndex: 20,
            bgcolor: 'background.paper', borderBottom: '2px solid', borderColor: 'divider',
          }}
          />
          {dayOrder.map((day) => (
            <Box
              key={day}
              sx={{
                position: 'sticky', top: 0, zIndex: 10,
                bgcolor: 'background.paper', borderBottom: '2px solid', borderColor: 'divider',
                textAlign: 'center', py: 0.5,
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 700 }}>{day}</Typography>
            </Box>
          ))}

          <Box sx={{
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
                  top: `${(m - bounds.minMinutes) * PIXELS_PER_MINUTE - 7}px`,
                  right: 4,
                  fontSize: '0.65rem',
                }}
              >
                {formatHour(m)}
              </Typography>
            ))}
          </Box>

          {dayOrder.map((day) => {
            const daySlots = timeSlots.filter((slot) => slot.day === day);
            return (
              <Box
                key={day}
                aria-label={intl.formatMessage(messages.dayAvailabilityAriaLabel, { day })}
                sx={{ position: 'relative', height: totalHeight, borderRight: '1px solid', borderColor: 'divider' }}
              >
                {/* Click-to-set shortcut — bottom layer, so it's reachable
                    under both the gridlines and the busy blocks. */}
                {daySlots.map((slot) => {
                  const top = (timeToMinutes(slot.startTime) - bounds.minMinutes) * PIXELS_PER_MINUTE;
                  const height = (timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime)) * PIXELS_PER_MINUTE;
                  return (
                    <Box
                      key={slot.id}
                      role={onSlotClick ? 'button' : undefined}
                      tabIndex={onSlotClick ? 0 : undefined}
                      aria-label={onSlotClick ? intl.formatMessage(messages.useSlotAriaLabel, { day, slotName: slot.name }) : undefined}
                      onClick={() => onSlotClick?.(day, slot.id)}
                      onKeyDown={(e) => {
                        if (onSlotClick && (e.key === 'Enter' || e.key === ' ')) onSlotClick(day, slot.id);
                      }}
                      sx={{
                        position: 'absolute', top: `${top}px`, height: `${height}px`, left: 0, right: 0,
                        cursor: onSlotClick ? 'pointer' : 'default',
                        '&:hover': onSlotClick ? { bgcolor: 'action.hover' } : undefined,
                      }}
                    />
                  );
                })}

                {/* Hour gridlines — purely visual */}
                {hourMarks.map((m) => (
                  <Box
                    key={m}
                    sx={{
                      position: 'absolute',
                      top: `${(m - bounds.minMinutes) * PIXELS_PER_MINUTE}px`,
                      left: 0, right: 0,
                      borderTop: '1px solid', borderColor: 'divider',
                      pointerEvents: 'none',
                    }}
                  />
                ))}

                {/* Busy blocks from all three resources, plus the class
                    being edited itself (source 'editing') at whichever slot
                    is currently selected — it's just another block here, so
                    it moves like any other event would when the caller
                    re-derives it from a new Day/Period selection. */}
                {blocks.filter((block) => block.day === day).map((block) => {
                  const cls = classById.get(block.classId);
                  if (cls === undefined) return null;
                  const isEditing = block.source === 'editing';
                  const label = busyLabel(block, cls);
                  // Editing block's tooltip names the class ("This Class:
                  // Biology 101"); busy blocks say what the room/professor/
                  // student group is busy with ("Room 204 busy with Biology
                  // 101"), reusing the same text already on the tile.
                  const tooltip = isEditing
                    ? intl.formatMessage(messages.blockTooltip, { label: intl.formatMessage(messages.editing), title: cls.title })
                    : intl.formatMessage(messages.busyTooltip, { label, title: cls.title });
                  // The block can't rely on pointer-events: none to let
                  // clicks fall through to the slot underneath anymore
                  // (that also blocked the hover the Tooltip needs), so it
                  // re-triggers the same slot itself — the one whose start
                  // matches this block's, i.e. the slot the class starts in.
                  const underlyingSlot = daySlots.find(
                    (slot) => timeToMinutes(slot.startTime) === block.startMinutes,
                  );
                  return (
                    <OverlayClassBlock
                      key={`${block.source}-${block.classId}-${block.day}`}
                      label={label}
                      tooltip={tooltip}
                      block={block}
                      minMinutes={bounds.minMinutes}
                      pixelsPerMinute={PIXELS_PER_MINUTE}
                      bgcolor={isEditing ? EDITING_BGCOLOR : BUSY_BGCOLOR}
                      color={isEditing ? EDITING_COLOR : BUSY_COLOR}
                      Icon={isEditing ? Edit : undefined}
                      onClick={onSlotClick && underlyingSlot ? () => onSlotClick(day, underlyingSlot.id) : undefined}
                      animateMove={isEditing}
                      dimmed={!isEditing}
                      highlighted={isEditing}
                    />
                  );
                })}
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}
