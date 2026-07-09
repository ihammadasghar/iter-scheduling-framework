// Frontend-only types — UI state shapes not part of the backend domain.
import type { MetricResult, Simulation } from './domain';

export type UserRole = 'user' | 'admin';

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
