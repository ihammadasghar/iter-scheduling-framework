import { readFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { createTwoFilesPatch } from 'diff';
import { ApiError } from '../types/ApiError.js';
import type { IGitHubService, PullRequestInfo } from '../interfaces/IGitHubService.js';

const SCHEDULE_JSON_PATH = 'schedule.json';

interface PullRequestRecord {
  readonly head: string;
  readonly base: string;
  readonly title: string;
  readonly body: string;
  labels: string[];
  readonly createdAt: string;
  state: 'open' | 'merged' | 'closed';
}

/**
 * In-memory stand-in for GitHubService, used when GITHUB_PROVIDER=mock.
 * Models branches as file maps and pull requests as a numbered record —
 * enough fidelity for the full simulation -> proposal -> merge flow to run
 * with no real GitHub account, repo, or network access.
 */
export class LocalGitHubService implements IGitHubService {
  private readonly branches = new Map<string, Map<string, string>>();
  // sha keyed by "branch:path" — mirrors GitHub's blob SHA well enough to
  // exercise the optimistic-concurrency path in RulesService/GitHubService.
  private readonly fileShas = new Map<string, string>();
  private readonly pullRequests = new Map<string, PullRequestRecord>();
  private nextPullRequestNumber = 1;

  constructor(seedFiles: Readonly<Record<string, string>> = loadDefaultFixtures()) {
    this.branches.set('main', new Map(Object.entries(seedFiles)));
  }

  async createBranch(branchName: string, sourceBranch: string): Promise<void> {
    const source = this.branches.get(sourceBranch);
    if (!source) {
      throw ApiError.notFound(`Branch '${sourceBranch}' not found`);
    }
    this.branches.set(branchName, new Map(source));
  }

  async deleteBranch(branchName: string): Promise<void> {
    this.branches.delete(branchName);
  }

  async readFile(branch: string, path: string): Promise<string> {
    const files = this.getBranchFiles(branch);
    const content = files.get(path);
    if (content === undefined) {
      throw ApiError.notFound(`File '${path}' not found on branch '${branch}'`);
    }
    return content;
  }

  async readFileWithSha(branch: string, path: string): Promise<{ content: string; sha: string }> {
    const content = await this.readFile(branch, path);
    const shaKey = this.shaKey(branch, path);
    let sha = this.fileShas.get(shaKey);
    if (sha === undefined) {
      sha = randomUUID();
      this.fileShas.set(shaKey, sha);
    }
    return { content, sha };
  }

  async writeFile(
    branch: string,
    path: string,
    content: string,
    _message: string,
    expectedSha?: string,
  ): Promise<void> {
    const shaKey = this.shaKey(branch, path);
    if (expectedSha !== undefined) {
      const currentSha = this.fileShas.get(shaKey);
      if (currentSha !== undefined && currentSha !== expectedSha) {
        throw ApiError.conflict(`"${path}" on branch "${branch}" was modified concurrently; retry your change`);
      }
    }

    const files = this.getBranchFiles(branch);
    files.set(path, content);
    this.fileShas.set(shaKey, randomUUID());
  }

  private shaKey(branch: string, path: string): string {
    return `${branch}:${path}`;
  }

  async createPullRequest(head: string, base: string, title: string, body: string): Promise<string> {
    const id = String(this.nextPullRequestNumber++);
    this.pullRequests.set(id, {
      head,
      base,
      title,
      body,
      labels: [],
      createdAt: new Date().toISOString(),
      state: 'open',
    });
    return id;
  }

  async mergePullRequest(pullRequestId: string): Promise<void> {
    const pr = this.getPullRequestRecord(pullRequestId);
    const headFiles = this.getBranchFiles(pr.head);
    const baseFiles = this.getBranchFiles(pr.base);
    for (const [path, content] of headFiles) {
      baseFiles.set(path, content);
    }
    pr.state = 'merged';
  }

  async closePullRequest(pullRequestId: string): Promise<void> {
    const pr = this.getPullRequestRecord(pullRequestId);
    pr.state = 'closed';
  }

  async getPullRequestDiff(pullRequestId: string): Promise<string> {
    const pr = this.getPullRequestRecord(pullRequestId);
    const baseContent = this.branches.get(pr.base)?.get(SCHEDULE_JSON_PATH) ?? '';
    const headContent = this.branches.get(pr.head)?.get(SCHEDULE_JSON_PATH) ?? '';
    return createTwoFilesPatch(SCHEDULE_JSON_PATH, SCHEDULE_JSON_PATH, baseContent, headContent);
  }

  async listOpenPullRequests(): Promise<readonly string[]> {
    return [...this.pullRequests.entries()]
      .filter(([, pr]) => pr.state === 'open')
      .map(([id]) => id);
  }

  async addPullRequestComment(pullRequestId: string, _body: string): Promise<void> {
    this.getPullRequestRecord(pullRequestId);
  }

  async getPullRequest(pullRequestId: string): Promise<PullRequestInfo> {
    const pr = this.getPullRequestRecord(pullRequestId);
    return {
      title: pr.title,
      head: pr.head,
      labels: pr.labels,
      createdAt: pr.createdAt,
    };
  }

  async setPullRequestLabels(pullRequestId: string, labels: readonly string[]): Promise<void> {
    const pr = this.getPullRequestRecord(pullRequestId);
    pr.labels = [...labels];
  }

  private getBranchFiles(branch: string): Map<string, string> {
    const files = this.branches.get(branch);
    if (!files) {
      throw ApiError.notFound(`Branch '${branch}' not found`);
    }
    return files;
  }

  private getPullRequestRecord(pullRequestId: string): PullRequestRecord {
    const pr = this.pullRequests.get(pullRequestId);
    if (!pr) {
      throw ApiError.notFound(`Pull request '${pullRequestId}' not found`);
    }
    return pr;
  }
}

export function loadDefaultFixtures(): Readonly<Record<string, string>> {
  const scheduleJson = readFileSync(join(__dirname, '../fixtures/mock-schedule.json'), 'utf-8');
  const rulesJson = readFileSync(join(__dirname, '../fixtures/mock-rules.json'), 'utf-8');
  return {
    'schedule.json': scheduleJson,
    'rules.json': rulesJson,
  };
}
