import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RulesService } from './RulesService.js';
import { ApiError } from '../types/ApiError.js';
import type { IGitHubService } from '../interfaces/IGitHubService.js';
import type { CreateMetricRuleParams } from '../types/domain.js';

const DEFAULT_SHA = 'sha-1';

const makeGitHub = (
  rulesJson = '{"metrics":[],"constraints":[]}',
  sha = DEFAULT_SHA,
): IGitHubService => ({
  createBranch: vi.fn().mockResolvedValue(undefined),
  deleteBranch: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(rulesJson),
  readFileWithSha: vi.fn().mockResolvedValue({ content: rulesJson, sha }),
  readBlobBySha: vi.fn().mockResolvedValue(rulesJson),
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
  { id: 'c-1', name: 'No Overlaps', target: 'Class', violationCondition: 'professor_overlap' },
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
    ['direction', { ...VALID_PARAMS, direction: 'sideways' } as unknown as CreateMetricRuleParams, 'direction must be "higher_is_better" or "lower_is_better"'],
    [
      'target/condition',
      { ...VALID_PARAMS, target: 'Room', condition: 'count' },
      "Unsupported metric rule: target='Room', condition='count'",
    ],
  ])('throws 400 when %s is missing/invalid', async (_field, params, message) => {
    await expect(service.createMetric(params)).rejects.toMatchObject({ statusCode: 400, message });
    expect(github.writeFile).not.toHaveBeenCalled();
  });

  it('persists a valid direction on the created MetricRule', async () => {
    const result = await service.createMetric({ ...VALID_PARAMS, direction: 'lower_is_better' });

    expect(result.direction).toBe('lower_is_better');
    const written = JSON.parse(
      (github.writeFile as ReturnType<typeof vi.fn>).mock.calls[0]![2] as string,
    ) as { metrics: Array<{ direction?: string }> };
    expect(written.metrics.at(-1)?.direction).toBe('lower_is_better');
  });

  it('omits direction entirely from the created MetricRule when not provided', async () => {
    const result = await service.createMetric(VALID_PARAMS);

    expect(result.direction).toBeUndefined();
    expect('direction' in result).toBe(false);
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

describe('RulesService.updateMetric()', () => {
  const VALID_PARAMS = { name: 'Class Count v2', target: 'Class', condition: 'count', threshold: 9, weight: 4 };

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
    ['weight', { ...VALID_PARAMS, weight: 0 }, 'weight must be a positive finite number'],
    ['direction', { ...VALID_PARAMS, direction: 'sideways' } as unknown as CreateMetricRuleParams, 'direction must be "higher_is_better" or "lower_is_better"'],
    [
      'target/condition',
      { ...VALID_PARAMS, target: 'Room', condition: 'count' },
      "Unsupported metric rule: target='Room', condition='count'",
    ],
  ])('throws 400 when %s is missing/invalid, same as createMetric', async (_field, params, message) => {
    await expect(service.updateMetric('mr-1', params)).rejects.toMatchObject({ statusCode: 400, message });
    expect(github.writeFile).not.toHaveBeenCalled();
  });

  it('throws 404 when the metric id does not exist', async () => {
    await expect(service.updateMetric('nope', VALID_PARAMS)).rejects.toMatchObject({ statusCode: 404 });
    expect(github.writeFile).not.toHaveBeenCalled();
  });

  it('updates the metric in place, keeping its id', async () => {
    const result = await service.updateMetric('mr-1', VALID_PARAMS);

    expect(result).toEqual({ id: 'mr-1', ...VALID_PARAMS });
    const [, , content] = (github.writeFile as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string, string];
    const written = JSON.parse(content) as { metrics: Array<{ id: string }> };
    expect(written.metrics).toHaveLength(METRIC_RULES.length);
    expect(written.metrics[0]).toEqual({ id: 'mr-1', ...VALID_PARAMS });
  });

  it('leaves other metrics and all constraints untouched', async () => {
    const github2 = makeGitHub(
      JSON.stringify({
        metrics: [...METRIC_RULES, { id: 'mr-2', name: 'Other', target: 'Room', condition: 'utilization', threshold: 1, weight: 1 }],
        constraints: CONSTRAINTS,
      }),
    );
    const service2 = new RulesService(github2);

    await service2.updateMetric('mr-1', VALID_PARAMS);

    const [, , content] = (github2.writeFile as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string, string];
    const written = JSON.parse(content) as { metrics: Array<{ id: string }>; constraints: unknown[] };
    expect(written.metrics.map((m) => m.id)).toEqual(['mr-1', 'mr-2']);
    expect(written.constraints).toEqual(CONSTRAINTS);
  });

  it('omits direction from the updated MetricRule when not provided', async () => {
    const result = await service.updateMetric('mr-1', VALID_PARAMS);

    expect('direction' in result).toBe(false);
  });

  it('passes the SHA read from rules.json through to writeFile as expectedSha', async () => {
    await service.updateMetric('mr-1', VALID_PARAMS);

    const call = (github.writeFile as ReturnType<typeof vi.fn>).mock.calls[0] as unknown[];
    expect(call[4]).toBe(DEFAULT_SHA);
  });

  it('propagates a clean ApiError.conflict when the write races another writer (stale SHA)', async () => {
    (github.writeFile as ReturnType<typeof vi.fn>).mockRejectedValue(
      ApiError.conflict('"rules.json" on branch "main" was modified concurrently; retry your change'),
    );

    await expect(service.updateMetric('mr-1', VALID_PARAMS)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('includes the metric name in the commit message', async () => {
    await service.updateMetric('mr-1', VALID_PARAMS);

    const [, , , message] = (github.writeFile as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      string,
      string,
      string,
    ];
    expect(message).toContain(VALID_PARAMS.name);
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
  const VALID_PARAMS = { name: 'No Overlaps', target: 'Class', violationCondition: 'professor_overlap' };

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

  it('throws 400 when violationCondition is not a recognized value', async () => {
    await expect(
      service.createConstraint({ ...VALID_PARAMS, violationCondition: 'nonsense' }),
    ).rejects.toMatchObject({ statusCode: 400, message: "Unknown violationCondition: 'nonsense'" });
    expect(github.writeFile).not.toHaveBeenCalled();
  });

  it.each([
    ['consecutive_limit', { name: 'Limit', target: 'Professor', violationCondition: 'consecutive_limit' }],
    ['consecutive_limit', { name: 'Limit', target: 'Professor', violationCondition: 'consecutive_limit', limit: 0 }],
    ['consecutive_limit', { name: 'Limit', target: 'Professor', violationCondition: 'consecutive_limit', limit: -1 }],
    ['consecutive_limit', { name: 'Limit', target: 'Professor', violationCondition: 'consecutive_limit', limit: 1.5 }],
    ['gap_limit', { name: 'Limit', target: 'Professor', violationCondition: 'gap_limit' }],
    ['gap_limit', { name: 'Limit', target: 'Professor', violationCondition: 'gap_limit', limit: 0 }],
    ['gap_limit', { name: 'Limit', target: 'Professor', violationCondition: 'gap_limit', limit: -2 }],
  ])('throws 400 when %s is created with a missing/non-positive limit', async (_condition, params) => {
    await expect(service.createConstraint(params)).rejects.toMatchObject({
      statusCode: 400,
      message: 'limit must be a positive integer',
    });
    expect(github.writeFile).not.toHaveBeenCalled();
  });

  it.each([
    ['professor_overlap', { name: 'Overlap', target: 'Professor', violationCondition: 'professor_overlap', limit: 3 }],
    ['room_double_book', { name: 'Room', target: 'Room', violationCondition: 'room_double_book', limit: 3 }],
    ['group_overlap', { name: 'Group', target: 'StudentGroup', violationCondition: 'group_overlap', limit: 3 }],
    [
      'room_capacity_exceeded',
      { name: 'Capacity', target: 'Room', violationCondition: 'room_capacity_exceeded', limit: 3 },
    ],
  ])('throws 400 when a limit is supplied for %s', async (_condition, params) => {
    await expect(service.createConstraint(params)).rejects.toMatchObject({
      statusCode: 400,
      message: `limit must not be provided for violationCondition "${params.violationCondition}"`,
    });
    expect(github.writeFile).not.toHaveBeenCalled();
  });

  it('persists the limit on a valid consecutive_limit constraint', async () => {
    const result = await service.createConstraint({
      name: 'No back-to-back overload',
      target: 'Professor',
      violationCondition: 'consecutive_limit',
      limit: 3,
    });

    expect(result.limit).toBe(3);
    const [, , content] = (github.writeFile as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string, string];
    const written = JSON.parse(content) as { constraints: Array<{ limit?: number }> };
    expect(written.constraints[written.constraints.length - 1]?.limit).toBe(3);
  });

  it('does not persist a limit field on a structural constraint', async () => {
    const result = await service.createConstraint(VALID_PARAMS);

    expect(result.limit).toBeUndefined();
    expect('limit' in result).toBe(false);
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

describe('RulesService.updateConstraint()', () => {
  let github: IGitHubService;
  let service: RulesService;

  beforeEach(() => {
    github = makeGitHub(JSON.stringify({ metrics: METRIC_RULES, constraints: CONSTRAINTS }));
    service = new RulesService(github);
  });

  it.each([
    ['name', { name: '', target: 'Class', violationCondition: 'professor_overlap' }, 'name is required'],
    ['target', { name: 'X', target: '', violationCondition: 'professor_overlap' }, 'target is required'],
    ['violationCondition', { name: 'X', target: 'Class', violationCondition: '' }, 'violationCondition is required'],
    [
      'violationCondition',
      { name: 'X', target: 'Class', violationCondition: 'nonsense' },
      "Unknown violationCondition: 'nonsense'",
    ],
    [
      'limit',
      { name: 'X', target: 'Professor', violationCondition: 'consecutive_limit' },
      'limit must be a positive integer',
    ],
    [
      'limit',
      { name: 'X', target: 'Class', violationCondition: 'professor_overlap', limit: 3 },
      'limit must not be provided for violationCondition "professor_overlap"',
    ],
  ])('throws 400 when %s is missing/invalid, same as createConstraint', async (_field, params, message) => {
    await expect(service.updateConstraint('c-1', params)).rejects.toMatchObject({ statusCode: 400, message });
    expect(github.writeFile).not.toHaveBeenCalled();
  });

  it('throws 404 when the constraint id does not exist', async () => {
    await expect(
      service.updateConstraint('nope', { name: 'X', target: 'Class', violationCondition: 'professor_overlap' }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(github.writeFile).not.toHaveBeenCalled();
  });

  it('updates the constraint in place, keeping its id', async () => {
    const result = await service.updateConstraint('c-1', {
      name: 'Renamed',
      target: 'Room',
      violationCondition: 'room_double_book',
    });

    expect(result).toEqual({ id: 'c-1', name: 'Renamed', target: 'Room', violationCondition: 'room_double_book' });
  });

  it('adds a limit when switching from an unlimited to a limited violationCondition', async () => {
    const result = await service.updateConstraint('c-1', {
      name: 'No overload',
      target: 'Professor',
      violationCondition: 'consecutive_limit',
      limit: 4,
    });

    expect(result.limit).toBe(4);
  });

  it('drops the limit when switching from a limited to an unlimited violationCondition', async () => {
    const limitedGithub = makeGitHub(
      JSON.stringify({
        metrics: METRIC_RULES,
        constraints: [{ id: 'c-1', name: 'No overload', target: 'Professor', violationCondition: 'consecutive_limit', limit: 3 }],
      }),
    );
    const limitedService = new RulesService(limitedGithub);

    const result = await limitedService.updateConstraint('c-1', {
      name: 'No overlap',
      target: 'Professor',
      violationCondition: 'professor_overlap',
    });

    expect(result.limit).toBeUndefined();
    expect('limit' in result).toBe(false);
  });

  it('passes the SHA read from rules.json through to writeFile as expectedSha', async () => {
    await service.updateConstraint('c-1', { name: 'X', target: 'Class', violationCondition: 'professor_overlap' });

    const call = (github.writeFile as ReturnType<typeof vi.fn>).mock.calls[0] as unknown[];
    expect(call[4]).toBe(DEFAULT_SHA);
  });

  it('propagates a clean ApiError.conflict when the write races another writer (stale SHA)', async () => {
    (github.writeFile as ReturnType<typeof vi.fn>).mockRejectedValue(
      ApiError.conflict('"rules.json" on branch "main" was modified concurrently; retry your change'),
    );

    await expect(
      service.updateConstraint('c-1', { name: 'X', target: 'Class', violationCondition: 'professor_overlap' }),
    ).rejects.toMatchObject({ statusCode: 409 });
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

// Read-time schema validation: a malformed rules.json entry (bad
// target/condition pair, an unknown violationCondition, a limit on a
// condition that doesn't take one) should be caught here, at read, with a
// clear error — not silently returned to a caller who then only discovers
// the problem later, indirectly, when translateRule()/translateConstraint()
// throws mid-evaluation.
describe('RulesService — read-time rules.json schema validation', () => {
  it('rejects a metric entry with an unsupported target/condition pair', async () => {
    const badMetrics = [
      { id: 'mr-bad', name: 'Bogus', target: 'Bogus', condition: 'metric', threshold: 0, weight: 1 },
    ];
    const github = makeGitHub(JSON.stringify({ metrics: badMetrics, constraints: [] }));
    const service = new RulesService(github);

    await expect(service.listMetrics()).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('rules.json metrics[0] (id=mr-bad)'),
    });
  });

  it('rejects a metric entry with an invalid direction', async () => {
    const badMetrics = [
      { id: 'mr-bad', name: 'Bogus', target: 'Class', condition: 'count', threshold: 0, weight: 1, direction: 'sideways' },
    ];
    const github = makeGitHub(JSON.stringify({ metrics: badMetrics, constraints: [] }));
    const service = new RulesService(github);

    await expect(service.listMetrics()).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('direction must be "higher_is_better" or "lower_is_better"'),
    });
  });

  it('rejects a constraint entry with an unknown violationCondition', async () => {
    const badConstraints = [{ id: 'c-bad', name: 'Bogus', target: 'Class', violationCondition: 'not_real' }];
    const github = makeGitHub(JSON.stringify({ metrics: [], constraints: badConstraints }));
    const service = new RulesService(github);

    await expect(service.listConstraints()).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('rules.json constraints[0] (id=c-bad)'),
    });
  });

  it('rejects a constraint entry with a limit on a violationCondition that does not take one', async () => {
    const badConstraints = [
      { id: 'c-bad', name: 'Bogus', target: 'Professor', violationCondition: 'professor_overlap', limit: 3 },
    ];
    const github = makeGitHub(JSON.stringify({ metrics: [], constraints: badConstraints }));
    const service = new RulesService(github);

    await expect(service.listConstraints()).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('limit must not be provided'),
    });
  });

  it('rejects a policy constraint entry missing its required limit', async () => {
    const badConstraints = [
      { id: 'c-bad', name: 'Bogus', target: 'Professor', violationCondition: 'gap_limit' },
    ];
    const github = makeGitHub(JSON.stringify({ metrics: [], constraints: badConstraints }));
    const service = new RulesService(github);

    await expect(service.listConstraints()).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('limit must be a positive integer'),
    });
  });

  it('does not reach translateRule/translateConstraint — the error surfaces before any evaluation is attempted', async () => {
    // A malformed entry rejected here never gets far enough to hit the
    // evaluation-time 400 from translateRule()/translateConstraint() — this
    // is a read-time rejection, distinguishable by its "rules.json ..."
    // message prefix (translateRule's own message never mentions rules.json).
    const badMetrics = [{ id: 'mr-bad', name: 'Bogus', target: 'Bogus', condition: 'metric', threshold: 0, weight: 1 }];
    const github = makeGitHub(JSON.stringify({ metrics: badMetrics, constraints: [] }));
    const service = new RulesService(github);

    await expect(service.listMetrics()).rejects.toMatchObject({
      message: expect.stringMatching(/^rules\.json /),
    });
  });

  it('leaves an all-valid rules.json completely unaffected', async () => {
    const github = makeGitHub(JSON.stringify({ metrics: METRIC_RULES, constraints: CONSTRAINTS }));
    const service = new RulesService(github);

    await expect(service.listMetrics()).resolves.toEqual(METRIC_RULES);
    await expect(service.listConstraints()).resolves.toEqual(CONSTRAINTS);
  });
});
