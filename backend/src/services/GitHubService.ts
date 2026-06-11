import { Octokit } from '@octokit/rest';
import { ApiError } from '../types/ApiError.js';
import type { IGitHubService } from '../interfaces/IGitHubService.js';

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
    const { data } = await this.octokit.rest.repos.getContent({
      owner: this.owner,
      repo: this.repo,
      path,
      ref: branch,
    });

    if (Array.isArray(data) || data.type !== 'file') {
      throw ApiError.badRequest(`Path "${path}" is not a file`);
    }

    return Buffer.from(data.content, 'base64').toString('utf-8');
  }

  async writeFile(
    branch: string,
    path: string,
    content: string,
    message: string,
  ): Promise<void> {
    const existingSha = await this.getFileSha(branch, path);

    await this.octokit.rest.repos.createOrUpdateFileContents({
      owner: this.owner,
      repo: this.repo,
      branch,
      path,
      message,
      content: Buffer.from(content, 'utf-8').toString('base64'),
      ...(existingSha !== null ? { sha: existingSha } : {}),
    });
  }

  async createPullRequest(
    head: string,
    base: string,
    title: string,
    body: string,
  ): Promise<string> {
    const { data } = await this.octokit.rest.pulls.create({
      owner: this.owner,
      repo: this.repo,
      head,
      base,
      title,
      body,
    });

    return String(data.number);
  }

  async mergePullRequest(pullRequestId: string): Promise<void> {
    await this.octokit.rest.pulls.merge({
      owner: this.owner,
      repo: this.repo,
      pull_number: parseInt(pullRequestId, 10),
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
  return (
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    (err as { status: unknown }).status === 404
  );
}
