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
  writeFile: vi.fn().mockResolvedValue(undefined),
  createPullRequest: vi.fn().mockResolvedValue('pr-1'),
  mergePullRequest: vi.fn().mockResolvedValue(undefined),
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
  queryConflicts: vi.fn().mockResolvedValue([]),
  evaluateMetrics: vi.fn().mockResolvedValue([]),
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
