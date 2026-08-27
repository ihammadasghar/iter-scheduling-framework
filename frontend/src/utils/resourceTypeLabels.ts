// Shared display labels for the room/professor/student-group resource-type
// union (ViewByOption) — used by both ViewBySelector (grouping the Full
// Schedule grid's rows) and ResourcePicker (the Browse tab's entity-type
// selector) so the two pickers never drift out of sync on wording.
import type { ViewByOption } from '@/types';

export const RESOURCE_TYPE_LABELS: Record<ViewByOption, string> = {
  room: 'Room',
  professor: 'Professor',
  studentGroup: 'Student Group',
};
