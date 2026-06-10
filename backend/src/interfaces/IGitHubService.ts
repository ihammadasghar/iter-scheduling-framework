// Placeholder interface for the GitHub integration layer.
// Concrete implementation will be added in the GitHub service ticket.

export interface IGitHubService {
  createBranch(branchName: string, sourceBranch: string): Promise<void>;
  deleteBranch(branchName: string): Promise<void>;
  readFile(branch: string, path: string): Promise<string>;
  writeFile(branch: string, path: string, content: string, message: string): Promise<void>;
  createPullRequest(head: string, base: string, title: string, body: string): Promise<string>;
  mergePullRequest(pullRequestId: string): Promise<void>;
  getPullRequestDiff(pullRequestId: string): Promise<string>;
  listOpenPullRequests(): Promise<readonly string[]>;
}
