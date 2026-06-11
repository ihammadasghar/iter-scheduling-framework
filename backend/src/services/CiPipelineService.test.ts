import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CiPipelineService } from './CiPipelineService.js';
import type { IGitHubService } from '../interfaces/IGitHubService.js';
import type { IGraphService } from '../interfaces/IGraphService.js';
import type { Conflict } from '../types/domain.js';

const FAKE_CONFLICT: Conflict = {
  id: 'ROOM_DOUBLE_BOOK_CLS_001_CLS_002',
  type: 'ROOM_DOUBLE_BOOK',
  classIds: ['CLS_001', 'CLS_002'],
  message: 'Room RM_101 is double-booked at TS_MON_P1',
};

const FAKE_SCHEDULE_JSON = JSON.stringify({
  metadata: [],
  timeSlots: [],
  rooms: [],
  professors: [],
  studentGroups: [],
  courses: [],
  classes: [],
});

const makeGitHub = (): IGitHubService => ({
  createBranch: vi.fn().mockResolvedValue(undefined),
  deleteBranch: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(FAKE_SCHEDULE_JSON),
  writeFile: vi.fn().mockResolvedValue(undefined),
  createPullRequest: vi.fn().mockResolvedValue('42'),
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

describe('CiPipelineService.run()', () => {
  const PARAMS = { proposalId: '42', simulationId: 'sim-alice-abc123' };

  let github: IGitHubService;
  let graph: IGraphService;
  let service: CiPipelineService;

  beforeEach(() => {
    github = makeGitHub();
    graph = makeGraph();
    service = new CiPipelineService(github, graph);
  });

  it('reads schedule.json from the simulation branch', async () => {
    await service.run(PARAMS);

    expect(github.readFile).toHaveBeenCalledWith(PARAMS.simulationId, 'schedule.json');
  });

  it('hydrates the graph with the schedule.json content', async () => {
    await service.run(PARAMS);

    const [ciRunId, content] = (graph.hydrate as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      string,
    ];
    expect(content).toBe(FAKE_SCHEDULE_JSON);
    expect(ciRunId).toContain(PARAMS.proposalId);
  });

  it('ciRunId contains the proposalId', async () => {
    await service.run(PARAMS);

    const [ciRunId] = (graph.hydrate as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(ciRunId).toContain('42');
  });

  it('queries conflicts using the same ciRunId used for hydration', async () => {
    await service.run(PARAMS);

    const hydrateRunId = (graph.hydrate as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    const conflictsRunId = (graph.queryConflicts as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    expect(conflictsRunId).toBe(hydrateRunId);
  });

  it('returns READY when queryConflicts returns no conflicts', async () => {
    const result = await service.run(PARAMS);

    expect(result.status).toBe('READY');
    expect(result.conflicts).toHaveLength(0);
  });

  it('returns BLOCKED when queryConflicts returns conflicts', async () => {
    (graph.queryConflicts as ReturnType<typeof vi.fn>).mockResolvedValue([FAKE_CONFLICT]);

    const result = await service.run(PARAMS);

    expect(result.status).toBe('BLOCKED');
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]).toEqual(FAKE_CONFLICT);
  });

  it('always flushes the ciRunId even when no conflicts', async () => {
    await service.run(PARAMS);

    const hydrateRunId = (graph.hydrate as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    expect(graph.flush).toHaveBeenCalledWith(hydrateRunId);
  });

  it('flushes even when queryConflicts throws', async () => {
    (graph.queryConflicts as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('graph error'));

    await expect(service.run(PARAMS)).rejects.toThrow('graph error');

    const hydrateRunId = (graph.hydrate as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    expect(graph.flush).toHaveBeenCalledWith(hydrateRunId);
  });

  it('returns all conflicts in result', async () => {
    const conflicts: Conflict[] = [
      FAKE_CONFLICT,
      { ...FAKE_CONFLICT, id: 'PROFESSOR_OVERLAP_A_B', type: 'PROFESSOR_OVERLAP', classIds: ['A', 'B'], message: 'Professor overlap' },
    ];
    (graph.queryConflicts as ReturnType<typeof vi.fn>).mockResolvedValue(conflicts);

    const result = await service.run(PARAMS);

    expect(result.conflicts).toHaveLength(2);
  });
});
