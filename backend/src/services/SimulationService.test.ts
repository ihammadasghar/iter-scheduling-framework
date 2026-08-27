import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SimulationService } from './SimulationService.js';
import type { IGitHubService } from '../interfaces/IGitHubService.js';
import type { IGraphService } from '../interfaces/IGraphService.js';
import type { ISessionRegistry } from '../sessions/ISessionRegistry.js';
import type { Simulation } from '../types/domain.js';

const makeGitHub = (): IGitHubService => ({
  createBranch: vi.fn().mockResolvedValue(undefined),
  deleteBranch: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue('{"metadata":[],"timeSlots":[],"rooms":[],"professors":[],"studentGroups":[],"courses":[],"classes":[]}'),
  readFileWithSha: vi.fn().mockResolvedValue({
    content: '{"metadata":[],"timeSlots":[],"rooms":[],"professors":[],"studentGroups":[],"courses":[],"classes":[]}',
    sha: 'main-sha-1',
  }),
  readBlobBySha: vi.fn().mockResolvedValue(
    '{"metadata":[],"timeSlots":[],"rooms":[],"professors":[],"studentGroups":[],"courses":[],"classes":[]}',
  ),
  writeFile: vi.fn().mockResolvedValue(undefined),
  createPullRequest: vi.fn().mockResolvedValue('pr-1'),
  mergePullRequest: vi.fn().mockResolvedValue(undefined),
  closePullRequest: vi.fn().mockResolvedValue(undefined),
  getPullRequestDiff: vi.fn().mockResolvedValue(''),
  listOpenPullRequests: vi.fn().mockResolvedValue([]),
  addPullRequestComment: vi.fn().mockResolvedValue(undefined),
  getPullRequest: vi.fn().mockResolvedValue({ title: '', head: '', labels: [], createdAt: '' }),
  setPullRequestLabels: vi.fn().mockResolvedValue(undefined),
});

const makeGraph = (): IGraphService => ({
  hydrate: vi.fn().mockResolvedValue(undefined),
  flush: vi.fn().mockResolvedValue(undefined),
  exportScheduleJson: vi.fn().mockResolvedValue('{}'),
  listClasses: vi.fn().mockResolvedValue([]),
  countClasses: vi.fn().mockResolvedValue(0),
  updateClass: vi.fn().mockResolvedValue({}),
  getSuggestions: vi.fn().mockResolvedValue([]),
  getRoomAvailability: vi.fn().mockResolvedValue([]),
  queryConflicts: vi.fn().mockResolvedValue([]),
  evaluateMetrics: vi.fn().mockResolvedValue([]),
  scoreTimetable: vi.fn().mockResolvedValue({ score: 0, breakdown: [] }),
});

const makeRegistry = (touchResult = true): ISessionRegistry => ({
  register: vi.fn(),
  touch: vi.fn().mockReturnValue(touchResult),
  getExpired: vi.fn().mockReturnValue([]),
  remove: vi.fn(),
});

describe('SimulationService.create()', () => {
  let github: IGitHubService;
  let graph: IGraphService;
  let registry: ISessionRegistry;
  let service: SimulationService;

  beforeEach(() => {
    github = makeGitHub();
    graph = makeGraph();
    registry = makeRegistry();
    service = new SimulationService(github, graph, registry);
  });

  it('creates a git branch with a simulationId derived from userId', async () => {
    await service.create({ userId: 'alice' });

    expect(github.createBranch).toHaveBeenCalledOnce();
    const [branchName, source] = (github.createBranch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string];
    expect(branchName).toMatch(/^sim-alice-[0-9a-f]{8}$/);
    expect(source).toBe('main');
  });

  it('reads schedule.json from the newly created branch', async () => {
    await service.create({ userId: 'alice' });

    const [branchName, path] = (github.readFile as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string];
    expect(path).toBe('schedule.json');
    const createdBranch = ((github.createBranch as ReturnType<typeof vi.fn>).mock.calls[0] as [string])[0];
    expect(branchName).toBe(createdBranch);
  });

  it('hydrates the graph with the simulationId and schedule JSON content', async () => {
    await service.create({ userId: 'alice' });

    expect(graph.hydrate).toHaveBeenCalledOnce();
    const [simulationId, json] = (graph.hydrate as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string];
    const createdBranch = ((github.createBranch as ReturnType<typeof vi.fn>).mock.calls[0] as [string])[0];
    expect(simulationId).toBe(createdBranch);
    expect(json).toContain('"classes"');
  });

  it('registers the session in the registry after hydration', async () => {
    await service.create({ userId: 'alice' });

    expect(registry.register).toHaveBeenCalledOnce();
    const registeredId = ((registry.register as ReturnType<typeof vi.fn>).mock.calls[0] as [string])[0];
    const createdBranch = ((github.createBranch as ReturnType<typeof vi.fn>).mock.calls[0] as [string])[0];
    expect(registeredId).toBe(createdBranch);
  });

  it('returns a Simulation with id, branchId, and createdAt', async () => {
    const beforeCall = new Date().toISOString();
    const simulation: Simulation = await service.create({ userId: 'alice' });
    const afterCall = new Date().toISOString();

    expect(simulation.id).toMatch(/^sim-alice-[0-9a-f]{8}$/);
    expect(simulation.branchId).toBe(simulation.id);
    expect(simulation.createdAt >= beforeCall).toBe(true);
    expect(simulation.createdAt <= afterCall).toBe(true);
  });

  it('captures main\'s current schedule.json SHA as baseScheduleVersion', async () => {
    const simulation = await service.create({ userId: 'alice' });

    expect(github.readFileWithSha).toHaveBeenCalledWith('main', 'schedule.json');
    expect(simulation.baseScheduleVersion).toBe('main-sha-1');
  });

  it('captures the baseScheduleVersion before forking the branch', async () => {
    await service.create({ userId: 'alice' });

    const shaCall = (github.readFileWithSha as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0]!;
    const branchCall = (github.createBranch as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0]!;
    expect(shaCall).toBeLessThan(branchCall);
  });

  it('throws 400 if userId is missing', async () => {
    await expect(service.create({ userId: '' })).rejects.toMatchObject({
      statusCode: 400,
      message: 'userId is required',
    });

    expect(github.createBranch).not.toHaveBeenCalled();
    expect(graph.hydrate).not.toHaveBeenCalled();
  });

  it('deletes the github branch if graph hydration fails (rollback)', async () => {
    const hydrateError = new Error('Memgraph unavailable');
    (graph.hydrate as ReturnType<typeof vi.fn>).mockRejectedValue(hydrateError);

    await expect(service.create({ userId: 'alice' })).rejects.toThrow('Memgraph unavailable');

    expect(github.deleteBranch).toHaveBeenCalledOnce();
    const deletedBranch = ((github.deleteBranch as ReturnType<typeof vi.fn>).mock.calls[0] as [string])[0];
    const createdBranch = ((github.createBranch as ReturnType<typeof vi.fn>).mock.calls[0] as [string])[0];
    expect(deletedBranch).toBe(createdBranch);
    expect(registry.register).not.toHaveBeenCalled();
  });
});

describe('SimulationService.heartbeat()', () => {
  let registry: ISessionRegistry;
  let service: SimulationService;

  beforeEach(() => {
    registry = makeRegistry(true);
    service = new SimulationService(makeGitHub(), makeGraph(), registry);
  });

  it('calls registry.touch() with the simulationId', async () => {
    await service.heartbeat('sim-alice-abc123');
    expect(registry.touch).toHaveBeenCalledWith('sim-alice-abc123');
  });

  it('resolves without error when the session is active', async () => {
    await expect(service.heartbeat('sim-alice-abc123')).resolves.toBeUndefined();
  });

  it('throws 404 when the session is not found (GCd or never created)', async () => {
    const registryNotFound = makeRegistry(false);
    const svc = new SimulationService(makeGitHub(), makeGraph(), registryNotFound);
    await expect(svc.heartbeat('sim-gone')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Simulation not found or expired',
    });
  });
});

describe('SimulationService.delete()', () => {
  let github: IGitHubService;
  let graph: IGraphService;
  let registry: ISessionRegistry;
  let service: SimulationService;

  beforeEach(() => {
    github = makeGitHub();
    graph = makeGraph();
    registry = makeRegistry(true);
    service = new SimulationService(github, graph, registry);
  });

  it('throws 404 when the session is not found (GCd or never created)', async () => {
    const registryNotFound = makeRegistry(false);
    const svc = new SimulationService(github, graph, registryNotFound);

    await expect(svc.delete('sim-gone')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Simulation not found or expired',
    });

    expect(graph.flush).not.toHaveBeenCalled();
    expect(github.deleteBranch).not.toHaveBeenCalled();
  });

  it('flushes the graph session, deletes the branch, and removes it from the registry', async () => {
    await service.delete('sim-alice-abc123');

    expect(graph.flush).toHaveBeenCalledWith('sim-alice-abc123');
    expect(github.deleteBranch).toHaveBeenCalledWith('sim-alice-abc123');
    expect(registry.remove).toHaveBeenCalledWith('sim-alice-abc123');
  });

  it('flushes, deletes, and removes in that order', async () => {
    const calls: string[] = [];
    (graph.flush as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      calls.push('flush');
    });
    (github.deleteBranch as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      calls.push('deleteBranch');
    });
    (registry.remove as ReturnType<typeof vi.fn>).mockImplementation(() => {
      calls.push('remove');
    });

    await service.delete('sim-alice-abc123');

    expect(calls).toEqual(['flush', 'deleteBranch', 'remove']);
  });
});

describe('SimulationService.updateClass()', () => {
  const SIM_ID = 'sim-alice-abc123';
  const CLASS_ID = 'CLS_001';
  const UPDATED_CLASS = {
    id: CLASS_ID,
    courseId: 'CRS_001',
    title: 'Biology Lecture',
    professorId: 'PRF_001',
    studentGroupId: 'GRP_001',
    roomId: 'RM_102',
    timeSlotIds: ['TS_MON_P2'],
  };

  let github: IGitHubService;
  let graph: IGraphService;
  let registry: ISessionRegistry;
  let service: SimulationService;

  beforeEach(() => {
    github = makeGitHub();
    graph = makeGraph();
    registry = makeRegistry(true);
    (graph.updateClass as ReturnType<typeof vi.fn>).mockResolvedValue(UPDATED_CLASS);
    service = new SimulationService(github, graph, registry);
  });

  it('throws 404 when the simulation session is not found', async () => {
    const expiredRegistry = makeRegistry(false);
    const svc = new SimulationService(github, graph, expiredRegistry);

    await expect(svc.updateClass(SIM_ID, CLASS_ID, { roomId: 'RM_102' })).rejects.toMatchObject({
      statusCode: 404,
      message: 'Simulation not found or expired',
    });
  });

  it('throws 400 when the patch is empty (no fields provided)', async () => {
    await expect(service.updateClass(SIM_ID, CLASS_ID, {})).rejects.toMatchObject({
      statusCode: 400,
    });

    expect(graph.updateClass).not.toHaveBeenCalled();
  });

  it('delegates to graph.updateClass with the correct arguments', async () => {
    const patch = { roomId: 'RM_102' };
    await service.updateClass(SIM_ID, CLASS_ID, patch);

    expect(graph.updateClass).toHaveBeenCalledOnce();
    expect(graph.updateClass).toHaveBeenCalledWith(SIM_ID, CLASS_ID, patch);
  });

  it('returns the updated ScheduleClass from graph.updateClass', async () => {
    const result = await service.updateClass(SIM_ID, CLASS_ID, { roomId: 'RM_102' });

    expect(result).toEqual(UPDATED_CLASS);
  });

  it('accepts a patch with only timeSlotIds', async () => {
    await expect(
      service.updateClass(SIM_ID, CLASS_ID, { timeSlotIds: ['TS_MON_P2'] }),
    ).resolves.toEqual(UPDATED_CLASS);
  });

  it('accepts a patch with only professorId', async () => {
    await expect(
      service.updateClass(SIM_ID, CLASS_ID, { professorId: 'PRF_002' }),
    ).resolves.toEqual(UPDATED_CLASS);
  });

  it('accepts a patch with only studentGroupId', async () => {
    await expect(
      service.updateClass(SIM_ID, CLASS_ID, { studentGroupId: 'GRP_002' }),
    ).resolves.toEqual(UPDATED_CLASS);
  });
});

describe('SimulationService.commit()', () => {
  const SIM_ID = 'sim-alice-abc123';
  const METADATA = { term: 'Spring 2026', version: '1' };
  const EXISTING_JSON = JSON.stringify({
    metadata: METADATA,
    timeSlots: [], rooms: [], professors: [], studentGroups: [], courses: [], classes: [],
  });
  const EXPORTED_JSON = JSON.stringify({
    metadata: {},
    timeSlots: [{ id: 'TS_MON_P1', day: 'Monday', name: 'P1', startTime: '08:30', endTime: '10:15' }],
    rooms: [], professors: [], studentGroups: [], courses: [], classes: [],
  });

  let github: IGitHubService;
  let graph: IGraphService;
  let registry: ISessionRegistry;
  let service: SimulationService;

  beforeEach(() => {
    github = makeGitHub();
    graph = makeGraph();
    registry = makeRegistry(true);
    (github.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(EXISTING_JSON);
    (graph.exportScheduleJson as ReturnType<typeof vi.fn>).mockResolvedValue(EXPORTED_JSON);
    service = new SimulationService(github, graph, registry);
  });

  it('throws 404 when the simulation session is not found', async () => {
    const expiredRegistry = makeRegistry(false);
    const svc = new SimulationService(github, graph, expiredRegistry);

    await expect(svc.commit(SIM_ID)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Simulation not found or expired',
    });
  });

  it('reads schedule.json from the simulation branch to preserve metadata', async () => {
    await service.commit(SIM_ID);

    expect(github.readFile).toHaveBeenCalledWith(SIM_ID, 'schedule.json');
  });

  it('calls graph.exportScheduleJson with the simulationId', async () => {
    await service.commit(SIM_ID);

    expect(graph.exportScheduleJson).toHaveBeenCalledWith(SIM_ID);
  });

  it('writes the merged JSON to the simulation branch via github.writeFile', async () => {
    await service.commit(SIM_ID);

    expect(github.writeFile).toHaveBeenCalledOnce();
    const [branch, path, , message] = (github.writeFile as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string, string, string];
    expect(branch).toBe(SIM_ID);
    expect(path).toBe('schedule.json');
    expect(message).toBe('chore(schedule): commit simulation changes');
  });

  it('preserves original metadata in the written JSON', async () => {
    await service.commit(SIM_ID);

    const [, , content] = (github.writeFile as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string, string];
    const written = JSON.parse(content) as { metadata: Record<string, unknown> };
    expect(written.metadata).toEqual(METADATA);
  });

  it('includes graph-exported data in the written JSON', async () => {
    await service.commit(SIM_ID);

    const [, , content] = (github.writeFile as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string, string];
    const written = JSON.parse(content) as { timeSlots: unknown[] };
    expect(written.timeSlots).toHaveLength(1);
  });

  it('resolves void on success', async () => {
    await expect(service.commit(SIM_ID)).resolves.toBeUndefined();
  });

  // Regression guard: exportScheduleJson already returns the compact
  // one-array-element-per-line format the admin proposal diff depends on
  // (see GraphService.exportScheduleJson / stringifyScheduleJson) — commit()
  // must preserve that when merging in the preserved metadata, not silently
  // re-flatten it via a plain `JSON.stringify(merged, null, 2)`, which
  // spreads every field onto its own line and breaks the diff parser's
  // "one line = one complete JSON object" assumption for every edited class.
  it('preserves compact one-array-element-per-line formatting when merging in the preserved metadata', async () => {
    await service.commit(SIM_ID);

    const [, , content] = (github.writeFile as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string, string];
    const timeSlotLine = content.split('\n').find((line) => line.includes('TS_MON_P1'));

    expect(timeSlotLine).toBeDefined();
    expect(JSON.parse(timeSlotLine!.replace(/,$/, '').trim())).toEqual({
      id: 'TS_MON_P1', day: 'Monday', name: 'P1', startTime: '08:30', endTime: '10:15',
    });
  });
});

describe('SimulationService.rebase()', () => {
  const SIM_ID = 'sim-alice-abc123';
  const OLD_BASE_SHA = 'old-main-sha';
  const NEW_MAIN_SHA = 'new-main-sha';

  const baseClass = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    id: 'CLS_001', courseId: 'C1', title: 'Bio', professorId: 'P1', studentGroupId: 'G1',
    roomId: 'RM_101', timeSlotIds: ['TS1'], ...overrides,
  });

  // What main looked like when this draft was forked.
  const OLD_MAIN_JSON = JSON.stringify({
    metadata: {}, timeSlots: [], rooms: [], professors: [], studentGroups: [], courses: [],
    classes: [
      baseClass(),
      { id: 'CLS_002', courseId: 'C2', title: 'Chem', professorId: 'P2', studentGroupId: 'G2', roomId: 'RM_201', timeSlotIds: ['TS2'] },
      { id: 'CLS_004', courseId: 'C4', title: 'Art', professorId: 'P4', studentGroupId: 'G4', roomId: 'RM_401', timeSlotIds: ['TS4'] },
    ],
  });

  // The user's draft: moved CLS_001 to RM_102, deleted CLS_004, added CLS_005.
  const CANDIDATE_JSON = JSON.stringify({
    metadata: {}, timeSlots: [], rooms: [], professors: [], studentGroups: [], courses: [],
    classes: [
      baseClass({ roomId: 'RM_102' }),
      { id: 'CLS_002', courseId: 'C2', title: 'Chem', professorId: 'P2', studentGroupId: 'G2', roomId: 'RM_201', timeSlotIds: ['TS2'] },
      { id: 'CLS_005', courseId: 'C5', title: 'Music', professorId: 'P5', studentGroupId: 'G5', roomId: 'RM_501', timeSlotIds: ['TS5'] },
    ],
  });

  // Current main: someone else moved CLS_002 to RM_202 and added CLS_003,
  // unrelated to anything the user touched.
  const NEW_MAIN_JSON = JSON.stringify({
    metadata: { term: 'Spring 2026' }, timeSlots: [], rooms: [], professors: [], studentGroups: [], courses: [],
    classes: [
      baseClass(),
      { id: 'CLS_002', courseId: 'C2', title: 'Chem', professorId: 'P2', studentGroupId: 'G2', roomId: 'RM_202', timeSlotIds: ['TS2'] },
      { id: 'CLS_003', courseId: 'C3', title: 'Phys', professorId: 'P3', studentGroupId: 'G3', roomId: 'RM_301', timeSlotIds: ['TS3'] },
      { id: 'CLS_004', courseId: 'C4', title: 'Art', professorId: 'P4', studentGroupId: 'G4', roomId: 'RM_401', timeSlotIds: ['TS4'] },
    ],
  });

  let github: IGitHubService;
  let graph: IGraphService;
  let registry: ISessionRegistry;
  let service: SimulationService;

  beforeEach(() => {
    github = makeGitHub();
    graph = makeGraph();
    registry = makeRegistry(true);
    (github.readBlobBySha as ReturnType<typeof vi.fn>).mockResolvedValue(OLD_MAIN_JSON);
    (github.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(CANDIDATE_JSON);
    (github.readFileWithSha as ReturnType<typeof vi.fn>).mockResolvedValue({
      content: NEW_MAIN_JSON,
      sha: NEW_MAIN_SHA,
    });
    service = new SimulationService(github, graph, registry);
  });

  it('throws 404 when the simulation session is not found', async () => {
    const expiredRegistry = makeRegistry(false);
    const svc = new SimulationService(github, graph, expiredRegistry);

    await expect(svc.rebase(SIM_ID, OLD_BASE_SHA)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Simulation not found or expired',
    });
  });

  it('fetches the old main content by the given baseScheduleVersion sha', async () => {
    await service.rebase(SIM_ID, OLD_BASE_SHA);

    expect(github.readBlobBySha).toHaveBeenCalledWith(OLD_BASE_SHA);
  });

  it('reapplies the user\'s own edit (changed class) onto the latest main', async () => {
    await service.rebase(SIM_ID, OLD_BASE_SHA);

    const [, , written] = (github.writeFile as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string, string];
    const merged = JSON.parse(written) as { classes: { id: string; roomId: string }[] };
    const cls1 = merged.classes.find((c) => c.id === 'CLS_001');
    expect(cls1?.roomId).toBe('RM_102');
  });

  it('preserves a concurrent change on main to a class the user never touched', async () => {
    await service.rebase(SIM_ID, OLD_BASE_SHA);

    const [, , written] = (github.writeFile as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string, string];
    const merged = JSON.parse(written) as { classes: { id: string; roomId: string }[] };
    const cls2 = merged.classes.find((c) => c.id === 'CLS_002');
    expect(cls2?.roomId).toBe('RM_202');
  });

  it('keeps a class main added that the user never touched', async () => {
    await service.rebase(SIM_ID, OLD_BASE_SHA);

    const [, , written] = (github.writeFile as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string, string];
    const merged = JSON.parse(written) as { classes: { id: string }[] };
    expect(merged.classes.some((c) => c.id === 'CLS_003')).toBe(true);
  });

  it('adds a class the user added that main doesn\'t have', async () => {
    await service.rebase(SIM_ID, OLD_BASE_SHA);

    const [, , written] = (github.writeFile as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string, string];
    const merged = JSON.parse(written) as { classes: { id: string }[] };
    expect(merged.classes.some((c) => c.id === 'CLS_005')).toBe(true);
  });

  it('removes a class the user deleted, even though main still has it', async () => {
    await service.rebase(SIM_ID, OLD_BASE_SHA);

    const [, , written] = (github.writeFile as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string, string];
    const merged = JSON.parse(written) as { classes: { id: string }[] };
    expect(merged.classes.some((c) => c.id === 'CLS_004')).toBe(false);
  });

  it('writes the merged schedule back to the simulation branch', async () => {
    await service.rebase(SIM_ID, OLD_BASE_SHA);

    const [branch, path, , message] = (github.writeFile as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string, string, string];
    expect(branch).toBe(SIM_ID);
    expect(path).toBe('schedule.json');
    expect(message).toBe('chore(schedule): rebase draft onto latest published schedule');
  });

  it('re-hydrates the graph session with the merged schedule', async () => {
    await service.rebase(SIM_ID, OLD_BASE_SHA);

    expect(graph.flush).toHaveBeenCalledWith(SIM_ID);
    const [simId, json] = (graph.hydrate as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string];
    expect(simId).toBe(SIM_ID);
    expect(JSON.parse(json).classes.find((c: { id: string }) => c.id === 'CLS_001').roomId).toBe('RM_102');
  });

  it('returns the new baseScheduleVersion (main\'s current sha)', async () => {
    const result = await service.rebase(SIM_ID, OLD_BASE_SHA);

    expect(result).toEqual({ baseScheduleVersion: NEW_MAIN_SHA });
  });
});

describe('SimulationService.getConflicts()', () => {
  const SIM_ID = 'sim-alice-abc123';
  const FAKE_CONFLICTS = [
    {
      id: 'ROOM_DOUBLE_BOOK_CLS_001_CLS_002',
      type: 'ROOM_DOUBLE_BOOK' as const,
      classIds: ['CLS_001', 'CLS_002'] as [string, string],
      message: "Classes CLS_001 and CLS_002 both occupy room 'Room 101' at the same time",
    },
  ];

  let github: IGitHubService;
  let graph: IGraphService;
  let registry: ISessionRegistry;
  let service: SimulationService;

  beforeEach(() => {
    github = makeGitHub();
    graph = makeGraph();
    registry = makeRegistry(true);
    (graph.queryConflicts as ReturnType<typeof vi.fn>).mockResolvedValue(FAKE_CONFLICTS);
    service = new SimulationService(github, graph, registry);
  });

  it('throws 404 when the simulation session is not found', async () => {
    const expiredRegistry = makeRegistry(false);
    const svc = new SimulationService(github, graph, expiredRegistry);

    await expect(svc.getConflicts(SIM_ID)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Simulation not found or expired',
    });
  });

  it('delegates to graph.queryConflicts with the simulationId', async () => {
    await service.getConflicts(SIM_ID);

    expect(graph.queryConflicts).toHaveBeenCalledOnce();
    expect(graph.queryConflicts).toHaveBeenCalledWith(SIM_ID);
  });

  it('returns the conflict array from graph.queryConflicts', async () => {
    const result = await service.getConflicts(SIM_ID);

    expect(result).toEqual(FAKE_CONFLICTS);
  });

  it('returns an empty array when there are no conflicts', async () => {
    (graph.queryConflicts as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const result = await service.getConflicts(SIM_ID);

    expect(result).toEqual([]);
  });
});

describe('SimulationService.getMetrics()', () => {
  const SIM_ID = 'sim-alice-abc123';
  const METRIC_RULES = [
    { id: 'mr-1', name: 'Class Count', target: 'Class', condition: 'count', threshold: 0 },
  ];
  const RULES_JSON = JSON.stringify({ metrics: METRIC_RULES, constraints: [] });
  const FAKE_METRICS = [{ name: 'Class Count', value: 42, unit: 'classes' }];

  let github: IGitHubService;
  let graph: IGraphService;
  let registry: ISessionRegistry;
  let service: SimulationService;

  beforeEach(() => {
    github = makeGitHub();
    graph = makeGraph();
    registry = makeRegistry(true);
    (github.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(RULES_JSON);
    (graph.evaluateMetrics as ReturnType<typeof vi.fn>).mockResolvedValue(FAKE_METRICS);
    service = new SimulationService(github, graph, registry);
  });

  it('throws 404 when the simulation session is not found', async () => {
    const expiredRegistry = makeRegistry(false);
    const svc = new SimulationService(github, graph, expiredRegistry);

    await expect(svc.getMetrics(SIM_ID)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Simulation not found or expired',
    });
  });

  it('reads rules.json from the main branch', async () => {
    await service.getMetrics(SIM_ID);

    expect(github.readFile).toHaveBeenCalledWith('main', 'rules.json');
  });

  it('delegates to graph.evaluateMetrics with parsed metric rules', async () => {
    await service.getMetrics(SIM_ID);

    expect(graph.evaluateMetrics).toHaveBeenCalledOnce();
    expect(graph.evaluateMetrics).toHaveBeenCalledWith(SIM_ID, METRIC_RULES);
  });

  it('returns the MetricResult array from graph.evaluateMetrics', async () => {
    const result = await service.getMetrics(SIM_ID);

    expect(result).toEqual(FAKE_METRICS);
  });

  it('returns [] without calling graph when rules.json has no metrics', async () => {
    (github.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(
      JSON.stringify({ metrics: [], constraints: [] }),
    );

    const result = await service.getMetrics(SIM_ID);

    expect(result).toEqual([]);
    expect(graph.evaluateMetrics).not.toHaveBeenCalled();
  });
});

describe('SimulationService.getSchedule()', () => {
  const SIM_ID = 'sim-alice-abc123';
  const FAKE_SCHEDULE_JSON = JSON.stringify({
    metadata: {},
    courses: [{ id: 'CRS_BIO101', code: 'BIO101', name: 'Intro to Biology', department: 'Biology' }],
    professors: [{ id: 'PRF_SMITH', name: 'Dr. Smith', department: 'Biology' }],
    studentGroups: [{ id: 'GRP_BIO_Y1', name: 'Bio Year 1', size: 32 }],
    rooms: [{ id: 'RM_101', name: 'Room 101', capacity: 40, building: 'Building A' }],
    timeSlots: [{ id: 'TS_MON_P1', day: 'MON', name: 'Period 1', startTime: '09:00', endTime: '10:00' }],
    classes: [],
  });

  let github: IGitHubService;
  let graph: IGraphService;
  let registry: ISessionRegistry;
  let service: SimulationService;

  beforeEach(() => {
    github = makeGitHub();
    graph = makeGraph();
    registry = makeRegistry(true);
    (graph.exportScheduleJson as ReturnType<typeof vi.fn>).mockResolvedValue(FAKE_SCHEDULE_JSON);
    service = new SimulationService(github, graph, registry);
  });

  it('throws 404 when the simulation session is not found', async () => {
    const expiredRegistry = makeRegistry(false);
    const svc = new SimulationService(github, graph, expiredRegistry);

    await expect(svc.getSchedule(SIM_ID)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Simulation not found or expired',
    });
  });

  it('delegates to graph.exportScheduleJson with the simulationId', async () => {
    await service.getSchedule(SIM_ID);

    expect(graph.exportScheduleJson).toHaveBeenCalledOnce();
    expect(graph.exportScheduleJson).toHaveBeenCalledWith(SIM_ID);
  });

  it('parses and returns the ScheduleJson from graph.exportScheduleJson', async () => {
    const result = await service.getSchedule(SIM_ID);

    expect(result.rooms).toEqual([{ id: 'RM_101', name: 'Room 101', capacity: 40, building: 'Building A' }]);
    expect(result.studentGroups).toEqual([{ id: 'GRP_BIO_Y1', name: 'Bio Year 1', size: 32 }]);
  });

  it('reads schedule.json from the simulation branch to recover metadata', async () => {
    await service.getSchedule(SIM_ID);

    expect(github.readFile).toHaveBeenCalledWith(SIM_ID, 'schedule.json');
  });

  it('merges the branch schedule.json metadata into the graph export, not the graph\'s hardcoded {}', async () => {
    const realMetadata = {
      semesterId: 'FALL_2026',
      timeline: { semesterStartDate: '2026-09-07', semesterEndDate: '2026-12-18', exclusionDates: [] },
    };
    (github.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(JSON.stringify({
      metadata: realMetadata,
      timeSlots: [], rooms: [], professors: [], studentGroups: [], courses: [], classes: [],
    }));
    // exportScheduleJson always hardcodes metadata: {} — FAKE_SCHEDULE_JSON above already
    // reflects that, so this exercises the real (non-empty) branch metadata winning out.

    const result = await service.getSchedule(SIM_ID);

    expect(result.metadata).toEqual(realMetadata);
  });
});

describe('SimulationService.getSuggestions()', () => {
  const SIM_ID = 'sim-alice-abc123';
  const CLASS_ID = 'CLS_001';
  const FAKE_SUGGESTIONS = [
    { roomId: 'RM_101', timeSlotIds: ['TS_MON_P1', 'TS_MON_P2'], conflictFree: true },
    { roomId: 'RM_102', timeSlotIds: ['TS_TUE_P1'], conflictFree: true },
  ];

  let github: IGitHubService;
  let graph: IGraphService;
  let registry: ISessionRegistry;
  let service: SimulationService;

  beforeEach(() => {
    github = makeGitHub();
    graph = makeGraph();
    registry = makeRegistry(true);
    (graph.getSuggestions as ReturnType<typeof vi.fn>).mockResolvedValue(FAKE_SUGGESTIONS);
    service = new SimulationService(github, graph, registry);
  });

  it('throws 404 when the simulation session is not found', async () => {
    const expiredRegistry = makeRegistry(false);
    const svc = new SimulationService(github, graph, expiredRegistry);

    await expect(svc.getSuggestions(SIM_ID, CLASS_ID)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Simulation not found or expired',
    });
  });

  it('delegates to graph.getSuggestions with the correct arguments', async () => {
    await service.getSuggestions(SIM_ID, CLASS_ID);

    expect(graph.getSuggestions).toHaveBeenCalledOnce();
    expect(graph.getSuggestions).toHaveBeenCalledWith(SIM_ID, CLASS_ID);
  });

  it('returns the Suggestion array from graph.getSuggestions', async () => {
    const result = await service.getSuggestions(SIM_ID, CLASS_ID);

    expect(result).toEqual(FAKE_SUGGESTIONS);
  });

  it('returns an empty array when no conflict-free slots exist', async () => {
    (graph.getSuggestions as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const result = await service.getSuggestions(SIM_ID, CLASS_ID);

    expect(result).toEqual([]);
  });
});

describe('SimulationService.getRoomAvailability()', () => {
  const SIM_ID = 'sim-alice-abc123';
  const CLASS_ID = 'CLS_001';
  const FAKE_AVAILABILITY = [
    { roomId: 'RM_101', capacityOk: true, freeTimeSlotIds: ['TS_MON_P1'] },
    { roomId: 'RM_102', capacityOk: false, freeTimeSlotIds: [] },
  ];

  let github: IGitHubService;
  let graph: IGraphService;
  let registry: ISessionRegistry;
  let service: SimulationService;

  beforeEach(() => {
    github = makeGitHub();
    graph = makeGraph();
    registry = makeRegistry(true);
    (graph.getRoomAvailability as ReturnType<typeof vi.fn>).mockResolvedValue(FAKE_AVAILABILITY);
    service = new SimulationService(github, graph, registry);
  });

  it('throws 404 when the simulation session is not found', async () => {
    const expiredRegistry = makeRegistry(false);
    const svc = new SimulationService(github, graph, expiredRegistry);

    await expect(svc.getRoomAvailability(SIM_ID, CLASS_ID)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Simulation not found or expired',
    });
  });

  it('delegates to graph.getRoomAvailability with the correct arguments', async () => {
    await service.getRoomAvailability(SIM_ID, CLASS_ID);

    expect(graph.getRoomAvailability).toHaveBeenCalledOnce();
    expect(graph.getRoomAvailability).toHaveBeenCalledWith(SIM_ID, CLASS_ID);
  });

  it('returns the RoomAvailability array from graph.getRoomAvailability', async () => {
    const result = await service.getRoomAvailability(SIM_ID, CLASS_ID);

    expect(result).toEqual(FAKE_AVAILABILITY);
  });
});

describe('SimulationService.getScore()', () => {
  const SIM_ID = 'sim-alice-abc123';
  const METRIC_RULES = [
    { id: 'mr-1', name: 'Class Count', target: 'Class', condition: 'count', threshold: 0, weight: 1 },
  ];
  const RULES_JSON = JSON.stringify({ metrics: METRIC_RULES, constraints: [] });
  const FAKE_SCORE = { score: 88, breakdown: [{ name: 'Class Count', value: 42, unit: 'classes', weight: 1, threshold: 0, normalizedScore: 88 }] };

  let github: IGitHubService;
  let graph: IGraphService;
  let registry: ISessionRegistry;
  let service: SimulationService;

  beforeEach(() => {
    github = makeGitHub();
    graph = makeGraph();
    registry = makeRegistry(true);
    (github.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(RULES_JSON);
    (graph.scoreTimetable as ReturnType<typeof vi.fn>).mockResolvedValue(FAKE_SCORE);
    service = new SimulationService(github, graph, registry);
  });

  it('throws 404 when the simulation session is not found', async () => {
    const expiredRegistry = makeRegistry(false);
    const svc = new SimulationService(github, graph, expiredRegistry);

    await expect(svc.getScore(SIM_ID)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Simulation not found or expired',
    });
  });

  it('reads rules.json from the main branch', async () => {
    await service.getScore(SIM_ID);

    expect(github.readFile).toHaveBeenCalledWith('main', 'rules.json');
  });

  it('delegates to graph.scoreTimetable with the simulationId and parsed rules', async () => {
    await service.getScore(SIM_ID);

    expect(graph.scoreTimetable).toHaveBeenCalledWith(SIM_ID, METRIC_RULES);
  });

  it('returns the WeightedScoreResult from graph.scoreTimetable', async () => {
    const result = await service.getScore(SIM_ID);

    expect(result).toEqual(FAKE_SCORE);
  });

  it('still delegates to graph.scoreTimetable (which handles the empty-rules case) when rules.json has no metrics', async () => {
    (github.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(JSON.stringify({ metrics: [], constraints: [] }));

    await service.getScore(SIM_ID);

    expect(graph.scoreTimetable).toHaveBeenCalledWith(SIM_ID, []);
  });
});

describe('SimulationService.previewClassUpdate()', () => {
  const SIM_ID = 'sim-alice-abc123';
  const CLASS_ID = 'CLS_001';
  const EXPORTED_SCHEDULE = {
    metadata: {},
    timeSlots: [], rooms: [], professors: [], studentGroups: [], courses: [],
    classes: [
      { id: CLASS_ID, courseId: 'CRS_001', title: 'Biology', professorId: 'PRF_001', studentGroupId: 'GRP_001', roomId: 'RM_101', timeSlotIds: ['TS_MON_P1'] },
    ],
  };
  const METRIC_RULES = [
    { id: 'mr-1', name: 'Class Count', target: 'Class', condition: 'count', threshold: 0, weight: 1 },
  ];
  const FAKE_METRICS = [{ name: 'Class Count', value: 1, unit: 'classes' }];
  const FAKE_SCORE = { score: 90, breakdown: [] };

  let github: IGitHubService;
  let graph: IGraphService;
  let registry: ISessionRegistry;
  let service: SimulationService;

  beforeEach(() => {
    github = makeGitHub();
    graph = makeGraph();
    registry = makeRegistry(true);
    (github.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(
      JSON.stringify({ metrics: METRIC_RULES, constraints: [] }),
    );
    (graph.exportScheduleJson as ReturnType<typeof vi.fn>).mockResolvedValue(JSON.stringify(EXPORTED_SCHEDULE));
    (graph.evaluateMetrics as ReturnType<typeof vi.fn>).mockResolvedValue(FAKE_METRICS);
    (graph.scoreTimetable as ReturnType<typeof vi.fn>).mockResolvedValue(FAKE_SCORE);
    service = new SimulationService(github, graph, registry);
  });

  it('throws 404 when the simulation session is not found', async () => {
    const expiredRegistry = makeRegistry(false);
    const svc = new SimulationService(github, graph, expiredRegistry);

    await expect(svc.previewClassUpdate(SIM_ID, CLASS_ID, { roomId: 'RM_102' })).rejects.toMatchObject({
      statusCode: 404,
      message: 'Simulation not found or expired',
    });
  });

  it('throws 400 when the patch is empty (no fields provided)', async () => {
    await expect(service.previewClassUpdate(SIM_ID, CLASS_ID, {})).rejects.toMatchObject({
      statusCode: 400,
    });

    expect(graph.exportScheduleJson).not.toHaveBeenCalled();
  });

  it('throws 404 when the classId does not exist in the exported schedule', async () => {
    await expect(
      service.previewClassUpdate(SIM_ID, 'CLS_UNKNOWN', { roomId: 'RM_102' }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('hydrates a scratch "preview-" branch distinct from the live simulationId', async () => {
    await service.previewClassUpdate(SIM_ID, CLASS_ID, { roomId: 'RM_102' });

    expect(graph.hydrate).toHaveBeenCalledOnce();
    const [previewBranchId] = (graph.hydrate as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string];
    expect(previewBranchId).toMatch(/^preview-sim-alice-abc123-[0-9a-f]{8}$/);
    expect(previewBranchId).not.toBe(SIM_ID);
  });

  it('never mutates the live simulation graph', async () => {
    await service.previewClassUpdate(SIM_ID, CLASS_ID, { roomId: 'RM_102' });

    expect(graph.updateClass).not.toHaveBeenCalled();
  });

  it('hydrates the patched class into the scratch branch', async () => {
    await service.previewClassUpdate(SIM_ID, CLASS_ID, { roomId: 'RM_102' });

    const [, hydratedJson] = (graph.hydrate as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string];
    const hydrated = JSON.parse(hydratedJson) as { classes: Array<{ id: string; roomId: string }> };
    expect(hydrated.classes.find((c) => c.id === CLASS_ID)?.roomId).toBe('RM_102');
  });

  it('accepts and hydrates a patch with only studentGroupId', async () => {
    await service.previewClassUpdate(SIM_ID, CLASS_ID, { studentGroupId: 'GRP_002' });

    const [, hydratedJson] = (graph.hydrate as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string];
    const hydrated = JSON.parse(hydratedJson) as { classes: Array<{ id: string; studentGroupId: string }> };
    expect(hydrated.classes.find((c) => c.id === CLASS_ID)?.studentGroupId).toBe('GRP_002');
  });

  it('always flushes the scratch branch, including when evaluation fails', async () => {
    (graph.evaluateMetrics as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('graph down'));

    await expect(service.previewClassUpdate(SIM_ID, CLASS_ID, { roomId: 'RM_102' })).rejects.toThrow('graph down');

    expect(graph.flush).toHaveBeenCalledOnce();
  });

  it('still flushes the scratch branch when hydrate itself throws', async () => {
    (graph.hydrate as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('hydration failed'));

    await expect(service.previewClassUpdate(SIM_ID, CLASS_ID, { roomId: 'RM_102' })).rejects.toThrow(
      'hydration failed',
    );

    expect(graph.flush).toHaveBeenCalledOnce();
    const hydrateBranchId = (graph.hydrate as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    expect(graph.flush).toHaveBeenCalledWith(hydrateBranchId);
  });

  it('returns metrics and score computed against the scratch branch', async () => {
    const result = await service.previewClassUpdate(SIM_ID, CLASS_ID, { roomId: 'RM_102' });

    expect(result).toEqual({ metrics: FAKE_METRICS, score: FAKE_SCORE });
  });
});
