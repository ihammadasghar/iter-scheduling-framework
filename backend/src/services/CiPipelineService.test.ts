import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CiPipelineService } from './CiPipelineService.js';
import type { IGitHubService } from '../interfaces/IGitHubService.js';
import type { IGraphService } from '../interfaces/IGraphService.js';
import type { IRulesService } from '../interfaces/IRulesService.js';
import type { Conflict, Constraint, WeightedScoreResult } from '../types/domain.js';

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
  readFileWithSha: vi.fn().mockResolvedValue({ content: FAKE_SCHEDULE_JSON, sha: 'mock-sha' }),
  readBlobBySha: vi.fn().mockResolvedValue(FAKE_SCHEDULE_JSON),
  writeFile: vi.fn().mockResolvedValue(undefined),
  createPullRequest: vi.fn().mockResolvedValue('42'),
  mergePullRequest: vi.fn().mockResolvedValue(undefined),
  closePullRequest: vi.fn().mockResolvedValue(undefined),
  getPullRequestDiff: vi.fn().mockResolvedValue(''),
  listOpenPullRequests: vi.fn().mockResolvedValue([]),
  addPullRequestComment: vi.fn().mockResolvedValue(undefined),
  getPullRequest: vi.fn().mockResolvedValue({ title: '', head: '', labels: [], createdAt: '' }),
  setPullRequestLabels: vi.fn().mockResolvedValue(undefined),
});

// A run id starting with `check-main-` is CiPipelineService's fresh baseline
// hydrate of `main` (via the shared ProposalGate.computeConflictsAndScore);
// anything else is the candidate (`ci-${proposalId}-...`) hydrate of the
// simulation branch. Mirrors the same distinguishing pattern
// ProposalService.test.ts uses for its own baseline/candidate mocking.
const isBaselineRunId = (runId: string): boolean => runId.startsWith('check-main-');

interface GraphMockOptions {
  readonly baselineConflicts?: readonly Conflict[];
  readonly candidateConflicts?: readonly Conflict[];
  readonly baselineConstraintViolations?: readonly Conflict[];
  readonly candidateConstraintViolations?: readonly Conflict[];
  readonly baselineScore?: WeightedScoreResult;
  readonly candidateScore?: WeightedScoreResult;
}

const makeGraph = ({
  baselineConflicts = [],
  candidateConflicts = [],
  baselineConstraintViolations = [],
  candidateConstraintViolations = [],
  baselineScore = { score: 0, breakdown: [] },
  candidateScore = { score: 0, breakdown: [] },
}: GraphMockOptions = {}): IGraphService => ({
  hydrate: vi.fn().mockResolvedValue(undefined),
  flush: vi.fn().mockResolvedValue(undefined),
  exportScheduleJson: vi.fn().mockResolvedValue('{}'),
  listClasses: vi.fn().mockResolvedValue([]),
  countClasses: vi.fn().mockResolvedValue(0),
  updateClass: vi.fn().mockResolvedValue({}),
  getSuggestions: vi.fn().mockResolvedValue([]),
  getRoomAvailability: vi.fn().mockResolvedValue([]),
  queryConflicts: vi.fn().mockImplementation(async (runId: string) =>
    isBaselineRunId(runId) ? baselineConflicts : candidateConflicts,
  ),
  queryConstraintViolations: vi.fn().mockImplementation(async (runId: string) =>
    isBaselineRunId(runId) ? baselineConstraintViolations : candidateConstraintViolations,
  ),
  evaluateMetrics: vi.fn().mockResolvedValue([]),
  scoreTimetable: vi.fn().mockImplementation(async (runId: string) =>
    isBaselineRunId(runId) ? baselineScore : candidateScore,
  ),
});

const CONSECUTIVE_LIMIT_CONSTRAINT: Constraint = {
  id: 'constraint-1',
  name: 'No back-to-back overload',
  target: 'Professor',
  violationCondition: 'consecutive_limit',
  limit: 3,
};

const makeRules = (constraints: readonly Constraint[] = []): IRulesService => ({
  listMetrics: vi.fn().mockResolvedValue([]),
  createMetric: vi.fn(),
  updateMetric: vi.fn(),
  deleteMetric: vi.fn().mockResolvedValue(undefined),
  listConstraints: vi.fn().mockResolvedValue(constraints),
  createConstraint: vi.fn(),
  updateConstraint: vi.fn(),
  deleteConstraint: vi.fn().mockResolvedValue(undefined),
});

describe('CiPipelineService.run()', () => {
  const PARAMS = { proposalId: '42', simulationId: 'sim-alice-abc123' };

  let github: IGitHubService;
  let graph: IGraphService;
  let rules: IRulesService;
  let service: CiPipelineService;

  const candidateHydrateCall = (): [string, string] => {
    const calls = (graph.hydrate as ReturnType<typeof vi.fn>).mock.calls as [string, string][];
    const call = calls.find(([runId]) => !isBaselineRunId(runId));
    if (!call) throw new Error('candidate hydrate call not found');
    return call;
  };

  beforeEach(() => {
    github = makeGitHub();
    graph = makeGraph();
    rules = makeRules();
    service = new CiPipelineService(github, graph, rules);
  });

  it('reads schedule.json from the simulation branch', async () => {
    await service.run(PARAMS);

    expect(github.readFile).toHaveBeenCalledWith(PARAMS.simulationId, 'schedule.json');
  });

  it('also reads schedule.json from main to compute the baseline', async () => {
    await service.run(PARAMS);

    expect(github.readFile).toHaveBeenCalledWith('main', 'schedule.json');
  });

  it('hydrates the graph with the candidate schedule.json content', async () => {
    await service.run(PARAMS);

    const [ciRunId, content] = candidateHydrateCall();
    expect(content).toBe(FAKE_SCHEDULE_JSON);
    expect(ciRunId).toContain(PARAMS.proposalId);
  });

  it('candidate ciRunId contains the proposalId', async () => {
    await service.run(PARAMS);

    const [ciRunId] = candidateHydrateCall();
    expect(ciRunId).toContain('42');
  });

  it('hydrates the baseline (main) before the candidate', async () => {
    await service.run(PARAMS);

    const calls = (graph.hydrate as ReturnType<typeof vi.fn>).mock.calls as [string, string][];
    expect(calls).toHaveLength(2);
    expect(isBaselineRunId(calls[0]![0])).toBe(true);
    expect(isBaselineRunId(calls[1]![0])).toBe(false);
  });

  it('queries conflicts using the same ciRunId used for candidate hydration', async () => {
    await service.run(PARAMS);

    const [candidateRunId] = candidateHydrateCall();
    const conflictsCalls = (graph.queryConflicts as ReturnType<typeof vi.fn>).mock.calls as [string][];
    const candidateConflictsRunId = conflictsCalls.find(([runId]) => !isBaselineRunId(runId))?.[0];
    expect(candidateConflictsRunId).toBe(candidateRunId);
  });

  it('returns BLOCKED as a no-op when the candidate has no conflicts, same as main, and the score is unchanged', async () => {
    graph = makeGraph({ baselineConflicts: [], candidateConflicts: [] });
    service = new CiPipelineService(github, graph, rules);

    const result = await service.run(PARAMS);

    expect(result.status).toBe('BLOCKED');
    expect(result.conflicts).toHaveLength(0);
  });

  it('returns READY when both have zero conflicts but the candidate changes the score', async () => {
    graph = makeGraph({
      baselineConflicts: [],
      candidateConflicts: [],
      baselineScore: { score: 0, breakdown: [] },
      candidateScore: { score: 5, breakdown: [] },
    });
    service = new CiPipelineService(github, graph, rules);

    const result = await service.run(PARAMS);

    expect(result.status).toBe('READY');
    expect(result.conflicts).toHaveLength(0);
  });

  it('returns READY when the candidate strictly reduces conflicts vs. main, even if not zero', async () => {
    graph = makeGraph({ baselineConflicts: [FAKE_CONFLICT, FAKE_CONFLICT], candidateConflicts: [FAKE_CONFLICT] });
    service = new CiPipelineService(github, graph, rules);

    const result = await service.run(PARAMS);

    expect(result.status).toBe('READY');
    expect(result.conflicts).toEqual([FAKE_CONFLICT]);
  });

  it('returns BLOCKED when the candidate has more conflicts than main', async () => {
    graph = makeGraph({ baselineConflicts: [], candidateConflicts: [FAKE_CONFLICT] });
    service = new CiPipelineService(github, graph, rules);

    const result = await service.run(PARAMS);

    expect(result.status).toBe('BLOCKED');
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]).toEqual(FAKE_CONFLICT);
  });

  it('returns BLOCKED for a no-op: same conflict count and same score as main', async () => {
    graph = makeGraph({
      baselineConflicts: [FAKE_CONFLICT],
      candidateConflicts: [FAKE_CONFLICT],
      baselineScore: { score: 10, breakdown: [] },
      candidateScore: { score: 10, breakdown: [] },
    });
    service = new CiPipelineService(github, graph, rules);

    const result = await service.run(PARAMS);

    expect(result.status).toBe('BLOCKED');
  });

  it('returns READY when conflicts are unchanged but the score changed', async () => {
    graph = makeGraph({
      baselineConflicts: [FAKE_CONFLICT],
      candidateConflicts: [FAKE_CONFLICT],
      baselineScore: { score: 10, breakdown: [] },
      candidateScore: { score: 20, breakdown: [] },
    });
    service = new CiPipelineService(github, graph, rules);

    const result = await service.run(PARAMS);

    expect(result.status).toBe('READY');
  });

  it('returns BLOCKED when only a policy constraint violation is present (no structural conflict)', async () => {
    const violation: Conflict = {
      id: 'CONSECUTIVE_LIMIT_EXCEEDED_constraint-1_CLS_001_CLS_004',
      type: 'CONSECUTIVE_LIMIT_EXCEEDED',
      classIds: ['CLS_001', 'CLS_004'],
      message: "Professor 'Dr. Smith' teaches more than 3 consecutive periods",
    };
    graph = makeGraph({ baselineConstraintViolations: [], candidateConstraintViolations: [violation] });
    rules = makeRules([CONSECUTIVE_LIMIT_CONSTRAINT]);
    service = new CiPipelineService(github, graph, rules);

    const result = await service.run(PARAMS);

    expect(result.status).toBe('BLOCKED');
    expect(result.conflicts).toEqual([violation]);
  });

  it('passes only policy-relevant constraints (consecutive_limit/gap_limit) to queryConstraintViolations, filtering out structural ones', async () => {
    const structuralConstraint: Constraint = {
      id: 'constraint-2',
      name: 'No room double-booking',
      target: 'Room',
      violationCondition: 'room_double_book',
    };
    rules = makeRules([structuralConstraint, CONSECUTIVE_LIMIT_CONSTRAINT]);
    service = new CiPipelineService(github, graph, rules);

    await service.run(PARAMS);

    const calls = (graph.queryConstraintViolations as ReturnType<typeof vi.fn>).mock.calls as [
      string,
      readonly Constraint[],
    ][];
    for (const [, constraints] of calls) {
      expect(constraints).toEqual([CONSECUTIVE_LIMIT_CONSTRAINT]);
    }
  });

  it('returns BLOCKED when the only conflict is a room-capacity overrun and main has none', async () => {
    const capacityConflict: Conflict = {
      id: 'ROOM_CAPACITY_EXCEEDED_CLS_004',
      type: 'ROOM_CAPACITY_EXCEEDED',
      classIds: ['CLS_004', 'CLS_004'],
      message: "Class CLS_004 assigned to room 'RM_101' (capacity 30) but group 'Bio Year 1' has 40 students",
    };
    graph = makeGraph({ baselineConflicts: [], candidateConflicts: [capacityConflict] });
    service = new CiPipelineService(github, graph, rules);

    const result = await service.run(PARAMS);

    expect(result.status).toBe('BLOCKED');
    expect(result.conflicts).toEqual([capacityConflict]);
  });

  it('always flushes both the baseline and candidate run ids', async () => {
    await service.run(PARAMS);

    const hydrateCalls = (graph.hydrate as ReturnType<typeof vi.fn>).mock.calls as [string, string][];
    for (const [runId] of hydrateCalls) {
      expect(graph.flush).toHaveBeenCalledWith(runId);
    }
  });

  it('flushes even when the candidate queryConflicts throws', async () => {
    (graph.queryConflicts as ReturnType<typeof vi.fn>).mockImplementation(async (runId: string) => {
      if (isBaselineRunId(runId)) return [];
      throw new Error('graph error');
    });

    await expect(service.run(PARAMS)).rejects.toThrow('graph error');

    const [candidateRunId] = candidateHydrateCall();
    expect(graph.flush).toHaveBeenCalledWith(candidateRunId);
  });

  it('flushes the baseline run id even when the baseline queryConflicts throws (never reaches the candidate)', async () => {
    (graph.queryConflicts as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('baseline graph error'));

    await expect(service.run(PARAMS)).rejects.toThrow('baseline graph error');

    const hydrateCalls = (graph.hydrate as ReturnType<typeof vi.fn>).mock.calls as [string, string][];
    expect(hydrateCalls).toHaveLength(1);
    expect(isBaselineRunId(hydrateCalls[0]![0])).toBe(true);
    expect(graph.flush).toHaveBeenCalledWith(hydrateCalls[0]![0]);
  });

  it('returns all candidate conflicts in result', async () => {
    const conflicts: Conflict[] = [
      FAKE_CONFLICT,
      { ...FAKE_CONFLICT, id: 'PROFESSOR_OVERLAP_A_B', type: 'PROFESSOR_OVERLAP', classIds: ['A', 'B'], message: 'Professor overlap' },
    ];
    graph = makeGraph({ baselineConflicts: [], candidateConflicts: conflicts });
    service = new CiPipelineService(github, graph, rules);

    const result = await service.run(PARAMS);

    expect(result.conflicts).toHaveLength(2);
  });

  it('reads metric rules via rules.listMetrics()', async () => {
    await service.run(PARAMS);

    expect(rules.listMetrics).toHaveBeenCalledOnce();
  });

  it('scores using the same ciRunId used for candidate hydration, not the proposal/simulation branch', async () => {
    const metricRules = [{ id: 'mr-1', name: 'Class Count', target: 'Class', condition: 'count', threshold: 0, weight: 1 }];
    (rules.listMetrics as ReturnType<typeof vi.fn>).mockResolvedValue(metricRules);

    await service.run(PARAMS);

    const [candidateRunId] = candidateHydrateCall();
    expect(graph.scoreTimetable).toHaveBeenCalledWith(candidateRunId, metricRules);
    expect(candidateRunId).not.toBe(PARAMS.simulationId);
  });

  it('attaches the computed candidate score to the returned CiResult', async () => {
    const fakeScore = { score: 77, breakdown: [] };
    graph = makeGraph({ candidateScore: fakeScore });
    service = new CiPipelineService(github, graph, rules);

    const result = await service.run(PARAMS);

    expect(result.score).toEqual(fakeScore);
  });

  it('still flushes when candidate scoring fails', async () => {
    (graph.scoreTimetable as ReturnType<typeof vi.fn>).mockImplementation(async (runId: string) => {
      if (isBaselineRunId(runId)) return { score: 0, breakdown: [] };
      throw new Error('score error');
    });

    await expect(service.run(PARAMS)).rejects.toThrow('score error');

    const [candidateRunId] = candidateHydrateCall();
    expect(graph.flush).toHaveBeenCalledWith(candidateRunId);
  });

  it('still flushes when candidate hydrate itself throws', async () => {
    (graph.hydrate as ReturnType<typeof vi.fn>).mockImplementation(async (runId: string) => {
      if (!isBaselineRunId(runId)) throw new Error('hydration failed');
    });

    await expect(service.run(PARAMS)).rejects.toThrow('hydration failed');

    const hydrateCalls = (graph.hydrate as ReturnType<typeof vi.fn>).mock.calls as [string, string][];
    const candidateRunId = hydrateCalls.find(([runId]) => !isBaselineRunId(runId))?.[0];
    expect(graph.flush).toHaveBeenCalledWith(candidateRunId);
  });
});
