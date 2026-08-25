import type { ListClassesResult } from '../types/domain.js';
import type { ScheduleRoster } from '../types/scheduleJson.js';

export interface IScheduleService {
  // Reads the currently published schedule straight from `main` — no branch
  // creation, no Memgraph hydration, no session tracking. Purely a read.
  listClasses(page: number, limit: number): Promise<ListClassesResult>;
  // Master data (rooms/professors/courses/groups/time slots) for `main` —
  // lets the UI resolve a class's ID fields to real names. Deliberately
  // separate from listClasses: that method pages through classes, so folding
  // this in would ship the roster once per page instead of once per view.
  getRoster(): Promise<ScheduleRoster>;
}
