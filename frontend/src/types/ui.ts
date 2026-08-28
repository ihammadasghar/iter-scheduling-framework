// Frontend-only types — UI state shapes not part of the backend domain.
import type { MetricDirection, MetricResult, Simulation } from './domain';

export type UserRole = 'professor' | 'student' | 'admin';

// Who is using the app right now — chosen once via the onboarding flow and
// persisted to localStorage (see identitySlice.ts). There is no real
// authentication in this system (see docs/system-architecture.md §3), so
// this is a frontend-only stand-in: exactly one of professorId/studentGroupId
// is set, matching `role`.
export interface Identity {
  readonly role: UserRole;
  readonly professorId: string | null;    // set iff role === 'professor'
  readonly studentGroupId: string | null; // set iff role === 'student'
}

export type ViewByOption = 'room' | 'professor' | 'studentGroup';

export interface ClassChipState {
  readonly classId: string;
  readonly hasConflict: boolean;
  readonly isSelected: boolean;
}

// Simulation card data — enriched with live conflict count and key metric
export interface SimulationCardData extends Simulation {
  readonly conflictCount?: number;
  readonly metrics?: readonly MetricResult[];
}

// A single parsed change from the proposal diff (used in Diff Review Screen)
export interface FieldChange {
  readonly field: string;    // Human-readable label e.g. "Room", "Lecturer", "Time"
  readonly from: string;     // Resolved name of old value
  readonly to: string;       // Resolved name of new value
}

export interface ClassChange {
  readonly classId: string;
  readonly className: string;  // Resolved class title
  readonly changes: readonly FieldChange[];
}

// HUD conflict popover item
export interface ConflictDisplayItem {
  readonly conflictId: string;
  readonly message: string;   // Plain English — never the raw type code
  readonly primaryClassId: string;
}

// Metric change after applying a suggestion
export interface MetricDelta {
  readonly name: string;
  readonly before: number;
  readonly after: number;
  readonly unit: string;
  readonly direction?: MetricDirection;
}
