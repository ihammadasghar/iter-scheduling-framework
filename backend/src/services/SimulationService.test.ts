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
