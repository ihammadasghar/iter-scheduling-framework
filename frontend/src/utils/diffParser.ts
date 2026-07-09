import type { ScheduleJson } from '@/types/schedule';

export interface FieldChange {
  readonly field: string;
  readonly from: string;
  readonly to: string;
}

export interface ClassChange {
  readonly className: string;
  readonly changes: readonly FieldChange[];
}

// Maps internal field names to human-readable labels
const FIELD_LABELS: Record<string, string> = {
  professorId: 'Lecturer',
  roomId: 'Room',
  timeSlotIds: 'Time',
};

// Resolve a room ID → human-readable label using schedule master data
const resolveRoom = (id: string, schedule: ScheduleJson): string => {
  const room = schedule.rooms.find((r) => r.id === id);
  return room ? `${room.name} (${room.building})` : id;
};

// Resolve a professor ID → human-readable label
const resolveProfessor = (id: string, schedule: ScheduleJson): string => {
  const prof = schedule.professors.find((p) => p.id === id);
  return prof ? prof.name : id;
};

// Resolve a time slot ID → human-readable label (e.g. "TS_MON_P1" → "Monday P1")
const resolveTimeSlot = (id: string, schedule: ScheduleJson): string => {
  const slot = schedule.timeSlots.find((t) => t.id === id);
  if (!slot) return id;
  return `${slot.day} ${slot.name}`;
};

// Resolve an array of time slot IDs to a readable joined string
const resolveTimeSlots = (ids: readonly string[], schedule: ScheduleJson): string =>
  ids.map((id) => resolveTimeSlot(id, schedule)).join(', ');

// Resolve any field value to a human-readable string
const resolveFieldValue = (
  field: string,
  rawValue: unknown,
  schedule: ScheduleJson,
): string => {
  if (field === 'roomId' && typeof rawValue === 'string') {
    return resolveRoom(rawValue, schedule);
  }
  if (field === 'professorId' && typeof rawValue === 'string') {
    return resolveProfessor(rawValue, schedule);
  }
  if (field === 'timeSlotIds' && Array.isArray(rawValue)) {
    return resolveTimeSlots(rawValue as string[], schedule);
  }
  return String(rawValue ?? '');
};

// Parse a single JSON line from the diff into a partial class object
const parseClassLine = (line: string): Record<string, unknown> | null => {
  // Lines look like: +  { "id": "CLS_00001", "roomId": "RM_101", ... },
  const trimmed = line.replace(/^[+-]\s*/, '').trim().replace(/,$/, '');
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
};

// Determine if a diff line is inside the "classes" section
const isClassesSection = (inClasses: boolean, line: string): boolean => {
  if (line.includes('"classes"')) return true;
  // Heuristic: once we see a closing `]` after entering the section, we may leave it
  if (inClasses && line.trim() === ']') return false;
  return inClasses;
};

/**
 * Parses a unified diff string from a ProposalDetail and returns
 * human-readable class change summaries.
 *
 * This is a pure function — no side effects, no external dependencies.
 */
export function parseDiff(diff: string, schedule: ScheduleJson): ClassChange[] {
  const lines = diff.split('\n');

  // Collect removed (-) and added (+) class entries keyed by id
  const removedById = new Map<string, Record<string, unknown>>();
  const addedById = new Map<string, Record<string, unknown>>();

  let inClasses = false;

  for (const line of lines) {
    inClasses = isClassesSection(inClasses, line);
    if (!inClasses) continue;

    if (line.startsWith('-') && !line.startsWith('---')) {
      const obj = parseClassLine(line);
      if (obj && typeof obj['id'] === 'string') {
        removedById.set(obj['id'], obj);
      }
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      const obj = parseClassLine(line);
      if (obj && typeof obj['id'] === 'string') {
        addedById.set(obj['id'], obj);
      }
    }
  }

  // Pair removed & added by id — only ids that appear in both are real changes
  const changedIds = [...addedById.keys()].filter((id) => removedById.has(id));

  return changedIds.reduce<ClassChange[]>((acc, id) => {
    const before = removedById.get(id)!;
    const after = addedById.get(id)!;

    const relevantFields = Object.keys(FIELD_LABELS) as Array<keyof typeof FIELD_LABELS>;
    const fieldChanges = relevantFields.reduce<FieldChange[]>((changes, field) => {
      const oldVal = before[field];
      const newVal = after[field];
      if (JSON.stringify(oldVal) === JSON.stringify(newVal)) return changes;

      return [
        ...changes,
        {
          field: FIELD_LABELS[field]!,
          from: resolveFieldValue(field, oldVal, schedule),
          to: resolveFieldValue(field, newVal, schedule),
        },
      ];
    }, []);

    if (fieldChanges.length === 0) return acc;

    // Resolve class title from schedule master data
    const classEntry = schedule.classes.find((c) => c.id === id);
    const className = classEntry ? classEntry.title : (typeof after['title'] === 'string' ? after['title'] : id);

    return [...acc, { className, changes: fieldChanges }];
  }, []);
}
