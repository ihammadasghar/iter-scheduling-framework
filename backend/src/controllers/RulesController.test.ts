import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { RulesController } from './RulesController.js';
import type { IRulesService } from '../interfaces/IRulesService.js';
import type { MetricRule, Constraint } from '../types/domain.js';

const makeRulesService = (): IRulesService => ({
  listMetrics: vi.fn().mockResolvedValue([]),
  createMetric: vi.fn(),
  deleteMetric: vi.fn().mockResolvedValue(undefined),
  listConstraints: vi.fn().mockResolvedValue([]),
  createConstraint: vi.fn(),
  deleteConstraint: vi.fn().mockResolvedValue(undefined),
});

const makeRes = (): Response => {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res;
};

const FAKE_METRIC: MetricRule = {
  id: 'metric-1',
  name: 'Class Count',
  target: 'Class',
  condition: 'count',
  threshold: 5,
  weight: 1,
};

const FAKE_CONSTRAINT: Constraint = {
  id: 'constraint-1',
  name: 'No Overlaps',
  target: 'Class',
  violationCondition: 'overlap',
};

describe('RulesController', () => {
  let service: IRulesService;
  let controller: RulesController;
  let res: Response;
  let next: NextFunction;

  beforeEach(() => {
    service = makeRulesService();
    controller = new RulesController(service);
    res = makeRes();
    next = vi.fn();
  });

  describe('listMetrics()', () => {
    it('returns 200 with the metrics from the service', async () => {
      (service.listMetrics as ReturnType<typeof vi.fn>).mockResolvedValue([FAKE_METRIC]);

      await controller.listMetrics({} as Request, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([FAKE_METRIC]);
      expect(next).not.toHaveBeenCalled();
    });

    it('calls next(err) when the service throws', async () => {
      const err = new Error('boom');
      (service.listMetrics as ReturnType<typeof vi.fn>).mockRejectedValue(err);

      await controller.listMetrics({} as Request, res, next);

      expect(next).toHaveBeenCalledWith(err);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('createMetric()', () => {
    it('creates via the service with req.body and returns 201', async () => {
      (service.createMetric as ReturnType<typeof vi.fn>).mockResolvedValue(FAKE_METRIC);
      const req = { body: { name: 'Class Count', target: 'Class', condition: 'count', threshold: 5, weight: 1 } } as Request;

      await controller.createMetric(req, res, next);

      expect(service.createMetric).toHaveBeenCalledWith(req.body);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(FAKE_METRIC);
    });

    it('calls next(err) when the service throws', async () => {
      const err = new Error('bad request');
      (service.createMetric as ReturnType<typeof vi.fn>).mockRejectedValue(err);

      await controller.createMetric({ body: {} } as Request, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe('deleteMetric()', () => {
    it('deletes via the service with the metricId param and returns 204', async () => {
      const req = { params: { metricId: 'metric-1' } } as unknown as Request;

      await controller.deleteMetric(req, res, next);

      expect(service.deleteMetric).toHaveBeenCalledWith('metric-1');
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('calls next(err) when the service throws', async () => {
      const err = new Error('not found');
      (service.deleteMetric as ReturnType<typeof vi.fn>).mockRejectedValue(err);

      await controller.deleteMetric({ params: { metricId: 'nope' } } as unknown as Request, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe('listConstraints()', () => {
    it('returns 200 with the constraints from the service', async () => {
      (service.listConstraints as ReturnType<typeof vi.fn>).mockResolvedValue([FAKE_CONSTRAINT]);

      await controller.listConstraints({} as Request, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith([FAKE_CONSTRAINT]);
    });

    it('calls next(err) when the service throws', async () => {
      const err = new Error('boom');
      (service.listConstraints as ReturnType<typeof vi.fn>).mockRejectedValue(err);

      await controller.listConstraints({} as Request, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe('createConstraint()', () => {
    it('creates via the service with req.body and returns 201', async () => {
      (service.createConstraint as ReturnType<typeof vi.fn>).mockResolvedValue(FAKE_CONSTRAINT);
      const req = { body: { name: 'No Overlaps', target: 'Class', violationCondition: 'overlap' } } as Request;

      await controller.createConstraint(req, res, next);

      expect(service.createConstraint).toHaveBeenCalledWith(req.body);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(FAKE_CONSTRAINT);
    });

    it('calls next(err) when the service throws', async () => {
      const err = new Error('bad request');
      (service.createConstraint as ReturnType<typeof vi.fn>).mockRejectedValue(err);

      await controller.createConstraint({ body: {} } as Request, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  describe('deleteConstraint()', () => {
    it('deletes via the service with the constraintId param and returns 204', async () => {
      const req = { params: { constraintId: 'constraint-1' } } as unknown as Request;

      await controller.deleteConstraint(req, res, next);

      expect(service.deleteConstraint).toHaveBeenCalledWith('constraint-1');
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('calls next(err) when the service throws', async () => {
      const err = new Error('not found');
      (service.deleteConstraint as ReturnType<typeof vi.fn>).mockRejectedValue(err);

      await controller.deleteConstraint({ params: { constraintId: 'nope' } } as unknown as Request, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });
});
