// Shared by TimetableGrid and MyScheduleCalendar — one place for turning
// raw Conflict[] into a per-class, one-line human summary.
import { getConflictMessage, resolveConflictResourceName } from './conflictMessages';
import type { Conflict, ScheduleClass } from '@/types';
import type { ScheduleNames } from './scheduleNames';

/**
 * One-line, human-readable summary per conflicted class — shown on hover so
 * the warning icon is self-explanatory without having to click into the
 * Inspector first. Clicking the chip/block still opens the full detail there.
 */
export const buildConflictSummaries = (
  conflicts: readonly Conflict[],
  classes: readonly ScheduleClass[],
  names: ScheduleNames,
): Map<string, string> => {
  const byClassId = new Map<string, Conflict[]>();
  conflicts.forEach((c) => {
    c.classIds.forEach((id) => {
      const list = byClassId.get(id) ?? [];
      list.push(c);
      byClassId.set(id, list);
    });
  });

  const summaries = new Map<string, string>();
  byClassId.forEach((classConflicts, classId) => {
    const first = classConflicts[0]!;
    const message = getConflictMessage(first.type, resolveConflictResourceName(first, classes, names));
    summaries.set(
      classId,
      classConflicts.length > 1 ? `${message} (+${classConflicts.length - 1} more)` : message,
    );
  });
  return summaries;
};
