import { describe, it, expect, beforeEach } from 'vitest';
import { LocalGitHubService } from './LocalGitHubService.js';

function buildSeed(): Record<string, string> {
  return {
    'schedule.json': JSON.stringify({ value: 'main-schedule' }),
    'rules.json': JSON.stringify({ metrics: [], constraints: [] }),
  };
}

describe('LocalGitHubService', () => {
  let service: LocalGitHubService;

  beforeEach(() => {
    service = new LocalGitHubService(buildSeed());
  });

  // ── createBranch / deleteBranch ─────────────────────────────────────────────

  it('createBranch copies the source branch\'s files into a new branch', async () => {
    await service.createBranch('sim-1', 'main');
    const content = await service.readFile('sim-1', 'schedule.json');
    expect(content).toBe(JSON.stringify({ value: 'main-schedule' }));
  });

  it('createBranch throws notFound when the source branch does not exist', async () => {
    await expect(service.createBranch('sim-1', 'does-not-exist')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('deleteBranch removes a previously created branch', async () => {
    await service.createBranch('sim-1', 'main');
    await service.deleteBranch('sim-1');
    await expect(service.readFile('sim-1', 'schedule.json')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  // ── readFile / writeFile ─────────────────────────────────────────────────────

  it('readFile throws notFound for a missing branch', async () => {
    await expect(service.readFile('does-not-exist', 'schedule.json')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('readFile throws notFound for a missing file on an existing branch', async () => {
    await expect(service.readFile('main', 'missing.json')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('writeFile updates the content read back by readFile on the same branch', async () => {
    await service.writeFile('main', 'schedule.json', '{"updated":true}', 'test commit');
    const content = await service.readFile('main', 'schedule.json');
    expect(content).toBe('{"updated":true}');
  });

  it('writeFile changes on a branch do not affect other branches', async () => {
    await service.createBranch('sim-1', 'main');
    await service.writeFile('sim-1', 'schedule.json', '{"updated":true}', 'test commit');
    const mainContent = await service.readFile('main', 'schedule.json');
    expect(mainContent).toBe(JSON.stringify({ value: 'main-schedule' }));
  });

  // ── createPullRequest / getPullRequest / setPullRequestLabels ────────────────

  it('createPullRequest returns incrementing numeric ids and getPullRequest reflects them', async () => {
    await service.createBranch('sim-1', 'main');
    const id = await service.createPullRequest('sim-1', 'main', 'My PR', 'description');

    expect(id).toBe('1');
    const pr = await service.getPullRequest(id);
    expect(pr).toMatchObject({ title: 'My PR', head: 'sim-1', labels: [] });
  });

  it('getPullRequest throws notFound for an unknown id', async () => {
    await expect(service.getPullRequest('999')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('setPullRequestLabels replaces the labels returned by getPullRequest', async () => {
    await service.createBranch('sim-1', 'main');
    const id = await service.createPullRequest('sim-1', 'main', 'My PR', 'description');

    await service.setPullRequestLabels(id, ['ci:ready']);

    const pr = await service.getPullRequest(id);
    expect(pr.labels).toEqual(['ci:ready']);
  });

  it('listOpenPullRequests only returns pull requests that have not been merged', async () => {
    await service.createBranch('sim-1', 'main');
    await service.createBranch('sim-2', 'main');
    const id1 = await service.createPullRequest('sim-1', 'main', 'PR 1', 'd1');
    const id2 = await service.createPullRequest('sim-2', 'main', 'PR 2', 'd2');

    await service.mergePullRequest(id1);

    expect(await service.listOpenPullRequests()).toEqual([id2]);
  });

  // ── mergePullRequest ──────────────────────────────────────────────────────────

  it('mergePullRequest copies the head branch\'s files onto the base branch', async () => {
    await service.createBranch('sim-1', 'main');
    await service.writeFile('sim-1', 'schedule.json', '{"updated":true}', 'edit');
    const id = await service.createPullRequest('sim-1', 'main', 'My PR', 'description');

    await service.mergePullRequest(id);

    const mainContent = await service.readFile('main', 'schedule.json');
    expect(mainContent).toBe('{"updated":true}');
  });

  it('mergePullRequest throws notFound for an unknown id', async () => {
    await expect(service.mergePullRequest('999')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  // ── getPullRequestDiff ────────────────────────────────────────────────────────

  it('getPullRequestDiff returns a unified diff between the base and head schedule.json', async () => {
    await service.createBranch('sim-1', 'main');
    await service.writeFile('sim-1', 'schedule.json', '{"value":"changed"}', 'edit');
    const id = await service.createPullRequest('sim-1', 'main', 'My PR', 'description');

    const result = await service.getPullRequestDiff(id);

    expect(result).toContain('-{"value":"main-schedule"}');
    expect(result).toContain('+{"value":"changed"}');
  });

  // ── addPullRequestComment ────────────────────────────────────────────────────

  it('addPullRequestComment resolves for an existing pull request and throws notFound otherwise', async () => {
    await service.createBranch('sim-1', 'main');
    const id = await service.createPullRequest('sim-1', 'main', 'My PR', 'description');

    await expect(service.addPullRequestComment(id, 'a comment')).resolves.toBeUndefined();
    await expect(service.addPullRequestComment('999', 'a comment')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  // ── default fixtures ──────────────────────────────────────────────────────────

  it('defaults to seeding "main" from the bundled mock fixture files when no seed is provided', async () => {
    const defaultService = new LocalGitHubService();
    const scheduleJson = await defaultService.readFile('main', 'schedule.json');
    const parsed = JSON.parse(scheduleJson) as { classes: unknown[] };
    expect(Array.isArray(parsed.classes)).toBe(true);
    expect(parsed.classes.length).toBeGreaterThan(0);
  });
});
