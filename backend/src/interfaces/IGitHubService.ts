// Placeholder interface for the GitHub integration layer.
// Concrete implementation will be added in the GitHub service ticket.

export interface IGitHubService {
  createBranch(branchName: string, sourceBranch: string): Promise<void>;
  deleteBranch(branchName: string): Promise<void>;
  readFile(branch: string, path: string): Promise<string>;
  // Like readFile, but also returns the blob SHA so a caller can pass it back
  // to writeFile as expectedSha for optimistic-concurrency protection on a
  // shared file (e.g. rules.json) that multiple callers may race to update.
  readFileWithSha(branch: string, path: string): Promise<{ content: string; sha: string }>;
  // expectedSha is optional: omit it to preserve today's "always write,
  // fetching whatever SHA is current" behavior (used for per-simulation
  // scratch files nothing else can race on). Pass it — from a prior
  // readFileWithSha call — to reject the write with ApiError.conflict if the
  // file changed since it was read.
  writeFile(
    branch: string,
    path: string,
    content: string,
    message: string,
    expectedSha?: string,
  ): Promise<void>;
  createPullRequest(head: string, base: string, title: string, body: string): Promise<string>;
  mergePullRequest(pullRequestId: string): Promise<void>;
  getPullRequestDiff(pullRequestId: string): Promise<string>;
  listOpenPullRequests(): Promise<readonly string[]>;
  addPullRequestComment(pullRequestId: string, body: string): Promise<void>;
  getPullRequest(pullRequestId: string): Promise<PullRequestInfo>;
  setPullRequestLabels(pullRequestId: string, labels: readonly string[]): Promise<void>;
}

export interface PullRequestInfo {
  readonly title: string;
  readonly head: string;
  readonly labels: readonly string[];
  readonly createdAt: string;
}
