// Pure derivation for the Edit Assignment dialog's overlay calendar — turns
// three separately-filtered class lists (one per resource: room, professor,
// student group) into one combined, lane-collision-resolved block list, each
// tagged with which resource it came from. No React, fully unit-testable in
// isolation (mirrors calendarLayout.ts).
import { buildDayEntries, layoutDay } from './calendarLayout';
import type { CalendarBlock } from './calendarLayout';
import type { RawTimeSlot, ScheduleClass } from '@/types';

// 'editing' is the class the dialog is editing itself, rendered as its own
// highlighted event at whichever slot is currently selected — not a
// resource's busy schedule, so it isn't excluded/deduped against the other
// three the way a same-room/professor/group class would be.
export type OverlaySource = 'room' | 'professor' | 'group' | 'editing';

export interface OverlayBlock extends CalendarBlock {
  readonly source: OverlaySource;
}

export interface SourcedClasses {
  readonly source: OverlaySource;
  readonly classes: readonly ScheduleClass[];
}

// layoutDay's collision algorithm keys everything by `classId` alone — the
// same class appearing under two sources (e.g. some other class happens to
// already sit in both the room and with the professor being tried) would
// otherwise collapse into one entry. Tagging the id with its source before
// layout, then splitting it back apart after, keeps every source's
// occurrence distinct and side-by-side without touching layoutDay itself.
const tag = (source: OverlaySource, classId: string): string => `${source}:${classId}`;
const untag = (tagged: string): { source: OverlaySource; classId: string } => {
  const [source, ...rest] = tagged.split(':');
  return { source: source as OverlaySource, classId: rest.join(':') };
};

export const buildOverlayBlocks = (
  sourcedClasses: readonly SourcedClasses[],
  timeSlotById: ReadonlyMap<string, RawTimeSlot>,
): readonly OverlayBlock[] => {
  const taggedClasses = sourcedClasses.flatMap(({ source, classes }) =>
    classes.map((c) => ({ ...c, id: tag(source, c.id) })));

  const entries = buildDayEntries(taggedClasses, timeSlotById);
  const byDay = new Map<string, typeof entries>();
  entries.forEach((entry) => {
    const list = byDay.get(entry.day) ?? [];
    list.push(entry);
    byDay.set(entry.day, list);
  });

  const blocks: OverlayBlock[] = [];
  byDay.forEach((dayEntries) => {
    layoutDay(dayEntries).forEach((block) => {
      const { source, classId } = untag(block.classId);
      blocks.push({ ...block, source, classId });
    });
  });
  return blocks;
};
