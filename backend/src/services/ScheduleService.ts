import { parseScheduleJson } from '../utils/ScheduleHydrator.js';
import type { IGitHubService } from '../interfaces/IGitHubService.js';
import type { IScheduleService } from '../interfaces/IScheduleService.js';
import type { ListClassesResult } from '../types/domain.js';

const SOURCE_BRANCH = 'main';
const SCHEDULE_JSON_PATH = 'schedule.json';
const MAX_LIMIT = 500;

// Reads main's schedule.json directly and paginates in memory. Deliberately
// has no IGraphService/ISessionRegistry dependency — there is no simulation
// session here, just a straight read of what's currently published.
export class ScheduleService implements IScheduleService {
  constructor(private readonly github: IGitHubService) {}

  async listClasses(page: number, limit: number): Promise<ListClassesResult> {
    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const requestedLimit = Number.isFinite(limit) && limit > 0 ? limit : 20;
    const safeLimit = Math.min(requestedLimit, MAX_LIMIT);

    const scheduleJson = await this.github.readFile(SOURCE_BRANCH, SCHEDULE_JSON_PATH);
    const { classes } = parseScheduleJson(scheduleJson);

    const skip = Math.max(0, (safePage - 1) * safeLimit);
    const data = classes.slice(skip, skip + safeLimit);

    return { data, total: classes.length, page: safePage, limit: safeLimit };
  }
}
