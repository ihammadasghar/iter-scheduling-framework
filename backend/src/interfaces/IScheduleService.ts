import type { ListClassesResult } from '../types/domain.js';

export interface IScheduleService {
  // Reads the currently published schedule straight from `main` — no branch
  // creation, no Memgraph hydration, no session tracking. Purely a read.
  listClasses(page: number, limit: number): Promise<ListClassesResult>;
}
