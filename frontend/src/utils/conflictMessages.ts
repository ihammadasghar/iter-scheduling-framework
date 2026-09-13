import { defineMessages, type IntlShape } from 'react-intl';
import type { Conflict, ConflictType, ScheduleClass } from '@/types';
import { FORMATTER_NAMES, type ScheduleNames } from './scheduleNames';

const messages = defineMessages({
  roomDoubleBook: {
    id: 'conflictMessages.roomDoubleBook',
    // resourceName is already fully formatted via formatRoomLabel (e.g.
    // "Room 101" or "Lab A") — don't prepend "Room " again here.
    defaultMessage: '{resourceName} is booked for two classes at the same time',
  },
  professorOverlap: {
    id: 'conflictMessages.professorOverlap',
    defaultMessage: '{resourceName} is already teaching another class at this time',
  },
  groupOverlap: {
    id: 'conflictMessages.groupOverlap',
    defaultMessage: '{resourceName} students are in two classes at once',
  },
  roomCapacityExceeded: {
    id: 'conflictMessages.roomCapacityExceeded',
    defaultMessage: "{resourceName} exceeds the room's capacity",
  },
  consecutiveLimitExceeded: {
    id: 'conflictMessages.consecutiveLimitExceeded',
    defaultMessage: '{resourceName} teaches too many consecutive periods',
  },
  gapLimitExceeded: {
    id: 'conflictMessages.gapLimitExceeded',
    defaultMessage: '{resourceName} has an excessive gap between classes',
  },
  unknownResource: {
    id: 'conflictMessages.unknownResource',
    defaultMessage: 'Unknown',
  },
});

/**
 * Pure function — maps a conflict type + resolved resource name to a plain-language sentence.
 * Never exposes type codes to the user.
 */
export const getConflictMessage = (intl: IntlShape, type: ConflictType, resourceName: string): string => {
  switch (type) {
    case 'ROOM_DOUBLE_BOOK':
      return intl.formatMessage(messages.roomDoubleBook, { resourceName });
    case 'PROFESSOR_OVERLAP':
      return intl.formatMessage(messages.professorOverlap, { resourceName });
    case 'GROUP_OVERLAP':
      return intl.formatMessage(messages.groupOverlap, { resourceName });
    case 'ROOM_CAPACITY_EXCEEDED':
      return intl.formatMessage(messages.roomCapacityExceeded, { resourceName });
    case 'CONSECUTIVE_LIMIT_EXCEEDED':
      return intl.formatMessage(messages.consecutiveLimitExceeded, { resourceName });
    case 'GAP_LIMIT_EXCEEDED':
      return intl.formatMessage(messages.gapLimitExceeded, { resourceName });
  }
};

// Resolves the human-readable name of the resource (room/professor/group) a
// conflict is about — the same resource is shared by both classes in the
// pair, so it doesn't matter which of classIds[0]/[1] is "self" here.
// `names` defaults to the ID-parsing fallback so every existing caller (and
// test) that doesn't have a roster loaded keeps compiling and behaving
// exactly as before.
export const resolveConflictResourceName = (
  intl: IntlShape,
  conflict: Conflict,
  classes: readonly ScheduleClass[],
  names: ScheduleNames = FORMATTER_NAMES,
): string => {
  const cls = classes.find((c) => c.id === conflict.classIds[0]);
  if (!cls) return intl.formatMessage(messages.unknownResource);
  switch (conflict.type) {
    case 'ROOM_DOUBLE_BOOK':
      return names.roomName(cls.roomId);
    case 'PROFESSOR_OVERLAP':
      return names.professorName(cls.professorId);
    case 'GROUP_OVERLAP':
      return names.groupName(cls.studentGroupId);
    case 'ROOM_CAPACITY_EXCEEDED':
      return `${names.groupName(cls.studentGroupId)} in ${names.roomName(cls.roomId)}`;
    case 'CONSECUTIVE_LIMIT_EXCEEDED':
    case 'GAP_LIMIT_EXCEEDED':
      // Both policy constraints are professor-scoped: the same professor
      // teaches classIds[0] and classIds[1], so it doesn't matter which one
      // "self" resolves to here (same as the ROOM_DOUBLE_BOOK-style cases).
      return names.professorName(cls.professorId);
  }
};

// Full plain-language sentence for a conflict — combines the two helpers above.
export const describeConflict = (
  intl: IntlShape,
  conflict: Conflict,
  classes: readonly ScheduleClass[],
  names: ScheduleNames = FORMATTER_NAMES,
): string => getConflictMessage(intl, conflict.type, resolveConflictResourceName(intl, conflict, classes, names));
