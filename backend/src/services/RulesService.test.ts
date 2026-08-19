import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RulesService } from './RulesService.js';
import { ApiError } from '../types/ApiError.js';
import type { IGitHubService } from '../interfaces/IGitHubService.js';

const DEFAULT_SHA = 'sha-1';

const makeGitHub = (
  rulesJson = '{"metrics":[],"constraints":[]}',
  sha = DEFAULT_SHA,
): IGitHubService => ({
  createBranch: vi.fn().mockResolvedValue(undefined),
  deleteBranch: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(rulesJson),
  readFileWithSha: vi.fn().mockResolvedValue({ content: rulesJson, sha }),
  writeFile: vi.fn().mockResolvedValue(undefined),
  createPullRequest: vi.fn().mockResolvedValue('pr-1'),
  mergePullRequest: vi.fn().mockResolvedValue(undefined),
  closePullRequest: vi.fn().mockResolvedValue(undefined),
  getPullRequestDiff: vi.fn().mockResolvedValue(''),
  listOpenPullRequests: vi.fn().mockResolvedValue([]),
  addPullRequestComment: vi.fn().mockResolvedValue(undefined),
  getPullRequest: vi.fn().mockResolvedValue({ title: '', head: '', labels: [], createdAt: '' }),
  setPullRequestLabels: vi.fn().mockResolvedValue(undefined),
});

const METRIC_RULES = [
  { id: 'mr-1', name: 'Class Count', target: 'Class', condition: 'count', threshold: 0, weight: 1 },
];
const CONSTRAINTS = [
  { id: 'c-1', name: 'No Overlaps', target: 'Class', violationCondition: 'overlap' },
];

describe('RulesService.listMetrics()', () => {
  it('reads rules.json from main and returns the metrics array', async () => {
    const github = makeGitHub(JSON.stringify({ metrics: METRIC_RULES, constraints: [] }));
    const service = new RulesService(github);

    const result = await service.listMetrics();

    expect(github.readFileWithSha).toHaveBeenCalledWith('main', 'rules.json');
    expect(result).toEqual(METRIC_RULES);
  });

  it('returns [] when rules.json has no metrics key', async () => {
    const github = makeGitHub(JSON.stringify({ constraints: [] }));
    const service = new RulesService(github);

    await expect(service.listMetrics()).resolves.toEqual([]);
  });

  it('rejects with a clean ApiError when rules.json contains invalid JSON', async () => {
    const github = makeGitHub('{not valid json');
    const service = new RulesService(github);

    await expect(service.listMetrics()).rejects.toBeInstanceOf(ApiError);
    await expect(service.listMetrics()).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('rules.json'),
    });
  });
});

describe('RulesService.createMetric()', () => {
  const VALID_PARAMS = { name: 'Class Count', target: 'Class', condition: 'count', threshold: 5, weight: 2 };

  let github: IGitHubService;
  let service: RulesService;

  beforeEach(() => {
    github = makeGitHub(JSON.stringify({ metrics: METRIC_RULES, constraints: CONSTRAINTS }));
    service = new RulesService(github);
  });

  it.each([
    ['name', { ...VALID_PARAMS, name: '' }, 'name is required'],
    ['target', { ...VALID_PARAMS, target: '' }, 'target is required'],
    ['condition', { ...VALID_PARAMS, condition: '' }, 'condition is required'],
    ['threshold', { ...VALID_PARAMS, threshold: NaN }, 'threshold must be a finite number'],
    ['weight', { ...VALID_PARAMS, weight: NaN }, 'weight must be a positive finite number'],
    ['weight', { ...VALID_PARAMS, weight: 0 }, 'weight must be a positive finite number'],
    ['weight', { ...VALID_PARAMS, weight: -1 }, 'weight must be a positive finite number'],
  ])('throws 400 when %s is missing/invalid', async (_field, params, message) => {
    await expect(service.createMetric(params)).rejects.toMatchObject({ statusCode: 400, message });
    expect(github.writeFile).not.toHaveBeenCalled();
  });

  it('writes rules.json back to main with the new metric appended', async () => {
    await service.createMetric(VALID_PARAMS);

    expect(github.writeFile).toHaveBeenCalledOnce();
    const [branch, path, content] = (github.writeFile as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      string,
      string,
    ];
    expect(branch).toBe('main');
    expect(path).toBe('rules.json');

    const written = JSON.parse(content) as { metrics: unknown[]; constraints: unknown[] };
    expect(written.metrics).toHaveLength(METRIC_RULES.length + 1);
    expect(written.metrics[0]).toEqual(METRIC_RULES[0]);
    expect(written.constraints).toEqual(CONSTRAINTS);
  });

  it('passes the SHA read from rules.json through to writeFile as expectedSha', async () => {
    await service.createMetric(VALID_PARAMS);

    const call = (github.writeFile as ReturnType<typeof vi.fn>).mock.calls[0] as unknown[];
    expect(call[4]).toBe(DEFAULT_SHA);
  });

  it('returns the created MetricRule with a generated id', async () => {
    const result = await service.createMetric(VALID_PARAMS);

    expect(result).toMatchObject(VALID_PARAMS);
    expect(result.id).toMatch(/^metric-/);
  });

  it('includes the metric name in the commit message', async () => {
    await service.createMetric(VALID_PARAMS);

    const [, , , message] = (github.writeFile as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      string,
      string,
      string,
    ];
    expect(message).toContain(VALID_PARAMS.name);
  });

  it('propagates a clean ApiError.conflict when the write races another writer (stale SHA)', async () => {
    (github.writeFile as ReturnType<typeof vi.fn>).mockRejectedValue(
      ApiError.conflict('"rules.json" on branch "main" was modified concurrently; retry your change'),
    );

    await expect(service.createMetric(VALID_PARAMS)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('rejects with a clean ApiError when rules.json contains invalid JSON', async () => {
    const badGithub = makeGitHub('{not valid json');
    const badService = new RulesService(badGithub);

    await expect(badService.createMetric(VALID_PARAMS)).rejects.toMatchObject({ statusCode: 400 });
    expect(badGithub.writeFile).not.toHaveBeenCalled();
  });
});

describe('RulesService.deleteMetric()', () => {
  let github: IGitHubService;
  let service: RulesService;

  beforeEach(() => {
    github = makeGitHub(JSON.stringify({ metrics: METRIC_RULES, constraints: CONSTRAINTS }));
    service = new RulesService(github);
  });

  it('throws 404 when the metric id does not exist', async () => {
    await expect(service.deleteMetric('nope')).rejects.toMatchObject({ statusCode: 404 });
    expect(github.writeFile).not.toHaveBeenCalled();
  });

  it('writes rules.json back to main with the metric removed', async () => {
    await service.deleteMetric('mr-1');

    expect(github.writeFile).toHaveBeenCalledOnce();
    const [branch, path, content] = (github.writeFile as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      string,
      string,
    ];
    expect(branch).toBe('main');
    expect(path).toBe('rules.json');

    const written = JSON.parse(content) as { metrics: unknown[]; constraints: unknown[] };
    expect(written.metrics).toEqual([]);
    expect(written.constraints).toEqual(CONSTRAINTS);
  });

  it('passes the SHA read from rules.json through to writeFile as expectedSha', async () => {
    await service.deleteMetric('mr-1');

    const call = (github.writeFile as ReturnType<typeof vi.fn>).mock.calls[0] as unknown[];
    expect(call[4]).toBe(DEFAULT_SHA);
  });
});

describe('RulesService.listConstraints()', () => {
  it('reads rules.json from main and returns the constraints array', async () => {
    const github = makeGitHub(JSON.stringify({ metrics: [], constraints: CONSTRAINTS }));
    const service = new RulesService(github);

    const result = await service.listConstraints();

    expect(github.readFileWithSha).toHaveBeenCalledWith('main', 'rules.json');
    expect(result).toEqual(CONSTRAINTS);
  });

  it('returns [] when rules.json has no constraints key', async () => {
    const github = makeGitHub(JSON.stringify({ metrics: [] }));
    const service = new RulesService(github);

    await expect(service.listConstraints()).resolves.toEqual([]);
  });
});

describe('RulesService.createConstraint()', () => {
  const VALID_PARAMS = { name: 'No Overlaps', target: 'Class', violationCondition: 'overlap' };

  let github: IGitHubService;
  let service: RulesService;

  beforeEach(() => {
    github = makeGitHub(JSON.stringify({ metrics: METRIC_RULES, constraints: CONSTRAINTS }));
    service = new RulesService(github);
  });

  it.each([
    ['name', { ...VALID_PARAMS, name: '' }, 'name is required'],
    ['target', { ...VALID_PARAMS, target: '' }, 'target is required'],
    ['violationCondition', { ...VALID_PARAMS, violationCondition: '' }, 'violationCondition is required'],
  ])('throws 400 when %s is missing', async (_field, params, message) => {
    await expect(service.createConstraint(params)).rejects.toMatchObject({ statusCode: 400, message });
    expect(github.writeFile).not.toHaveBeenCalled();
  });

  it('writes rules.json back to main with the new constraint appended', async () => {
    await service.createConstraint(VALID_PARAMS);

    expect(github.writeFile).toHaveBeenCalledOnce();
    const [branch, path, content] = (github.writeFile as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      string,
      string,
    ];
    expect(branch).toBe('main');
    expect(path).toBe('rules.json');

    const written = JSON.parse(content) as { metrics: unknown[]; constraints: unknown[] };
    expect(written.constraints).toHaveLength(CONSTRAINTS.length + 1);
    expect(written.constraints[0]).toEqual(CONSTRAINTS[0]);
    expect(written.metrics).toEqual(METRIC_RULES);
  });

  it('returns the created Constraint with a generated id', async () => {
    const result = await service.createConstraint(VALID_PARAMS);

    expect(result).toMatchObject(VALID_PARAMS);
    expect(result.id).toMatch(/^constraint-/);
  });

  it('includes the constraint name in the commit message', async () => {
    await service.createConstraint(VALID_PARAMS);

    const [, , , message] = (github.writeFile as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      string,
      string,
      string,
    ];
    expect(message).toContain(VALID_PARAMS.name);
  });

  it('propagates a clean ApiError.conflict when the write races another writer (stale SHA)', async () => {
    (github.writeFile as ReturnType<typeof vi.fn>).mockRejectedValue(
      ApiError.conflict('"rules.json" on branch "main" was modified concurrently; retry your change'),
    );

    await expect(service.createConstraint(VALID_PARAMS)).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('RulesService.deleteConstraint()', () => {
  let github: IGitHubService;
  let service: RulesService;

  beforeEach(() => {
    github = makeGitHub(JSON.stringify({ metrics: METRIC_RULES, constraints: CONSTRAINTS }));
    service = new RulesService(github);
  });

  it('throws 404 when the constraint id does not exist', async () => {
    await expect(service.deleteConstraint('nope')).rejects.toMatchObject({ statusCode: 404 });
    expect(github.writeFile).not.toHaveBeenCalled();
  });

  it('writes rules.json back to main with the constraint removed', async () => {
    await service.deleteConstraint('c-1');

    expect(github.writeFile).toHaveBeenCalledOnce();
    const [branch, path, content] = (github.writeFile as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      string,
      string,
    ];
    expect(branch).toBe('main');
    expect(path).toBe('rules.json');

    const written = JSON.parse(content) as { metrics: unknown[]; constraints: unknown[] };
    expect(written.constraints).toEqual([]);
    expect(written.metrics).toEqual(METRIC_RULES);
  });
});
