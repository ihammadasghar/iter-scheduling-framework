import type { Request, Response, NextFunction } from 'express';
import type { IRulesService } from '../interfaces/IRulesService.js';

export class RulesController {
  constructor(private readonly service: IRulesService) {}

  async listMetrics(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const metrics = await this.service.listMetrics();
      res.status(200).json(metrics);
    } catch (err) {
      next(err);
    }
  }

  async createMetric(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const metric = await this.service.createMetric(req.body);
      res.status(201).json(metric);
    } catch (err) {
      next(err);
    }
  }

  async deleteMetric(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.service.deleteMetric(req.params['metricId'] as string);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }

  async listConstraints(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const constraints = await this.service.listConstraints();
      res.status(200).json(constraints);
    } catch (err) {
      next(err);
    }
  }

  async createConstraint(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const constraint = await this.service.createConstraint(req.body);
      res.status(201).json(constraint);
    } catch (err) {
      next(err);
    }
  }

  async deleteConstraint(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.service.deleteConstraint(req.params['constraintId'] as string);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
}
