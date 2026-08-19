import type { Conflict, ConflictType, ScheduleClass } from '@/types';
import { formatRoomLabel, formatProfessorLabel, formatGroupLabel } from './scheduleFormatters';

/**
 * Pure function — maps a conflict type + resolved resource name to a plain English sentence.
 * Never exposes type codes to the user.
 */
export const getConflictMessage = (type: ConflictType, resourceName: string): string => {
  switch (type) {
    case 'ROOM_DOUBLE_BOOK':
      // resourceName is already fully formatted via formatRoomLabel (e.g.
      // "Room 101" or "Lab A") — don't prepend "Room " again here.
      return `${resourceName} is booked for two classes at the same time`;
    case 'PROFESSOR_OVERLAP':
      return `${resourceName} is already teaching another class at this time`;
    case 'GROUP_OVERLAP':
      return `${resourceName} students are in two classes at once`;
    case 'ROOM_CAPACITY_EXCEEDED':
      return `${resourceName} exceeds the room's capacity`;
  }
};

// Resolves the human-readable name of the resource (room/professor/group) a
// conflict is about — the same resource is shared by both classes in the
// pair, so it doesn't matter which of classIds[0]/[1] is "self" here.
export const resolveConflictResourceName = (
  conflict: Conflict,
  classes: readonly ScheduleClass[],
): string => {
  const cls = classes.find((c) => c.id === conflict.classIds[0]);
  if (!cls) return 'Unknown';
  switch (conflict.type) {
    case 'ROOM_DOUBLE_BOOK':
      return formatRoomLabel(cls.roomId);
    case 'PROFESSOR_OVERLAP':
      return formatProfessorLabel(cls.professorId);
    case 'GROUP_OVERLAP':
      return formatGroupLabel(cls.studentGroupId);
    case 'ROOM_CAPACITY_EXCEEDED':
      return `${formatGroupLabel(cls.studentGroupId)} in ${formatRoomLabel(cls.roomId)}`;
  }
};

// Full plain-English sentence for a conflict — combines the two helpers above.
export const describeConflict = (conflict: Conflict, classes: readonly ScheduleClass[]): string =>
  getConflictMessage(conflict.type, resolveConflictResourceName(conflict, classes));
