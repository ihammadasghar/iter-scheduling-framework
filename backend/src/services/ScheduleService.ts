import { parseScheduleJson } from '../utils/ScheduleHydrator.js';
import type { IGitHubService } from '../interfaces/IGitHubService.js';
import type { IScheduleService } from '../interfaces/IScheduleService.js';
import type { ListClassesResult } from '../types/domain.js';
import type { ScheduleJson, ScheduleRoster } from '../types/scheduleJson.js';

const SOURCE_BRANCH = 'main';
const SCHEDULE_JSON_PATH = 'schedule.json';
// High enough that a real institution-scale schedule (thousands of classes,
// e.g. ISCTE's ~4,900) fits on one page — readPublishedSchedule() re-fetches
// and re-parses the *entire* schedule.json from GitHub on every call, so a
// small page size doesn't just mean more requests, it means that full
// fetch+parse repeated once per page. Must stay in sync with frontend
// PAGE_SIZE (classSlice.ts, TimetablePage.tsx, PublishedSchedulePage.tsx,
// SimulationDashboardPage.tsx) — see comments there.
const MAX_LIMIT = 1000;

// Reads main's schedule.json directly and paginates in memory. Deliberately
// has no IGraphService/ISessionRegistry dependency — there is no simulation
// session here, just a straight read of what's currently published.
export class ScheduleService implements IScheduleService {
  constructor(private readonly github: IGitHubService) {}

  async listClasses(page: number, limit: number): Promise<ListClassesResult> {
    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const requestedLimit = Number.isFinite(limit) && limit > 0 ? limit : 20;
    const safeLimit = Math.min(requestedLimit, MAX_LIMIT);

    const { classes } = await this.readPublishedSchedule();

    const skip = Math.max(0, (safePage - 1) * safeLimit);
    const data = classes.slice(skip, skip + safeLimit);

    return { data, total: classes.length, page: safePage, limit: safeLimit };
  }

  async getRoster(): Promise<ScheduleRoster> {
    const { metadata, timeSlots, rooms, professors, studentGroups, courses } =
      await this.readPublishedSchedule();

    // Explicit field-by-field, not a spread: classes must never leak into
    // this response, and a hand-edited schedule.json missing an array
    // should degrade to [] rather than undefined on the wire.
    return {
      metadata,
      timeSlots: timeSlots ?? [],
      rooms: rooms ?? [],
      professors: professors ?? [],
      studentGroups: studentGroups ?? [],
      courses: courses ?? [],
    };
  }

  private async readPublishedSchedule(): Promise<ScheduleJson> {
    const scheduleJson = await this.github.readFile(SOURCE_BRANCH, SCHEDULE_JSON_PATH);
    return parseScheduleJson(scheduleJson);
  }
}
