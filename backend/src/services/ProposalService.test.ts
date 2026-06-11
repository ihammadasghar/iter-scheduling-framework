import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProposalService } from './ProposalService.js';
import type { IGitHubService } from '../interfaces/IGitHubService.js';
import type { IGraphService } from '../interfaces/IGraphService.js';
import type { ICiPipelineService } from '../interfaces/ICiPipelineService.js';
import type { Conflict } from '../types/domain.js';

const FAKE_CONFLICT: Conflict = {
  id: 'ROOM_DOUBLE_BOOK_CLS_001_CLS_002',
  type: 'ROOM_DOUBLE_BOOK',
  classIds: ['CLS_001', 'CLS_002'],
  message: 'Room RM_101 is double-booked',
};

const makeGitHub = (): IGitHubService => ({
  createBranch: vi.fn().mockResolvedValue(undefined),
  deleteBranch: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(''),
  writeFile: vi.fn().mockResolvedValue(undefined),
  createPullRequest: vi.fn().mockResolvedValue('42'),
  mergePullRequest: vi.fn().mockResolvedValue(undefined),
  getPullRequestDiff: vi.fn().mockResolvedValue(''),
  listOpenPullRequests: vi.fn().mockResolvedValue([]),
  addPullRequestComment: vi.fn().mockResolvedValue(undefined),
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

const makeCi = (conflicts: readonly Conflict[] = []): ICiPipelineService => ({
  run: vi.fn().mockResolvedValue({
    status: conflicts.length > 0 ? 'BLOCKED' : 'READY',
    conflicts,
  }),
});

describe('ProposalService.submit()', () => {
  const VALID_PARAMS = {
    simulationId: 'sim-alice-abc123',
    description: 'Rescheduling Biology lectures to reduce room conflicts',
  };

  let github: IGitHubService;
  let graph: IGraphService;
  let ci: ICiPipelineService;
  let service: ProposalService;

  beforeEach(() => {
    github = makeGitHub();
    graph = makeGraph();
    ci = makeCi();
    service = new ProposalService(github, graph, ci);
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
    service = new ProposalService(github, graph, ci);

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
    service = new ProposalService(github, graph, ci);

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
});

