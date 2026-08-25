// Pure, dependency-free comparison of two already-hydrated schedules. Used by
// ProposalService to build a full change list (added/removed/changed classes)
// and conflict delta between the published (`main`) schedule and a proposal's
// candidate branch, without depending on git-text diffing.

import type { RawClass, ScheduleJson } from '../types/scheduleJson.js';
import type { ChangedClass, ClassFieldDiff, Conflict, ConflictDelta, ScheduleDiff } from '../types/domain.js';

const CLASS_FIELDS = [
  'courseId',
  'title',
  'professorId',
  'studentGroupId',
  'roomId',
  'timeSlotIds',
] as const satisfies readonly ClassFieldDiff['field'][];

// `timeSlotIds` is a set, not a sequence — hydration/export order isn't
// guaranteed to match the source order, so compare it order-independently
// rather than flagging a reorder as a change.
function fieldsDiffer(field: (typeof CLASS_FIELDS)[number], before: unknown, after: unknown): boolean {
  if (field === 'timeSlotIds') {
    const a = [...(before as readonly string[])].sort();
    const b = [...(after as readonly string[])].sort();
    return JSON.stringify(a) !== JSON.stringify(b);
  }
  return before !== after;
}

function diffClass(before: RawClass, after: RawClass): readonly ClassFieldDiff[] {
  return CLASS_FIELDS.filter((field) => fieldsDiffer(field, before[field], after[field])).map((field) => ({
    field,
    before: before[field],
    after: after[field],
  }));
}

// Compares two schedules' `classes` by id. Roster comparison (rooms,
// professors, courses, student groups, time slots) is out of scope — this is
// about schedule/class assignment changes, which is what a proposal changes.
export function diffSchedules(main: ScheduleJson, candidate: ScheduleJson): ScheduleDiff {
  const mainById = new Map(main.classes.map((c) => [c.id, c] as const));
  const candidateById = new Map(candidate.classes.map((c) => [c.id, c] as const));

  const added = candidate.classes.filter((c) => !mainById.has(c.id));
  const removed = main.classes.filter((c) => !candidateById.has(c.id));

  const changed: ChangedClass[] = [];
  for (const [classId, before] of mainById) {
    const after = candidateById.get(classId);
    if (!after) continue;
    const fieldChanges = diffClass(before, after);
    if (fieldChanges.length > 0) {
      changed.push({ classId, before, after, fieldChanges });
    }
  }

  return { added, removed, changed };
}

// Matches conflicts by their deterministic id (see GraphService.queryConflicts).
export function diffConflictsById(
  baseline: readonly Conflict[],
  candidate: readonly Conflict[],
): ConflictDelta {
  const baselineIds = new Set(baseline.map((c) => c.id));
  const candidateIds = new Set(candidate.map((c) => c.id));

  return {
    added: candidate.filter((c) => !baselineIds.has(c.id)),
    resolved: baseline.filter((c) => !candidateIds.has(c.id)),
  };
}
