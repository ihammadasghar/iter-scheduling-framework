import { Octokit } from '@octokit/rest';
import { ApiError } from '../types/ApiError.js';
import type { IGitHubService, PullRequestInfo } from '../interfaces/IGitHubService.js';

export class GitHubService implements IGitHubService {
  constructor(
    private readonly octokit: Octokit,
    private readonly owner: string,
    private readonly repo: string,
  ) {}

  async createBranch(branchName: string, sourceBranch: string): Promise<void> {
    const { data: sourceRef } = await this.octokit.rest.git.getRef({
      owner: this.owner,
      repo: this.repo,
      ref: `heads/${sourceBranch}`,
    });

    await this.octokit.rest.git.createRef({
      owner: this.owner,
      repo: this.repo,
      ref: `refs/heads/${branchName}`,
      sha: sourceRef.object.sha,
    });
  }

  async deleteBranch(branchName: string): Promise<void> {
    await this.octokit.rest.git.deleteRef({
      owner: this.owner,
      repo: this.repo,
      ref: `heads/${branchName}`,
    });
  }

  async readFile(branch: string, path: string): Promise<string> {
    const { content } = await this.fetchFile(branch, path);
    return content;
  }

  async readFileWithSha(branch: string, path: string): Promise<{ content: string; sha: string }> {
    return this.fetchFile(branch, path);
  }

  async readBlobBySha(sha: string): Promise<string> {
    const { data } = await this.octokit.rest.git.getBlob({
      owner: this.owner,
      repo: this.repo,
      file_sha: sha,
    });

    return Buffer.from(data.content, data.encoding as BufferEncoding).toString('utf-8');
  }

  async writeFile(
    branch: string,
    path: string,
    content: string,
    message: string,
    expectedSha?: string,
  ): Promise<void> {
    const sha = expectedSha ?? (await this.getFileSha(branch, path)) ?? undefined;

    try {
      await this.octokit.rest.repos.createOrUpdateFileContents({
        owner: this.owner,
        repo: this.repo,
        branch,
        path,
        message,
        content: Buffer.from(content, 'utf-8').toString('base64'),
        ...(sha !== undefined ? { sha } : {}),
      });
    } catch (err: unknown) {
      if (isConflictError(err)) {
        throw ApiError.conflict(
          `"${path}" on branch "${branch}" was modified concurrently; retry your change`,
        );
      }
      throw err;
    }
  }

  private async fetchFile(branch: string, path: string): Promise<{ content: string; sha: string }> {
    const { data } = await this.octokit.rest.repos.getContent({
      owner: this.owner,
      repo: this.repo,
      path,
      ref: branch,
    });

    if (Array.isArray(data) || data.type !== 'file') {
      throw ApiError.badRequest(`Path "${path}" is not a file`);
    }

    // The Contents API only inlines base64 `content` for files <= ~1MB;
    // above that it still returns `sha`/`size` but `content` comes back as
    // "" (encoding: "none") — decoding that yields an empty string, not
    // truncated JSON, which is why the failure downstream is "invalid JSON"
    // rather than a fetch error. Fall back to the Git Blob API, which
    // supports up to 100MB, whenever content wasn't inlined.
    if (!data.content) {
      return { content: await this.readBlobBySha(data.sha), sha: data.sha };
    }

    return {
      content: Buffer.from(data.content, 'base64').toString('utf-8'),
      sha: data.sha,
    };
  }

  async createPullRequest(
    head: string,
    base: string,
    title: string,
    body: string,
  ): Promise<string> {
    try {
      const { data } = await this.octokit.rest.pulls.create({
        owner: this.owner,
        repo: this.repo,
        head,
        base,
        title,
        body,
      });

      return String(data.number);
    } catch (err: unknown) {
      if (isUnprocessableError(err)) {
        const detail = extractGitHubErrorMessage(err);
        if (detail?.includes('already exists')) {
          throw ApiError.conflict(
            'A proposal for this draft is already open — check My Proposals before submitting again.',
          );
        }
        if (detail?.includes('No commits between')) {
          throw ApiError.badRequest('This draft has no changes yet — make an edit before submitting.');
        }
        throw ApiError.badRequest(detail ?? 'GitHub rejected this proposal. Please try again.');
      }
      throw err;
    }
  }

  async mergePullRequest(pullRequestId: string): Promise<void> {
    await this.octokit.rest.pulls.merge({
      owner: this.owner,
      repo: this.repo,
      pull_number: parseInt(pullRequestId, 10),
    });
  }

  async closePullRequest(pullRequestId: string): Promise<void> {
    await this.octokit.rest.pulls.update({
      owner: this.owner,
      repo: this.repo,
      pull_number: parseInt(pullRequestId, 10),
      state: 'closed',
    });
  }

  async getPullRequestDiff(pullRequestId: string): Promise<string> {
    const response = await this.octokit.request(
      'GET /repos/{owner}/{repo}/pulls/{pull_number}',
      {
        owner: this.owner,
        repo: this.repo,
        pull_number: parseInt(pullRequestId, 10),
        headers: { accept: 'application/vnd.github.diff' },
      },
    );

    return response.data as unknown as string;
  }

  async listOpenPullRequests(): Promise<readonly string[]> {
    const { data } = await this.octokit.rest.pulls.list({
      owner: this.owner,
      repo: this.repo,
      state: 'open',
    });

    return data.map((pr) => String(pr.number));
  }

  async addPullRequestComment(pullRequestId: string, body: string): Promise<void> {
    await this.octokit.rest.issues.createComment({
      owner: this.owner,
      repo: this.repo,
      issue_number: parseInt(pullRequestId, 10),
      body,
    });
  }

  async getPullRequest(pullRequestId: string): Promise<PullRequestInfo> {
    const { data } = await this.octokit.rest.pulls.get({
      owner: this.owner,
      repo: this.repo,
      pull_number: parseInt(pullRequestId, 10),
    });

    return {
      title: data.title,
      head: data.head.ref,
      labels: data.labels.map((l) => l.name ?? '').filter(Boolean),
      createdAt: data.created_at,
    };
  }

  async setPullRequestLabels(pullRequestId: string, labels: readonly string[]): Promise<void> {
    await this.octokit.rest.issues.setLabels({
      owner: this.owner,
      repo: this.repo,
      issue_number: parseInt(pullRequestId, 10),
      labels: labels as string[],
    });
  }

  // Returns the blob SHA of an existing file, or null if the file does not exist.
  private async getFileSha(branch: string, path: string): Promise<string | null> {
    try {
      const { data } = await this.octokit.rest.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path,
        ref: branch,
      });

      if (Array.isArray(data) || data.type !== 'file') {
        return null;
      }

      return data.sha;
    } catch (err: unknown) {
      if (isNotFoundError(err)) return null;
      throw err;
    }
  }
}

function isNotFoundError(err: unknown): boolean {
  return hasStatus(err, 404);
}

// GitHub's Contents API returns 409 when the `sha` passed to
// createOrUpdateFileContents no longer matches the file's current blob SHA —
// i.e. someone else wrote to this path since we read it.
function isConflictError(err: unknown): boolean {
  return hasStatus(err, 409);
}

// GitHub's Pulls API returns 422 for a range of validation failures on
// pulls.create — most commonly "a PR already exists for this head" (this
// simulation was already submitted) or "no commits between" (the branch
// hasn't diverged from base yet) — see extractGitHubErrorMessage below.
function isUnprocessableError(err: unknown): boolean {
  return hasStatus(err, 422);
}

function hasStatus(err: unknown, status: number): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    (err as { status: unknown }).status === status
  );
}

// Octokit's RequestError puts GitHub's actual validation detail in
// response.data.errors[].message (field-level) or response.data.message
// (top-level) — err.message itself is just "Validation Failed".
function extractGitHubErrorMessage(err: unknown): string | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const data = (err as { response?: { data?: unknown } }).response?.data;
  if (typeof data !== 'object' || data === null) return undefined;

  const errors = (data as { errors?: unknown }).errors;
  if (Array.isArray(errors)) {
    const messages = errors
      .map((e) => (typeof e === 'object' && e !== null ? (e as { message?: unknown }).message : undefined))
      .filter((m): m is string => typeof m === 'string');
    if (messages.length > 0) return messages.join(' ');
  }

  const message = (data as { message?: unknown }).message;
  return typeof message === 'string' ? message : undefined;
}
