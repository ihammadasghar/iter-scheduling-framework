import { useMemo } from 'react';
import { Box, Chip, Stack, Typography } from '@mui/material';
import OverlayClassBlock from '@/atoms/OverlayClassBlock';
import { useScheduleNames } from '@/hooks/useScheduleNames';
import { deriveDayOrder, computeCalendarBounds, timeToMinutes } from '@/utils/calendarLayout';
import type { OverlayBlock, OverlaySource } from '@/utils/overlayLayout';
import type { RawTimeSlot, ScheduleClass } from '@/types';

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
}

const PIXELS_PER_MINUTE = 1;
const HOUR_GUTTER_WIDTH = 56;
// Each side-by-side lane needs enough width for a short course code
// ("BIO101") not to be squeezed unreadable — day columns widen with the
// busiest overlap on record instead of staying at a fixed width regardless
// of how many classes stack up on the same slot.
const MIN_DAY_COLUMN_WIDTH = 110;
const MIN_LANE_WIDTH = 70;

// Four fixed, legend-labeled colors — deliberately distinct from the app's
// semantic warning (conflict) / success (available) colors used elsewhere,
// so this palette reads as "whose schedule" rather than "good/bad". Only
// two of MUI's named roles are otherwise unclaimed (secondary, info); the
// rest are plain literals since there's no unused semantic slot left.
const SOURCE_COLORS: Record<OverlaySource, { bgcolor: string; color: string; label: string }> = {
  room: { bgcolor: 'info.main', color: 'info.contrastText', label: 'Room' },
  professor: { bgcolor: 'secondary.main', color: 'secondary.contrastText', label: 'Professor' },
  group: { bgcolor: '#6a1b9a', color: '#ffffff', label: 'Student Group' },
  editing: { bgcolor: '#ffab00', color: '#000000', label: 'This Class' },
};

/** 630 → "10 AM" */
const formatHour = (minutes: number): string => {
  const hour = Math.floor(minutes / 60);
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour} ${period}`;
};

/**
 * Overlays the room's, professor's, and student group's weekly schedules on
 * one calendar for the Edit Assignment dialog — a sibling to
 * MyScheduleCalendar.tsx (same grid geometry) but for three color-coded
 * sources instead of one signed-in identity's own classes.
 */
export default function AssignmentOverlayCalendar({
  blocks,
  classById,
  timeSlots,
  onSlotClick,
}: AssignmentOverlayCalendarProps): React.ReactElement {
  const names = useScheduleNames();
  const dayOrder = useMemo(() => deriveDayOrder(timeSlots), [timeSlots]);
  const bounds = useMemo(() => computeCalendarBounds(timeSlots), [timeSlots]);
  const dayColumnWidth = useMemo(
    () => Math.max(MIN_DAY_COLUMN_WIDTH, ...blocks.map((b) => b.laneCount * MIN_LANE_WIDTH)),
    [blocks],
  );

  const totalHeight = Math.max((bounds.maxMinutes - bounds.minMinutes) * PIXELS_PER_MINUTE, 0);
  const hourMarks: number[] = [];
  for (let m = Math.ceil(bounds.minMinutes / 60) * 60; m <= bounds.maxMinutes; m += 60) {
    hourMarks.push(m);
  }

  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap', rowGap: 1 }} aria-label="Schedule color legend">
        {(Object.keys(SOURCE_COLORS) as OverlaySource[]).map((source) => (
          <Chip
            key={source}
            size="small"
            label={SOURCE_COLORS[source].label}
            sx={{ bgcolor: SOURCE_COLORS[source].bgcolor, color: SOURCE_COLORS[source].color }}
          />
        ))}
      </Stack>

      <Box
        aria-label="Room, professor, and student group schedule overlay"
        sx={{ overflow: 'auto', maxHeight: 360, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
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
                aria-label={`${day} availability`}
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
                      aria-label={onSlotClick ? `Use ${day} ${slot.name}` : undefined}
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
                    is currently selected — it's just another colored block
                    here, so it moves like any other event would when the
                    caller re-derives it from a new Day/Period selection. */}
                {blocks.filter((block) => block.day === day).map((block) => {
                  const cls = classById.get(block.classId);
                  if (cls === undefined) return null;
                  const palette = SOURCE_COLORS[block.source];
                  return (
                    <OverlayClassBlock
                      key={`${block.source}-${block.classId}-${block.day}`}
                      label={names.courseCode(cls.courseId)}
                      tooltip={`${palette.label}: ${cls.title}`}
                      block={block}
                      minMinutes={bounds.minMinutes}
                      pixelsPerMinute={PIXELS_PER_MINUTE}
                      bgcolor={palette.bgcolor}
                      color={palette.color}
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
