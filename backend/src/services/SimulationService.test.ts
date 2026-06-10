import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SimulationService } from './SimulationService.js';
import type { IGitHubService } from '../interfaces/IGitHubService.js';
import type { IGraphService } from '../interfaces/IGraphService.js';
import type { Simulation } from '../types/domain.js';
import { ApiError } from '../types/ApiError.js';

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
  resetHeartbeat: vi.fn().mockResolvedValue(undefined),
  exportScheduleJson: vi.fn().mockResolvedValue('{}'),
  listClasses: vi.fn().mockResolvedValue([]),
  countClasses: vi.fn().mockResolvedValue(0),
  updateClass: vi.fn().mockResolvedValue({}),
  getSuggestions: vi.fn().mockResolvedValue([]),
  queryConflicts: vi.fn().mockResolvedValue([]),
  evaluateMetrics: vi.fn().mockResolvedValue([]),
});

describe('SimulationService.create()', () => {
  let github: IGitHubService;
  let graph: IGraphService;
  let service: SimulationService;

  beforeEach(() => {
    github = makeGitHub();
    graph = makeGraph();
    service = new SimulationService(github, graph);
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
    // The branch used for readFile must match what was passed to createBranch
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
  });
});
