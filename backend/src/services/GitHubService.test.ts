import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Octokit } from '@octokit/rest';
import { GitHubService } from './GitHubService.js';
import { ApiError } from '../types/ApiError.js';

// Partial mock of the Octokit REST methods used by GitHubService
type MockOctokit = {
  rest: {
    git: {
      getRef: ReturnType<typeof vi.fn>;
      createRef: ReturnType<typeof vi.fn>;
      deleteRef: ReturnType<typeof vi.fn>;
    };
    repos: {
      getContent: ReturnType<typeof vi.fn>;
      createOrUpdateFileContents: ReturnType<typeof vi.fn>;
    };
    pulls: {
      create: ReturnType<typeof vi.fn>;
      merge: ReturnType<typeof vi.fn>;
      list: ReturnType<typeof vi.fn>;
    };
    issues: {
      createComment: ReturnType<typeof vi.fn>;
    };
  };
  request: ReturnType<typeof vi.fn>;
};

const OWNER = 'test-owner';
const REPO = 'test-repo';

function buildMockOctokit(): MockOctokit {
  return {
    rest: {
      git: {
        getRef: vi.fn(),
        createRef: vi.fn(),
        deleteRef: vi.fn(),
      },
      repos: {
        getContent: vi.fn(),
        createOrUpdateFileContents: vi.fn(),
      },
      pulls: {
        create: vi.fn(),
        merge: vi.fn(),
        list: vi.fn(),
      },
      issues: {
        createComment: vi.fn(),
      },
    },
    request: vi.fn(),
  };
}

describe('GitHubService', () => {
  let mock: MockOctokit;
  let service: GitHubService;

  beforeEach(() => {
    mock = buildMockOctokit();
    service = new GitHubService(mock as unknown as Octokit, OWNER, REPO);
  });

  // ── createBranch ────────────────────────────────────────────────────────────

  it('createBranch fetches source SHA then creates ref', async () => {
    mock.rest.git.getRef.mockResolvedValue({ data: { object: { sha: 'abc123' } } });
    mock.rest.git.createRef.mockResolvedValue({});

    await service.createBranch('sim-user-1', 'main');

    expect(mock.rest.git.getRef).toHaveBeenCalledWith({
      owner: OWNER, repo: REPO, ref: 'heads/main',
    });
    expect(mock.rest.git.createRef).toHaveBeenCalledWith({
      owner: OWNER, repo: REPO, ref: 'refs/heads/sim-user-1', sha: 'abc123',
    });
  });

  // ── deleteBranch ────────────────────────────────────────────────────────────

  it('deleteBranch calls deleteRef with correct ref', async () => {
    mock.rest.git.deleteRef.mockResolvedValue({});

    await service.deleteBranch('sim-user-1');

    expect(mock.rest.git.deleteRef).toHaveBeenCalledWith({
      owner: OWNER, repo: REPO, ref: 'heads/sim-user-1',
    });
  });

  // ── readFile ────────────────────────────────────────────────────────────────

  it('readFile decodes base64 content from GitHub response', async () => {
    const rawContent = JSON.stringify({ hello: 'world' });
    const encoded = Buffer.from(rawContent, 'utf-8').toString('base64');
    mock.rest.repos.getContent.mockResolvedValue({
      data: { type: 'file', content: encoded, sha: 'sha1' },
    });

    const result = await service.readFile('main', 'schedule.json');

    expect(result).toBe(rawContent);
    expect(mock.rest.repos.getContent).toHaveBeenCalledWith({
      owner: OWNER, repo: REPO, path: 'schedule.json', ref: 'main',
    });
  });

  it('readFile throws badRequest when path resolves to a directory', async () => {
    mock.rest.repos.getContent.mockResolvedValue({ data: [{ type: 'dir' }] });

    await expect(service.readFile('main', 'some-dir')).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  // ── writeFile ───────────────────────────────────────────────────────────────

  it('writeFile creates a new file when it does not yet exist', async () => {
    // First call (getFileSha) returns 404 → no existing SHA
    mock.rest.repos.getContent.mockRejectedValue({ status: 404 });
    mock.rest.repos.createOrUpdateFileContents.mockResolvedValue({});

    await service.writeFile('main', 'new.json', '{}', 'add new.json');

    const calls = mock.rest.repos.createOrUpdateFileContents.mock.calls;
    const call = calls[0]?.[0] as Record<string, unknown> | undefined;
    expect(call?.['sha']).toBeUndefined();
    expect(call?.['path']).toBe('new.json');
  });

  it('writeFile updates an existing file, passing its current SHA', async () => {
    mock.rest.repos.getContent.mockResolvedValue({
      data: { type: 'file', content: 'e30=', sha: 'existing-sha' },
    });
    mock.rest.repos.createOrUpdateFileContents.mockResolvedValue({});

    await service.writeFile('main', 'schedule.json', '{"updated":true}', 'update');

    const calls = mock.rest.repos.createOrUpdateFileContents.mock.calls;
    const call = calls[0]?.[0] as Record<string, unknown> | undefined;
    expect(call?.['sha']).toBe('existing-sha');
  });

  // ── createPullRequest ───────────────────────────────────────────────────────

  it('createPullRequest returns the PR number as a string', async () => {
    mock.rest.pulls.create.mockResolvedValue({ data: { number: 42 } });

    const id = await service.createPullRequest('sim-1', 'main', 'My PR', 'description');

    expect(id).toBe('42');
    expect(mock.rest.pulls.create).toHaveBeenCalledWith(
      expect.objectContaining({ head: 'sim-1', base: 'main', title: 'My PR' }),
    );
  });

  // ── mergePullRequest ────────────────────────────────────────────────────────

  it('mergePullRequest calls pulls.merge with the numeric PR number', async () => {
    mock.rest.pulls.merge.mockResolvedValue({});

    await service.mergePullRequest('42');

    expect(mock.rest.pulls.merge).toHaveBeenCalledWith({
      owner: OWNER, repo: REPO, pull_number: 42,
    });
  });

  // ── getPullRequestDiff ──────────────────────────────────────────────────────

  it('getPullRequestDiff requests raw diff via accept header', async () => {
    const fakeDiff = 'diff --git a/schedule.json b/schedule.json\n...';
    mock.request.mockResolvedValue({ data: fakeDiff });

    const result = await service.getPullRequestDiff('7');

    expect(result).toBe(fakeDiff);
    expect(mock.request).toHaveBeenCalledWith(
      'GET /repos/{owner}/{repo}/pulls/{pull_number}',
      expect.objectContaining({
        pull_number: 7,
        headers: { accept: 'application/vnd.github.diff' },
      }),
    );
  });

  // ── listOpenPullRequests ────────────────────────────────────────────────────

  it('listOpenPullRequests returns open PR numbers as strings', async () => {
    mock.rest.pulls.list.mockResolvedValue({
      data: [{ number: 1 }, { number: 2 }, { number: 5 }],
    });

    const ids = await service.listOpenPullRequests();

    expect(ids).toEqual(['1', '2', '5']);
    expect(mock.rest.pulls.list).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'open' }),
    );
  });

  // ── addPullRequestComment ───────────────────────────────────────────────────

  it('addPullRequestComment calls issues.createComment with numeric PR number', async () => {
    mock.rest.issues.createComment.mockResolvedValue({});

    await service.addPullRequestComment('42', 'CI passed');

    expect(mock.rest.issues.createComment).toHaveBeenCalledWith({
      owner: OWNER,
      repo: REPO,
      issue_number: 42,
      body: 'CI passed',
    });
  });
});
