import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RulesService } from './RulesService.js';
import type { IGitHubService } from '../interfaces/IGitHubService.js';
import type { CreateMetricRuleParams, CreateConstraintParams } from '../types/domain.js';

const EMPTY_RULES = JSON.stringify({ metrics: [], constraints: [] });

function makeGitHub(initialRulesJson: string = EMPTY_RULES): IGitHubService {
  let stored = initialRulesJson;
  return {
    createBranch: vi.fn().mockResolvedValue(undefined),
    deleteBranch: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockImplementation(async () => stored),
    writeFile: vi.fn().mockImplementation(async (_branch: string, _path: string, content: string) => {
      stored = content;
    }),
    createPullRequest: vi.fn().mockResolvedValue('1'),
    mergePullRequest: vi.fn().mockResolvedValue(undefined),
    closePullRequest: vi.fn().mockResolvedValue(undefined),
    getPullRequestDiff: vi.fn().mockResolvedValue(''),
    listOpenPullRequests: vi.fn().mockResolvedValue([]),
    addPullRequestComment: vi.fn().mockResolvedValue(undefined),
    getPullRequest: vi.fn().mockResolvedValue({ title: '', head: '', labels: [], createdAt: '' }),
    setPullRequestLabels: vi.fn().mockResolvedValue(undefined),
  };
}

describe('RulesService', () => {
  let github: IGitHubService;
  let service: RulesService;

  beforeEach(() => {
    github = makeGitHub();
    service = new RulesService(github);
  });

  describe('metrics', () => {
    it('listMetrics returns an empty array when rules.json has none', async () => {
      expect(await service.listMetrics()).toEqual([]);
    });

    it('createMetric appends a new metric rule and persists it via writeFile', async () => {
      const metric = await service.createMetric({
        name: 'Room Utilization', target: 'Room', condition: 'utilization', threshold: 80,
      });

      expect(metric).toMatchObject({
        name: 'Room Utilization', target: 'Room', condition: 'utilization', threshold: 80,
      });
      expect(metric.id).toBe('metric-room-utilization');
      expect(github.writeFile).toHaveBeenCalledWith(
        'main', 'rules.json', expect.stringContaining('Room Utilization'), expect.any(String),
      );

      expect(await service.listMetrics()).toEqual([metric]);
    });

    it('createMetric ignores an attacker-supplied id in the request body', async () => {
      const maliciousParams = {
        name: 'Room Utilization', target: 'Room', condition: 'utilization', threshold: 80,
        id: 'admin', extra: 'should-not-persist',
      } as unknown as CreateMetricRuleParams;

      const metric = await service.createMetric(maliciousParams);

      expect(metric.id).toBe('metric-room-utilization');
      expect(metric).not.toHaveProperty('extra');
      expect(github.writeFile).toHaveBeenCalledWith(
        'main', 'rules.json', expect.not.stringContaining('should-not-persist'), expect.any(String),
      );
    });

    it('createMetric generates a unique id when the slug already exists', async () => {
      github = makeGitHub(JSON.stringify({
        metrics: [{ id: 'metric-room-utilization', name: 'Room Utilization', target: 'Room', condition: 'utilization', threshold: 80 }],
        constraints: [],
      }));
      service = new RulesService(github);

      const metric = await service.createMetric({
        name: 'Room Utilization', target: 'Room', condition: 'utilization', threshold: 90,
      });

      expect(metric.id).not.toBe('metric-room-utilization');
      expect(metric.id.startsWith('metric-room-utilization-')).toBe(true);
    });

    it('deleteMetric removes the matching rule', async () => {
      github = makeGitHub(JSON.stringify({
        metrics: [{ id: 'metric-x', name: 'X', target: 'Room', condition: 'utilization', threshold: 1 }],
        constraints: [],
      }));
      service = new RulesService(github);

      await service.deleteMetric('metric-x');

      expect(await service.listMetrics()).toEqual([]);
    });

    it('deleteMetric throws notFound for an unknown id', async () => {
      await expect(service.deleteMetric('does-not-exist')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  describe('constraints', () => {
    it('listConstraints returns an empty array when rules.json has none', async () => {
      expect(await service.listConstraints()).toEqual([]);
    });

    it('createConstraint appends a new constraint and persists it via writeFile', async () => {
      const constraint = await service.createConstraint({
        name: 'No Double Booking', target: 'Room', violationCondition: 'double_booking',
      });

      expect(constraint).toMatchObject({
        name: 'No Double Booking', target: 'Room', violationCondition: 'double_booking',
      });
      expect(constraint.id).toBe('constraint-no-double-booking');

      expect(await service.listConstraints()).toEqual([constraint]);
    });

    it('createConstraint ignores an attacker-supplied id in the request body', async () => {
      const maliciousParams = {
        name: 'No Double Booking', target: 'Room', violationCondition: 'double_booking',
        id: 'admin', extra: 'should-not-persist',
      } as unknown as CreateConstraintParams;

      const constraint = await service.createConstraint(maliciousParams);

      expect(constraint.id).toBe('constraint-no-double-booking');
      expect(constraint).not.toHaveProperty('extra');
      expect(github.writeFile).toHaveBeenCalledWith(
        'main', 'rules.json', expect.not.stringContaining('should-not-persist'), expect.any(String),
      );
    });

    it('deleteConstraint removes the matching constraint', async () => {
      github = makeGitHub(JSON.stringify({
        metrics: [],
        constraints: [{ id: 'constraint-x', name: 'X', target: 'Room', violationCondition: 'y' }],
      }));
      service = new RulesService(github);

      await service.deleteConstraint('constraint-x');

      expect(await service.listConstraints()).toEqual([]);
    });

    it('deleteConstraint throws notFound for an unknown id', async () => {
      await expect(service.deleteConstraint('does-not-exist')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });
});
