import type { Request, Response, NextFunction } from 'express';
import type { ISimulationService } from '../interfaces/ISimulationService.js';

export class SimulationController {
  constructor(private readonly service: ISimulationService) {}

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const simulation = await this.service.create(req.body);
      res.status(201).json(simulation);
    } catch (err) {
      next(err);
    }
  }

  async heartbeat(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.service.heartbeat(req.params['id'] as string);
      res.status(200).json({ ok: true });
    } catch (err) {
      next(err);
    }
  }

  async commit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.service.commit(req.params['id'] as string);
      res.status(200).json({ ok: true });
    } catch (err) {
      next(err);
    }
  }

  async listClasses(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.service.listClasses({
        simulationId: req.params['id'] as string,
        page: parseInt(req.query['page'] as string ?? '1', 10),
        limit: parseInt(req.query['limit'] as string ?? '20', 10),
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async updateClass(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const updated = await this.service.updateClass(
        req.params['id'] as string,
        req.params['classId'] as string,
        req.body,
      );
      res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  }

  async getSuggestions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const suggestions = await this.service.getSuggestions(
        req.params['id'] as string,
        req.params['classId'] as string,
      );
      res.status(200).json(suggestions);
    } catch (err) {
      next(err);
    }
  }

  async getConflicts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const conflicts = await this.service.getConflicts(req.params['id'] as string);
      res.status(200).json(conflicts);
    } catch (err) {
      next(err);
    }
  }

  async getMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const metrics = await this.service.getMetrics(req.params['id'] as string);
      res.status(200).json(metrics);
    } catch (err) {
      next(err);
    }
  }
}
