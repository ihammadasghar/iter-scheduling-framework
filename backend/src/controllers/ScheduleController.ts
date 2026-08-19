import type { Request, Response, NextFunction } from 'express';
import type { IScheduleService } from '../interfaces/IScheduleService.js';

export class ScheduleController {
  constructor(private readonly service: IScheduleService) {}

  async listClasses(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.service.listClasses(
        parseInt(req.query['page'] as string ?? '1', 10),
        parseInt(req.query['limit'] as string ?? '20', 10),
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}
