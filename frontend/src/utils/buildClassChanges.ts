// Maps the backend's raw class-level diff (ChangedClass[], matched by id,
// with values as-is on the schedule) into the display-ready ClassChange[]
// shape (human-readable field labels and resolved before/after strings).
// Generalizes what diffParser.ts used to do by hand off a git-text diff —
// this now covers every RawClass field, not a 3-field whitelist.
import { defineMessages, type IntlShape } from 'react-intl';
import { formatTimeSlotFull } from './scheduleFormatters';
import type { ScheduleNames } from './scheduleNames';
import type { ChangedClass, ClassChange, ClassFieldDiff, FieldChange } from '@/types';

const fieldMessages = defineMessages({
  courseId: { id: 'buildClassChanges.field.course', defaultMessage: 'Course' },
  title: { id: 'buildClassChanges.field.title', defaultMessage: 'Title' },
  professorId: { id: 'buildClassChanges.field.professor', defaultMessage: 'Professor' },
  studentGroupId: { id: 'buildClassChanges.field.studentGroup', defaultMessage: 'Group' },
  roomId: { id: 'buildClassChanges.field.room', defaultMessage: 'Room' },
  timeSlotIds: { id: 'buildClassChanges.field.time', defaultMessage: 'Time' },
});

function resolveFieldValue(field: ClassFieldDiff['field'], value: unknown, names: ScheduleNames): string {
  switch (field) {
    case 'roomId':
      return names.roomName(value as string);
    case 'professorId':
      return names.professorName(value as string);
    case 'studentGroupId':
      return names.groupName(value as string);
    case 'courseId':
      return names.courseName(value as string);
    case 'timeSlotIds':
      return (value as readonly string[]).map(formatTimeSlotFull).join(', ');
    case 'title':
      return String(value ?? '');
  }
}

export function buildClassChanges(
  intl: IntlShape,
  changed: readonly ChangedClass[],
  names: ScheduleNames,
): ClassChange[] {
  return changed.map((c) => ({
    classId: c.classId,
    className: c.after.title,
    changes: c.fieldChanges.map(
      (fc): FieldChange => ({
        field: intl.formatMessage(fieldMessages[fc.field]),
        from: resolveFieldValue(fc.field, fc.before, names),
        to: resolveFieldValue(fc.field, fc.after, names),
      }),
    ),
  }));
}
