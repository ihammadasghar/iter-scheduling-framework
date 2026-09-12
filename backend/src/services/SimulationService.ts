import { randomUUID } from 'crypto';
import { ApiError } from '../types/ApiError.js';
import { parseScheduleJson, stringifyScheduleJson } from '../utils/ScheduleHydrator.js';
import { diffSchedules } from '../utils/ScheduleDiffer.js';
import type { IGitHubService } from '../interfaces/IGitHubService.js';
import type { IGraphService } from '../interfaces/IGraphService.js';
import type { ISimulationService, PreviewClassUpdateResult } from '../interfaces/ISimulationService.js';
import type { ISessionRegistry } from '../sessions/ISessionRegistry.js';
import type {
  Simulation,
  CreateSimulationParams,
  ListClassesParams,
  ListClassesResult,
  ScheduleClass,
  UpdateClassParams,
  Suggestion,
  RoomAvailability,
  Conflict,
  MetricResult,
  MetricRule,
  WeightedScoreResult,
  RebaseResult,
} from '../types/domain.js';
import { parseRulesJson } from '../types/rulesJson.js';
import type { ScheduleJson } from '../types/scheduleJson.js';

const SOURCE_BRANCH = 'main';
const SCHEDULE_JSON_PATH = 'schedule.json';
const RULES_JSON_PATH = 'rules.json';

export class SimulationService implements ISimulationService {
  constructor(
    private readonly github: IGitHubService,
    private readonly graph: IGraphService,
    private readonly registry: ISessionRegistry,
  ) {}

  async create(params: CreateSimulationParams): Promise<Simulation> {
    const { userId } = params;
    if (!userId || userId.trim() === '') {
      throw ApiError.badRequest('userId is required');
    }

    const sanitizedUserId = userId.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
    const simulationId = `sim-${sanitizedUserId}-${randomUUID().slice(0, 8)}`;
    const createdAt = new Date().toISOString();

    // Captured before the fork: the version marker a later submit/rebase
    // compares against to detect whether `main` has moved since.
    const { sha: baseScheduleVersion } = await this.github.readFileWithSha(
      SOURCE_BRANCH,
      SCHEDULE_JSON_PATH,
    );

    await this.github.createBranch(simulationId, SOURCE_BRANCH);

    const scheduleJson = await this.github.readFile(simulationId, SCHEDULE_JSON_PATH);

    try {
      await this.graph.hydrate(simulationId, scheduleJson);
    } catch (err) {
      await this.github.deleteBranch(simulationId);
      throw err;
    }

    this.registry.register(simulationId);

    return { id: simulationId, branchId: simulationId, createdAt, baseScheduleVersion };
  }

  // Updates a stale draft to reflect the latest published schedule while
  // preserving exactly what the user changed. Isolates the user's edits by
  // diffing their draft against the *old* main (the version their draft was
  // originally forked from, fetched by its content-addressed blob SHA —
  // `main` itself has since moved past it), then reapplies those edits on
  // top of the *current* main. The user's edits always win on any class
  // their draft touched; any resulting clash just surfaces as an ordinary
  // conflict, the same as any other edit's would.
  async rebase(simulationId: string, baseScheduleVersion: string): Promise<RebaseResult> {
    const touched = this.registry.touch(simulationId);
    if (!touched) {
      throw ApiError.notFound('Simulation not found or expired');
    }

    const oldMainJson = await this.github.readBlobBySha(baseScheduleVersion);
    const candidateJson = await this.github.readFile(simulationId, SCHEDULE_JSON_PATH);
    const { content: newMainJson, sha: newBaseScheduleVersion } = await this.github.readFileWithSha(
      SOURCE_BRANCH,
      SCHEDULE_JSON_PATH,
    );

    const oldMain = parseScheduleJson(oldMainJson);
    const candidate = parseScheduleJson(candidateJson);
    const newMain = parseScheduleJson(newMainJson);

    const changes = diffSchedules(oldMain, candidate);

    const mergedClasses = new Map(newMain.classes.map((c) => [c.id, c] as const));
    for (const changedClass of changes.changed) {
      mergedClasses.set(changedClass.classId, changedClass.after);
    }
    for (const addedClass of changes.added) {
      if (!mergedClasses.has(addedClass.id)) {
        mergedClasses.set(addedClass.id, addedClass);
      }
    }
    for (const removedClass of changes.removed) {
      mergedClasses.delete(removedClass.id);
    }

    const mergedJson = stringifyScheduleJson({ ...newMain, classes: [...mergedClasses.values()] });

    await this.github.writeFile(
      simulationId,
      SCHEDULE_JSON_PATH,
      mergedJson,
      'chore(schedule): rebase draft onto latest published schedule',
    );

    await this.graph.flush(simulationId);
    await this.graph.hydrate(simulationId, mergedJson);

    return { baseScheduleVersion: newBaseScheduleVersion };
  }

  async delete(simulationId: string): Promise<void> {
    const touched = this.registry.touch(simulationId);
    if (!touched) {
      throw ApiError.notFound('Simulation not found or expired');
    }

    await this.graph.flush(simulationId);
    await this.github.deleteBranch(simulationId);
    this.registry.remove(simulationId);
  }

  async heartbeat(simulationId: string): Promise<void> {
    const found = this.registry.touch(simulationId);
    if (!found) {
      throw ApiError.notFound('Simulation not found or expired');
    }
  }

  async commit(simulationId: string): Promise<void> {
    const touched = this.registry.touch(simulationId);
    if (!touched) {
      throw ApiError.notFound('Simulation not found or expired');
    }

    const existingJson = await this.github.readFile(simulationId, SCHEDULE_JSON_PATH);
    const existing = parseScheduleJson(existingJson);

    const exportedJson = await this.graph.exportScheduleJson(simulationId);
    const exported = parseScheduleJson(exportedJson);

    // Re-serialize via stringifyScheduleJson, not a plain JSON.stringify —
    // exportScheduleJson already produces the seed-fixture-compatible
    // compact-per-array-element format (see its own docstring for why that
    // matters for the admin proposal diff); round-tripping through a plain
    // `JSON.stringify(merged, null, 2)` here would silently spread every
    // field back onto its own line and reintroduce that bug.
    const merged = stringifyScheduleJson({ ...exported, metadata: existing.metadata });

    await this.github.writeFile(
      simulationId,
      SCHEDULE_JSON_PATH,
      merged,
      'chore(schedule): commit simulation changes',
    );
  }

  async listClasses(params: ListClassesParams): Promise<ListClassesResult> {
    const { simulationId, page, limit } = params;

    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const requestedLimit = Number.isFinite(limit) && limit > 0 ? limit : 20;
    // Kept in sync with ScheduleService's MAX_LIMIT and frontend PAGE_SIZE —
    // see the comment there.
    const MAX_LIMIT = 1000;
    const safeLimit = Math.min(requestedLimit, MAX_LIMIT);

    // Ensure simulation exists in registry (session must be active/hydrated).
    // Calling touch refreshes the heartbeat and returns false if not registered.
    const touched = this.registry.touch(simulationId);
    if (!touched) {
      throw ApiError.notFound('Simulation not found or expired');
    }

    const total = await this.graph.countClasses(simulationId);
    const data = await this.graph.listClasses(simulationId, safePage, safeLimit);

    return {
      data,
      total,
      page: safePage,
      limit: safeLimit,
    };
  }

  async updateClass(
    simulationId: string,
    classId: string,
    patch: UpdateClassParams,
  ): Promise<ScheduleClass> {
    const touched = this.registry.touch(simulationId);
    if (!touched) {
      throw ApiError.notFound('Simulation not found or expired');
    }

    if (
      patch.roomId === undefined
      && patch.timeSlotIds === undefined
      && patch.professorId === undefined
      && patch.studentGroupId === undefined
    ) {
      throw ApiError.badRequest(
        'Patch must include at least one field: roomId, timeSlotIds, professorId, or studentGroupId',
      );
    }

    return this.graph.updateClass(simulationId, classId, patch);
  }

  async getSuggestions(simulationId: string, classId: string): Promise<readonly Suggestion[]> {
    const touched = this.registry.touch(simulationId);
    if (!touched) {
      throw ApiError.notFound('Simulation not found or expired');
    }

    return this.graph.getSuggestions(simulationId, classId);
  }

  async getRoomAvailability(simulationId: string, classId: string): Promise<readonly RoomAvailability[]> {
    const touched = this.registry.touch(simulationId);
    if (!touched) {
      throw ApiError.notFound('Simulation not found or expired');
    }

    return this.graph.getRoomAvailability(simulationId, classId);
  }

  async getConflicts(simulationId: string): Promise<readonly Conflict[]> {
    const touched = this.registry.touch(simulationId);
    if (!touched) {
      throw ApiError.notFound('Simulation not found or expired');
    }

    return this.graph.queryConflicts(simulationId);
  }

  async getMetrics(simulationId: string): Promise<readonly MetricResult[]> {
    const touched = this.registry.touch(simulationId);
    if (!touched) {
      throw ApiError.notFound('Simulation not found or expired');
    }

    const rules = await this.readMetricRules();
    if (rules.length === 0) {
      return [];
    }

    return this.graph.evaluateMetrics(simulationId, rules);
  }

  async getScore(simulationId: string): Promise<WeightedScoreResult> {
    const touched = this.registry.touch(simulationId);
    if (!touched) {
      throw ApiError.notFound('Simulation not found or expired');
    }

    const rules = await this.readMetricRules();
    return this.graph.scoreTimetable(simulationId, rules);
  }

  async previewClassUpdate(
    simulationId: string,
    classId: string,
    patch: UpdateClassParams,
  ): Promise<PreviewClassUpdateResult> {
    const touched = this.registry.touch(simulationId);
    if (!touched) {
      throw ApiError.notFound('Simulation not found or expired');
    }

    if (
      patch.roomId === undefined
      && patch.timeSlotIds === undefined
      && patch.professorId === undefined
      && patch.studentGroupId === undefined
    ) {
      throw ApiError.badRequest(
        'Patch must include at least one field: roomId, timeSlotIds, professorId, or studentGroupId',
      );
    }

    const exportedJson = await this.graph.exportScheduleJson(simulationId);
    const schedule = parseScheduleJson(exportedJson);

    const classIndex = schedule.classes.findIndex((c) => c.id === classId);
    if (classIndex === -1) {
      throw ApiError.notFound(`Class "${classId}" not found`);
    }

    const patchedClasses = [...schedule.classes];
    patchedClasses[classIndex] = { ...patchedClasses[classIndex]!, ...patch };
    const patchedSchedule = { ...schedule, classes: patchedClasses };

    const rules = await this.readMetricRules();
    const previewBranchId = `preview-${simulationId}-${randomUUID().slice(0, 8)}`;

    try {
      await this.graph.hydrate(previewBranchId, JSON.stringify(patchedSchedule));
      const [metrics, score] = await Promise.all([
        this.graph.evaluateMetrics(previewBranchId, rules),
        this.graph.scoreTimetable(previewBranchId, rules),
      ]);
      return { metrics, score };
    } finally {
      await this.graph.flush(previewBranchId);
    }
  }

  async getSchedule(simulationId: string): Promise<ScheduleJson> {
    const touched = this.registry.touch(simulationId);
    if (!touched) {
      throw ApiError.notFound('Simulation not found or expired');
    }

    // exportScheduleJson never hydrates metadata into the graph (it's not an
    // entity), so it always comes back as `{}` — read the branch's own
    // schedule.json for the real (static, never-edited-in-a-simulation)
    // metadata and merge it in, same trick commit() already uses on the
    // write path to preserve metadata across a graph round-trip.
    const existingJson = await this.github.readFile(simulationId, SCHEDULE_JSON_PATH);
    const existing = parseScheduleJson(existingJson);

    const exportedJson = await this.graph.exportScheduleJson(simulationId);
    const exported = parseScheduleJson(exportedJson);

    return { ...exported, metadata: existing.metadata };
  }

  private async readMetricRules(): Promise<readonly MetricRule[]> {
    const rulesJson = await this.github.readFile(SOURCE_BRANCH, RULES_JSON_PATH);
    return parseRulesJson(rulesJson).metrics;
  }
}
