import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProposalService } from './ProposalService.js';
import type { IGitHubService } from '../interfaces/IGitHubService.js';
import type { IGraphService } from '../interfaces/IGraphService.js';
import type { ICiPipelineService } from '../interfaces/ICiPipelineService.js';
import type { IRulesService } from '../interfaces/IRulesService.js';
import type { Conflict, Constraint } from '../types/domain.js';
import type { RawClass, ScheduleJson } from '../types/scheduleJson.js';

const FAKE_CONFLICT: Conflict = {
  id: 'ROOM_DOUBLE_BOOK_CLS_001_CLS_002',
  type: 'ROOM_DOUBLE_BOOK',
  classIds: ['CLS_001', 'CLS_002'],
  message: 'Room RM_101 is double-booked',
};

// Distinct from FAKE_CONFLICT so tests can tell "baseline's conflict" apart
// from "candidate's conflict" in assertions.
const BASELINE_CONFLICT: Conflict = {
  id: 'BASELINE_ROOM_DOUBLE_BOOK',
  type: 'ROOM_DOUBLE_BOOK',
  classIds: ['CLS_BASE_1', 'CLS_BASE_2'],
  message: 'Room RM_100 is double-booked',
};

const FAKE_SCORE = { score: 0, breakdown: [] };

// get() now parses schedule.json on both sides (via ScheduleDiffer.diffSchedules)
// to build the class-level change list, so github.readFile must resolve valid
// ScheduleJson text for get() tests — unlike submit()/the improvement gate,
// which never parse the file's contents (they only feed it to the mocked
// graph.hydrate).
const DEFAULT_CLASS: RawClass = {
  id: 'CLS_001',
  courseId: 'CRS_001',
  title: 'Intro to Biology',
  professorId: 'PRF_001',
  studentGroupId: 'GRP_001',
  roomId: 'RM_101',
  timeSlotIds: ['TS_MON_P1'],
};

function makeScheduleJson(classes: readonly RawClass[]): string {
  const schedule: ScheduleJson = {
    metadata: {},
    timeSlots: [],
    rooms: [],
    professors: [],
    studentGroups: [],
    courses: [],
    classes,
  };
  return JSON.stringify(schedule);
}

// submit() now hydrates a scratch branch per side (main vs. the simulation
// branch) via ProposalService.computeConflictsAndScore, whose run id is
// `check-${branch}-${Date.now()}`. Since queryConflicts/scoreTimetable only
// ever see that run id (not the branch name directly), tests that care about
// the gate tell baseline and candidate apart by inspecting the run id's
// `check-main-` prefix.
const isBaselineRunId = (runId: string): boolean => runId.startsWith('check-main-');

interface WeightedScoreResultLike {
  readonly score: number;
  readonly breakdown: readonly unknown[];
}

// Default: baseline (main) has one conflict, the candidate simulation branch
// has none — satisfies the "conflicts reduced" gate unconditionally, so all
// of the pre-existing happy-path submit() tests below keep passing without
// having to know the gate exists.
const makeGraph = (
  overrides: {
    baselineConflicts?: readonly Conflict[];
    baselineScore?: WeightedScoreResultLike;
    candidateConflicts?: readonly Conflict[];
    candidateScore?: WeightedScoreResultLike;
    baselineConstraintViolations?: readonly Conflict[];
    candidateConstraintViolations?: readonly Conflict[];
  } = {},
): IGraphService => {
  const {
    baselineConflicts = [BASELINE_CONFLICT],
    baselineScore = FAKE_SCORE,
    candidateConflicts = [],
    candidateScore = FAKE_SCORE,
    baselineConstraintViolations = [],
    candidateConstraintViolations = [],
  } = overrides;

  return {
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
  };
};

const makeGitHub = (): IGitHubService => ({
  createBranch: vi.fn().mockResolvedValue(undefined),
  deleteBranch: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(''),
  readFileWithSha: vi.fn().mockResolvedValue({ content: '', sha: 'mock-sha' }),
  readBlobBySha: vi.fn().mockResolvedValue(''),
  writeFile: vi.fn().mockResolvedValue(undefined),
  createPullRequest: vi.fn().mockResolvedValue('42'),
  mergePullRequest: vi.fn().mockResolvedValue(undefined),
  closePullRequest: vi.fn().mockResolvedValue(undefined),
  getPullRequestDiff: vi.fn().mockResolvedValue('diff --git a/schedule.json'),
  listOpenPullRequests: vi.fn().mockResolvedValue([]),
  addPullRequestComment: vi.fn().mockResolvedValue(undefined),
  getPullRequest: vi.fn().mockResolvedValue({
    title: 'Proposal: sim-alice-abc123',
    head: 'sim-alice-abc123',
    labels: ['ci:ready'],
    createdAt: '2026-06-11T10:00:00.000Z',
  }),
  setPullRequestLabels: vi.fn().mockResolvedValue(undefined),
});

const makeCi = (conflicts: readonly Conflict[] = []): ICiPipelineService => ({
  run: vi.fn().mockResolvedValue({
    status: conflicts.length > 0 ? 'BLOCKED' : 'READY',
    conflicts,
    score: FAKE_SCORE,
  }),
});

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

const CONSECUTIVE_LIMIT_CONSTRAINT: Constraint = {
  id: 'constraint-1',
  name: 'No back-to-back overload',
  target: 'Professor',
  violationCondition: 'consecutive_limit',
  limit: 3,
};

describe('ProposalService.submit()', () => {
  const VALID_PARAMS = {
    simulationId: 'sim-alice-abc123',
    description: 'Rescheduling Biology lectures to reduce room conflicts',
    // Matches makeGitHub()'s default readFileWithSha('main', ...) sha, so
    // submit()'s staleness check passes by default; tests below that care
    // about staleness override this explicitly.
    baseScheduleVersion: 'mock-sha',
  };

  let github: IGitHubService;
  let graph: IGraphService;
  let ci: ICiPipelineService;
  let rules: IRulesService;
  let service: ProposalService;

  beforeEach(() => {
    github = makeGitHub();
    graph = makeGraph();
    ci = makeCi();
    rules = makeRules();
    service = new ProposalService(github, graph, ci, rules);
  });

  it('throws 400 when simulationId is empty', async () => {
    await expect(
      service.submit({ ...VALID_PARAMS, simulationId: '' }),
    ).rejects.toMatchObject({ statusCode: 400, message: 'simulationId is required' });

    expect(github.createPullRequest).not.toHaveBeenCalled();
  });

  it('throws 400 when simulationId is whitespace only', async () => {
    await expect(
      service.submit({ ...VALID_PARAMS, simulationId: '   ' }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 when description is empty', async () => {
    await expect(
      service.submit({ ...VALID_PARAMS, description: '' }),
    ).rejects.toMatchObject({ statusCode: 400, message: 'description is required' });

    expect(github.createPullRequest).not.toHaveBeenCalled();
  });

  it('throws 400 when baseScheduleVersion is empty', async () => {
    await expect(
      service.submit({ ...VALID_PARAMS, baseScheduleVersion: '' }),
    ).rejects.toMatchObject({ statusCode: 400, message: 'baseScheduleVersion is required' });

    expect(github.createPullRequest).not.toHaveBeenCalled();
  });

  it('throws MAIN_SCHEDULE_CHANGED when baseScheduleVersion no longer matches main\'s current sha', async () => {
    (github.readFileWithSha as ReturnType<typeof vi.fn>).mockResolvedValue({ content: '', sha: 'newer-sha' });

    await expect(
      service.submit({ ...VALID_PARAMS, baseScheduleVersion: 'mock-sha' }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'MAIN_SCHEDULE_CHANGED' });

    expect(github.createPullRequest).not.toHaveBeenCalled();
  });

  it('checks main\'s current sha via readFileWithSha before doing anything else', async () => {
    (github.readFileWithSha as ReturnType<typeof vi.fn>).mockResolvedValue({ content: '', sha: 'newer-sha' });

    await expect(service.submit(VALID_PARAMS)).rejects.toMatchObject({ statusCode: 409 });

    expect(github.readFileWithSha).toHaveBeenCalledWith('main', 'schedule.json');
  });

  it('proceeds normally when baseScheduleVersion matches main\'s current sha', async () => {
    await expect(service.submit(VALID_PARAMS)).resolves.toBeDefined();

    expect(github.createPullRequest).toHaveBeenCalledOnce();
  });

  it('calls github.createPullRequest with head=simulationId and base=main', async () => {
    await service.submit(VALID_PARAMS);

    expect(github.createPullRequest).toHaveBeenCalledOnce();
    const [head, base] = (github.createPullRequest as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string, string, string, string,
    ];
    expect(head).toBe(VALID_PARAMS.simulationId);
    expect(base).toBe('main');
  });

  it('uses description as the PR body', async () => {
    await service.submit(VALID_PARAMS);

    const [, , , body] = (github.createPullRequest as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string, string, string, string,
    ];
    expect(body).toBe(VALID_PARAMS.description);
  });

  it('includes simulationId in the PR title', async () => {
    await service.submit(VALID_PARAMS);

    const [, , title] = (github.createPullRequest as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string, string, string, string,
    ];
    expect(title).toContain(VALID_PARAMS.simulationId);
  });

  it('returns a Proposal with the PR id as proposal id', async () => {
    const proposal = await service.submit(VALID_PARAMS);

    expect(proposal.id).toBe('42');
  });

  it('returns status READY when CI finds no conflicts', async () => {
    const proposal = await service.submit(VALID_PARAMS);

    expect(proposal.status).toBe('READY');
  });

  it('returns status BLOCKED when CI finds conflicts', async () => {
    ci = makeCi([FAKE_CONFLICT]);
    service = new ProposalService(github, graph, ci, rules);

    const proposal = await service.submit(VALID_PARAMS);

    expect(proposal.status).toBe('BLOCKED');
  });

  it('calls ciPipeline.run with the PR id and simulationId', async () => {
    await service.submit(VALID_PARAMS);

    expect(ci.run).toHaveBeenCalledWith({
      proposalId: '42',
      simulationId: VALID_PARAMS.simulationId,
    });
  });

  it('posts a READY comment to the PR when no conflicts', async () => {
    await service.submit(VALID_PARAMS);

    expect(github.addPullRequestComment).toHaveBeenCalledOnce();
    const [prId, body] = (github.addPullRequestComment as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string];
    expect(prId).toBe('42');
    expect(body).toContain('CI passed');
  });

  it('posts a BLOCKED comment to the PR when conflicts found', async () => {
    ci = makeCi([FAKE_CONFLICT]);
    service = new ProposalService(github, graph, ci, rules);

    await service.submit(VALID_PARAMS);

    const [, body] = (github.addPullRequestComment as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string];
    expect(body).toContain('CI failed');
    expect(body).toContain('1');
  });

  it('returns a Proposal with the correct simulationId', async () => {
    const proposal = await service.submit(VALID_PARAMS);

    expect(proposal.simulationId).toBe(VALID_PARAMS.simulationId);
  });

  it('returns a Proposal with a valid ISO createdAt timestamp', async () => {
    const before = new Date().toISOString();
    const proposal = await service.submit(VALID_PARAMS);
    const after = new Date().toISOString();

    expect(proposal.createdAt >= before).toBe(true);
    expect(proposal.createdAt <= after).toBe(true);
  });

  it('sets ci:ready label on the PR when CI passes', async () => {
    await service.submit(VALID_PARAMS);

    expect(github.setPullRequestLabels).toHaveBeenCalledWith('42', ['ci:ready']);
  });

  it('sets ci:blocked label on the PR when CI fails', async () => {
    ci = makeCi([FAKE_CONFLICT]);
    service = new ProposalService(github, graph, ci, rules);

    await service.submit(VALID_PARAMS);

    expect(github.setPullRequestLabels).toHaveBeenCalledWith('42', ['ci:blocked']);
  });

  it('is undefined on the returned Proposal when no role is given', async () => {
    const proposal = await service.submit(VALID_PARAMS);

    expect(proposal.role).toBeUndefined();
  });

  it('adds a role:student label alongside the CI label and returns role on the Proposal', async () => {
    const proposal = await service.submit({ ...VALID_PARAMS, role: 'student' });

    expect(github.setPullRequestLabels).toHaveBeenCalledWith('42', ['ci:ready', 'role:student']);
    expect(proposal.role).toBe('student');
  });

  it('adds a role:professor label alongside the CI label and returns role on the Proposal', async () => {
    const proposal = await service.submit({ ...VALID_PARAMS, role: 'professor' });

    expect(github.setPullRequestLabels).toHaveBeenCalledWith('42', ['ci:ready', 'role:professor']);
    expect(proposal.role).toBe('professor');
  });

  it('throws 400 when role is not "student" or "professor"', async () => {
    await expect(
      service.submit({ ...VALID_PARAMS, role: 'admin' as never }),
    ).rejects.toMatchObject({ statusCode: 400, message: 'role must be "student" or "professor"' });

    expect(github.createPullRequest).not.toHaveBeenCalled();
  });
});

describe('ProposalService.submit() — improvement gate', () => {
  const VALID_PARAMS = {
    simulationId: 'sim-alice-abc123',
    description: 'Rescheduling Biology lectures to reduce room conflicts',
    // Matches makeGitHub()'s default readFileWithSha('main', ...) sha, so
    // submit()'s staleness check passes by default; tests below that care
    // about staleness override this explicitly.
    baseScheduleVersion: 'mock-sha',
  };

  let github: IGitHubService;
  let ci: ICiPipelineService;
  let rules: IRulesService;

  beforeEach(() => {
    github = makeGitHub();
    ci = makeCi();
    rules = makeRules();
  });

  it('blocks submission when the proposal has more conflicts than published', async () => {
    const graph = makeGraph({ baselineConflicts: [], candidateConflicts: [FAKE_CONFLICT] });
    const service = new ProposalService(github, graph, ci, rules);

    await expect(service.submit(VALID_PARAMS)).rejects.toMatchObject({ statusCode: 409 });
    expect(github.createPullRequest).not.toHaveBeenCalled();
  });

  it('blocks submission when conflicts are unchanged and the score is unchanged too', async () => {
    const graph = makeGraph({
      baselineConflicts: [FAKE_CONFLICT],
      candidateConflicts: [FAKE_CONFLICT],
      baselineScore: { score: 50, breakdown: [] },
      candidateScore: { score: 50, breakdown: [] },
    });
    const service = new ProposalService(github, graph, ci, rules);

    await expect(service.submit(VALID_PARAMS)).rejects.toMatchObject({ statusCode: 409 });
    expect(github.createPullRequest).not.toHaveBeenCalled();
  });

  it('blocks submission when conflicts are unchanged and there are no metric rules to move the score', async () => {
    // Default FAKE_SCORE (0) on both sides — no metric rules defined means
    // there's nothing for the proposal to improve, so it stays blocked.
    const graph = makeGraph({ baselineConflicts: [FAKE_CONFLICT], candidateConflicts: [FAKE_CONFLICT] });
    const service = new ProposalService(github, graph, ci, rules);

    await expect(service.submit(VALID_PARAMS)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('allows submission when conflicts are unchanged but the score improves', async () => {
    const graph = makeGraph({
      baselineConflicts: [FAKE_CONFLICT],
      candidateConflicts: [FAKE_CONFLICT],
      baselineScore: { score: 50, breakdown: [] },
      candidateScore: { score: 70, breakdown: [] },
    });
    const service = new ProposalService(github, graph, ci, rules);

    await service.submit(VALID_PARAMS);

    expect(github.createPullRequest).toHaveBeenCalledOnce();
  });

  it('allows submission when conflicts are unchanged but the score regresses (any change counts)', async () => {
    const graph = makeGraph({
      baselineConflicts: [FAKE_CONFLICT],
      candidateConflicts: [FAKE_CONFLICT],
      baselineScore: { score: 70, breakdown: [] },
      candidateScore: { score: 50, breakdown: [] },
    });
    const service = new ProposalService(github, graph, ci, rules);

    await service.submit(VALID_PARAMS);

    expect(github.createPullRequest).toHaveBeenCalledOnce();
  });

  it('allows submission when conflicts are strictly reduced, regardless of the score', async () => {
    const graph = makeGraph({
      baselineConflicts: [FAKE_CONFLICT, BASELINE_CONFLICT],
      candidateConflicts: [FAKE_CONFLICT],
      baselineScore: { score: 90, breakdown: [] },
      candidateScore: { score: 10, breakdown: [] },
    });
    const service = new ProposalService(github, graph, ci, rules);

    await service.submit(VALID_PARAMS);

    expect(github.createPullRequest).toHaveBeenCalledOnce();
  });

  it('blocks submission when the proposal is strictly worse (more conflicts, even with a better score)', async () => {
    const graph = makeGraph({
      baselineConflicts: [FAKE_CONFLICT],
      candidateConflicts: [FAKE_CONFLICT, BASELINE_CONFLICT],
      baselineScore: { score: 10, breakdown: [] },
      candidateScore: { score: 90, breakdown: [] },
    });
    const service = new ProposalService(github, graph, ci, rules);

    await expect(service.submit(VALID_PARAMS)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('reads baseline conflicts/score from main and candidate from the simulation branch', async () => {
    const graph = makeGraph();
    const service = new ProposalService(github, graph, ci, rules);

    await service.submit(VALID_PARAMS);

    const readFileBranches = (github.readFile as ReturnType<typeof vi.fn>).mock.calls.map(
      (call: unknown[]) => call[0],
    );
    expect(readFileBranches).toEqual(
      expect.arrayContaining(['main', VALID_PARAMS.simulationId]),
    );
  });

  it('rejection message states both conflict counts and the unchanged score', async () => {
    const graph = makeGraph({
      baselineConflicts: [FAKE_CONFLICT],
      candidateConflicts: [FAKE_CONFLICT],
      baselineScore: { score: 42, breakdown: [] },
      candidateScore: { score: 42, breakdown: [] },
    });
    const service = new ProposalService(github, graph, ci, rules);

    await expect(service.submit(VALID_PARAMS)).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining('1 conflict vs 1'),
    });
  });

  it('blocks submission when the candidate introduces a policy constraint violation baseline does not have', async () => {
    const violation: Conflict = {
      id: 'CONSECUTIVE_LIMIT_EXCEEDED_constraint-1_CLS_001_CLS_004',
      type: 'CONSECUTIVE_LIMIT_EXCEEDED',
      classIds: ['CLS_001', 'CLS_004'],
      message: "Professor 'Dr. Smith' teaches more than 3 consecutive periods",
    };
    const graph = makeGraph({
      baselineConflicts: [],
      candidateConflicts: [],
      baselineConstraintViolations: [],
      candidateConstraintViolations: [violation],
    });
    rules = makeRules([CONSECUTIVE_LIMIT_CONSTRAINT]);
    const service = new ProposalService(github, graph, ci, rules);

    await expect(service.submit(VALID_PARAMS)).rejects.toMatchObject({ statusCode: 409 });
    expect(github.createPullRequest).not.toHaveBeenCalled();
  });

  it('does not block submission over a policy constraint violation baseline already has (symmetric check)', async () => {
    const violation: Conflict = {
      id: 'CONSECUTIVE_LIMIT_EXCEEDED_constraint-1_CLS_001_CLS_004',
      type: 'CONSECUTIVE_LIMIT_EXCEEDED',
      classIds: ['CLS_001', 'CLS_004'],
      message: "Professor 'Dr. Smith' teaches more than 3 consecutive periods",
    };
    const graph = makeGraph({
      baselineConflicts: [],
      candidateConflicts: [],
      baselineConstraintViolations: [violation],
      candidateConstraintViolations: [violation],
      baselineScore: { score: 10, breakdown: [] },
      candidateScore: { score: 20, breakdown: [] },
    });
    rules = makeRules([CONSECUTIVE_LIMIT_CONSTRAINT]);
    const service = new ProposalService(github, graph, ci, rules);

    await service.submit(VALID_PARAMS);

    expect(github.createPullRequest).toHaveBeenCalledOnce();
  });
});

describe('ProposalService.submitUnchecked()', () => {
  const VALID_PARAMS = {
    simulationId: 'sim-alice-abc123',
    description: 'Moving Biology onto a slot that conflicts with History',
    baseScheduleVersion: 'mock-sha',
  };

  let github: IGitHubService;
  let ci: ICiPipelineService;
  let rules: IRulesService;

  beforeEach(() => {
    github = makeGitHub();
    ci = makeCi();
    rules = makeRules();
  });

  it('creates a PR and labels it ci:blocked even when the improvement gate would reject the same candidate', async () => {
    const graph = makeGraph({ baselineConflicts: [], candidateConflicts: [FAKE_CONFLICT] });
    ci = makeCi([FAKE_CONFLICT]);
    const service = new ProposalService(github, graph, ci, rules);

    const proposal = await service.submitUnchecked(VALID_PARAMS);

    expect(github.createPullRequest).toHaveBeenCalledOnce();
    expect(proposal.status).toBe('BLOCKED');
    expect(github.setPullRequestLabels).toHaveBeenCalledWith('42', ['ci:blocked']);
  });

  it('does not affect submit(), which still 409s on the same worsening candidate', async () => {
    const graph = makeGraph({ baselineConflicts: [], candidateConflicts: [FAKE_CONFLICT] });
    const service = new ProposalService(github, graph, ci, rules);

    await expect(service.submit(VALID_PARAMS)).rejects.toMatchObject({ statusCode: 409 });
    expect(github.createPullRequest).not.toHaveBeenCalled();
  });

  it('still enforces the staleness check', async () => {
    const graph = makeGraph();
    (github.readFileWithSha as ReturnType<typeof vi.fn>).mockResolvedValue({ content: '', sha: 'newer-sha' });
    const service = new ProposalService(github, graph, ci, rules);

    await expect(
      service.submitUnchecked({ ...VALID_PARAMS, baseScheduleVersion: 'mock-sha' }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'MAIN_SCHEDULE_CHANGED' });
    expect(github.createPullRequest).not.toHaveBeenCalled();
  });

  it('still validates required params', async () => {
    const graph = makeGraph();
    const service = new ProposalService(github, graph, ci, rules);

    await expect(
      service.submitUnchecked({ ...VALID_PARAMS, simulationId: '' }),
    ).rejects.toMatchObject({ statusCode: 400, message: 'simulationId is required' });
  });
});

describe('ProposalService.list()', () => {
  let github: IGitHubService;
  let service: ProposalService;

  beforeEach(() => {
    github = makeGitHub();
    service = new ProposalService(github, makeGraph(), makeCi(), makeRules());
  });

  it('returns empty array when no open PRs', async () => {
    (github.listOpenPullRequests as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const proposals = await service.list();

    expect(proposals).toHaveLength(0);
  });

  it('returns only PRs with ci:ready label', async () => {
    (github.listOpenPullRequests as ReturnType<typeof vi.fn>).mockResolvedValue(['1', '2', '3']);
    (github.getPullRequest as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ title: 'P1', head: 'sim-1', labels: ['ci:ready'], createdAt: '2026-01-01T00:00:00.000Z' })
      .mockResolvedValueOnce({ title: 'P2', head: 'sim-2', labels: ['ci:blocked'], createdAt: '2026-01-02T00:00:00.000Z' })
      .mockResolvedValueOnce({ title: 'P3', head: 'sim-3', labels: [], createdAt: '2026-01-03T00:00:00.000Z' });

    const proposals = await service.list();

    expect(proposals).toHaveLength(1);
    expect(proposals[0]?.id).toBe('1');
    expect(proposals[0]?.status).toBe('READY');
  });

  it('maps simulationId from the PR head branch', async () => {
    (github.listOpenPullRequests as ReturnType<typeof vi.fn>).mockResolvedValue(['7']);
    (github.getPullRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
      title: 'Proposal: sim-bob-xyz',
      head: 'sim-bob-xyz',
      labels: ['ci:ready'],
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    const proposals = await service.list();

    expect(proposals[0]?.simulationId).toBe('sim-bob-xyz');
  });

  it('defaults to only ci:ready PRs when status is omitted', async () => {
    (github.listOpenPullRequests as ReturnType<typeof vi.fn>).mockResolvedValue(['1', '2']);
    (github.getPullRequest as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ title: 'P1', head: 'sim-1', labels: ['ci:ready'], createdAt: '2026-01-01T00:00:00.000Z' })
      .mockResolvedValueOnce({ title: 'P2', head: 'sim-2', labels: ['ci:blocked'], createdAt: '2026-01-02T00:00:00.000Z' });

    const proposals = await service.list();

    expect(proposals).toHaveLength(1);
    expect(proposals[0]?.status).toBe('READY');
  });

  it('returns only ci:blocked PRs when status=blocked', async () => {
    (github.listOpenPullRequests as ReturnType<typeof vi.fn>).mockResolvedValue(['1', '2']);
    (github.getPullRequest as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ title: 'P1', head: 'sim-1', labels: ['ci:ready'], createdAt: '2026-01-01T00:00:00.000Z' })
      .mockResolvedValueOnce({ title: 'P2', head: 'sim-2', labels: ['ci:blocked'], createdAt: '2026-01-02T00:00:00.000Z' });

    const proposals = await service.list('blocked');

    expect(proposals).toHaveLength(1);
    expect(proposals[0]?.id).toBe('2');
    expect(proposals[0]?.status).toBe('BLOCKED');
  });

  it('returns all open PRs unfiltered when status=all', async () => {
    (github.listOpenPullRequests as ReturnType<typeof vi.fn>).mockResolvedValue(['1', '2', '3']);
    (github.getPullRequest as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ title: 'P1', head: 'sim-1', labels: ['ci:ready'], createdAt: '2026-01-01T00:00:00.000Z' })
      .mockResolvedValueOnce({ title: 'P2', head: 'sim-2', labels: ['ci:blocked'], createdAt: '2026-01-02T00:00:00.000Z' })
      .mockResolvedValueOnce({ title: 'P3', head: 'sim-3', labels: [], createdAt: '2026-01-03T00:00:00.000Z' });

    const proposals = await service.list('all');

    expect(proposals).toHaveLength(3);
  });

  it('throws 400 for an unrecognized status value', async () => {
    await expect(service.list('bogus')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('derives role from a role:student/role:professor label alongside the CI label', async () => {
    (github.listOpenPullRequests as ReturnType<typeof vi.fn>).mockResolvedValue(['1', '2']);
    (github.getPullRequest as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ title: 'P1', head: 'sim-1', labels: ['ci:ready', 'role:student'], createdAt: '2026-01-01T00:00:00.000Z' })
      .mockResolvedValueOnce({ title: 'P2', head: 'sim-2', labels: ['ci:ready', 'role:professor'], createdAt: '2026-01-02T00:00:00.000Z' });

    const proposals = await service.list('all');

    expect(proposals.find((p) => p.id === '1')?.role).toBe('student');
    expect(proposals.find((p) => p.id === '2')?.role).toBe('professor');
  });

  it('leaves role undefined when no role label is present', async () => {
    (github.listOpenPullRequests as ReturnType<typeof vi.fn>).mockResolvedValue(['1']);
    (github.getPullRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
      title: 'P1', head: 'sim-1', labels: ['ci:ready'], createdAt: '2026-01-01T00:00:00.000Z',
    });

    const proposals = await service.list('all');

    expect(proposals[0]?.role).toBeUndefined();
  });
});

describe('ProposalService.get()', () => {
  let github: IGitHubService;
  let graph: IGraphService;
  let rules: IRulesService;
  let service: ProposalService;

  beforeEach(() => {
    github = makeGitHub();
    // Same class on both sides by default — no class-diff noise for tests
    // that aren't specifically exercising the comparison.
    (github.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(makeScheduleJson([DEFAULT_CLASS]));
    graph = makeGraph();
    rules = makeRules();
    service = new ProposalService(github, graph, makeCi(), rules);
  });

  it('returns ProposalDetail with diff and status', async () => {
    const detail = await service.get('42');

    expect(detail.id).toBe('42');
    expect(detail.simulationId).toBe('sim-alice-abc123');
    expect(detail.status).toBe('READY');
    expect(detail.diff).toBe('diff --git a/schedule.json');
    expect(detail.createdAt).toBe('2026-06-11T10:00:00.000Z');
  });

  it('derives BLOCKED status from ci:blocked label', async () => {
    (github.getPullRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
      title: 'Proposal: sim-x',
      head: 'sim-x',
      labels: ['ci:blocked'],
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    const detail = await service.get('5');

    expect(detail.status).toBe('BLOCKED');
  });

  it('derives PENDING status when no CI label', async () => {
    (github.getPullRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
      title: 'Proposal: sim-y',
      head: 'sim-y',
      labels: [],
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    const detail = await service.get('9');

    expect(detail.status).toBe('PENDING');
  });

  it('hydrates two scratch "check-" branches — main baseline and the PR head branch', async () => {
    await service.get('42');

    expect(github.readFile).toHaveBeenCalledWith('main', 'schedule.json');
    expect(github.readFile).toHaveBeenCalledWith('sim-alice-abc123', 'schedule.json');
    expect(graph.hydrate).toHaveBeenCalledTimes(2);
    const runIds = (graph.hydrate as ReturnType<typeof vi.fn>).mock.calls.map((call) => call[0] as string);
    expect(runIds.some((id) => id.startsWith('check-main-'))).toBe(true);
    expect(runIds.some((id) => id.startsWith('check-sim-alice-abc123-'))).toBe(true);
  });

  it('reads current metric rules via rulesService.listMetrics()', async () => {
    await service.get('42');

    expect(rules.listMetrics).toHaveBeenCalledOnce();
  });

  it('scores both branches and attaches the candidate score to ProposalDetail.score', async () => {
    const baselineScore = { score: 40, breakdown: [] };
    const candidateScore = { score: 64, breakdown: [] };
    graph = makeGraph({ baselineScore, candidateScore });
    service = new ProposalService(github, graph, makeCi(), rules);

    const detail = await service.get('42');

    expect(detail.score).toEqual(candidateScore);
    expect(detail.comparison.candidateScore).toEqual(candidateScore);
    expect(detail.comparison.baselineScore).toEqual(baselineScore);
  });

  it('always flushes the baseline scratch branch, including when its own scoring fails', async () => {
    (graph.scoreTimetable as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('score error'));

    await expect(service.get('42')).rejects.toThrow('score error');

    // Baseline (main) is hydrated/scored first; it fails before the
    // candidate branch is ever touched.
    expect(graph.hydrate).toHaveBeenCalledOnce();
    expect(graph.flush).toHaveBeenCalledOnce();
  });

  it('flushes both scratch branches even when only the candidate side fails', async () => {
    (graph.scoreTimetable as ReturnType<typeof vi.fn>).mockImplementation(async (runId: string) => {
      if (isBaselineRunId(runId)) return FAKE_SCORE;
      throw new Error('candidate score error');
    });

    await expect(service.get('42')).rejects.toThrow('candidate score error');

    expect(graph.hydrate).toHaveBeenCalledTimes(2);
    expect(graph.flush).toHaveBeenCalledTimes(2);
  });

  it('still flushes the scratch branch when hydrate itself throws', async () => {
    (graph.hydrate as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('hydration failed'));

    await expect(service.get('42')).rejects.toThrow('hydration failed');

    expect(graph.flush).toHaveBeenCalledOnce();
    const hydrateRunId = (graph.hydrate as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    expect(graph.flush).toHaveBeenCalledWith(hydrateRunId);
  });

  it('computes classDiff from the parsed main vs. candidate schedule.json', async () => {
    const changedClass: RawClass = { ...DEFAULT_CLASS, roomId: 'RM_102' };
    const addedClass: RawClass = { ...DEFAULT_CLASS, id: 'CLS_002' };
    (github.readFile as ReturnType<typeof vi.fn>).mockImplementation(async (branch: string) =>
      branch === 'main' ? makeScheduleJson([DEFAULT_CLASS]) : makeScheduleJson([changedClass, addedClass]),
    );

    const detail = await service.get('42');

    expect(detail.comparison.classDiff.added.map((c) => c.id)).toEqual(['CLS_002']);
    expect(detail.comparison.classDiff.removed).toEqual([]);
    expect(detail.comparison.classDiff.changed).toEqual([
      {
        classId: 'CLS_001',
        before: DEFAULT_CLASS,
        after: changedClass,
        fieldChanges: [{ field: 'roomId', before: 'RM_101', after: 'RM_102' }],
      },
    ]);
  });

  it('computes conflictDelta between baseline and candidate conflicts', async () => {
    graph = makeGraph({ baselineConflicts: [BASELINE_CONFLICT], candidateConflicts: [FAKE_CONFLICT] });
    service = new ProposalService(github, graph, makeCi(), rules);

    const detail = await service.get('42');

    expect(detail.comparison.baselineConflicts).toEqual([BASELINE_CONFLICT]);
    expect(detail.comparison.candidateConflicts).toEqual([FAKE_CONFLICT]);
    expect(detail.comparison.conflictDelta.added).toEqual([FAKE_CONFLICT]);
    expect(detail.comparison.conflictDelta.resolved).toEqual([BASELINE_CONFLICT]);
  });

  it('includes policy constraint violations alongside structural conflicts in the comparison', async () => {
    const violation: Conflict = {
      id: 'GAP_LIMIT_EXCEEDED_constraint-2_CLS_001_CLS_005',
      type: 'GAP_LIMIT_EXCEEDED',
      classIds: ['CLS_001', 'CLS_005'],
      message: "Gap between professor 'Dr. Jones''s classes exceeds the institution limit of 2 slots",
    };
    graph = makeGraph({
      baselineConflicts: [],
      candidateConflicts: [],
      candidateConstraintViolations: [violation],
    });
    rules = makeRules([CONSECUTIVE_LIMIT_CONSTRAINT]);
    service = new ProposalService(github, graph, makeCi(), rules);

    const detail = await service.get('42');

    expect(detail.comparison.candidateConflicts).toEqual([violation]);
    expect(detail.comparison.conflictDelta.added).toEqual([violation]);
  });
});

describe('ProposalService.merge()', () => {
  let github: IGitHubService;
  let service: ProposalService;

  beforeEach(() => {
    github = makeGitHub();
    service = new ProposalService(github, makeGraph(), makeCi(), makeRules());
  });

  it('merges the PR and returns Proposal with MERGED status', async () => {
    const proposal = await service.merge('42');

    expect(github.mergePullRequest).toHaveBeenCalledWith('42');
    expect(proposal.status).toBe('MERGED');
    expect(proposal.id).toBe('42');
    expect(proposal.simulationId).toBe('sim-alice-abc123');
  });

  it('throws 409 when PR does not have ci:ready label', async () => {
    (github.getPullRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
      title: 'Proposal: sim-blocked',
      head: 'sim-blocked',
      labels: ['ci:blocked'],
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    await expect(service.merge('5')).rejects.toMatchObject({
      statusCode: 409,
    });

    expect(github.mergePullRequest).not.toHaveBeenCalled();
  });

  it('throws 409 when PR has no CI label (PENDING)', async () => {
    (github.getPullRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
      title: 'Proposal: sim-pending',
      head: 'sim-pending',
      labels: [],
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    await expect(service.merge('9')).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('returns createdAt from the PR', async () => {
    const proposal = await service.merge('42');

    expect(proposal.createdAt).toBe('2026-06-11T10:00:00.000Z');
  });
});

describe('ProposalService.reject()', () => {
  let github: IGitHubService;
  let service: ProposalService;

  beforeEach(() => {
    github = makeGitHub();
    service = new ProposalService(github, makeGraph(), makeCi(), makeRules());
  });

  it('closes the PR', async () => {
    await service.reject('42');

    expect(github.closePullRequest).toHaveBeenCalledWith('42');
  });

  it('returns a Proposal with status REJECTED, the PR id, and its head/createdAt', async () => {
    const proposal = await service.reject('42');

    expect(proposal).toEqual({
      id: '42',
      simulationId: 'sim-alice-abc123',
      status: 'REJECTED',
      createdAt: '2026-06-11T10:00:00.000Z',
    });
  });

  it('does not merge the PR', async () => {
    await service.reject('42');

    expect(github.mergePullRequest).not.toHaveBeenCalled();
  });
});
