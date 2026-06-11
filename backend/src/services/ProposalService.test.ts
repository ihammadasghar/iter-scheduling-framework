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

  it('sets ci:ready label on the PR when CI passes', async () => {
    await service.submit(VALID_PARAMS);

    expect(github.setPullRequestLabels).toHaveBeenCalledWith('42', ['ci:ready']);
  });

  it('sets ci:blocked label on the PR when CI fails', async () => {
    ci = makeCi([FAKE_CONFLICT]);
    service = new ProposalService(github, graph, ci);

    await service.submit(VALID_PARAMS);

    expect(github.setPullRequestLabels).toHaveBeenCalledWith('42', ['ci:blocked']);
  });
});

describe('ProposalService.list()', () => {
  let github: IGitHubService;
  let service: ProposalService;

  beforeEach(() => {
    github = makeGitHub();
    service = new ProposalService(github, makeGraph(), makeCi());
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
});

describe('ProposalService.get()', () => {
  let github: IGitHubService;
  let service: ProposalService;

  beforeEach(() => {
    github = makeGitHub();
    service = new ProposalService(github, makeGraph(), makeCi());
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
});

describe('ProposalService.merge()', () => {
  let github: IGitHubService;
  let service: ProposalService;

  beforeEach(() => {
    github = makeGitHub();
    service = new ProposalService(github, makeGraph(), makeCi());
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

