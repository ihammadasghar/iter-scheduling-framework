import type { Request, Response, NextFunction } from 'express';
import type { IProposalService } from '../interfaces/IProposalService.js';

export class ProposalController {
  constructor(private readonly service: IProposalService) {}

  async submit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const proposal = await this.service.submit(req.body);
      res.status(201).json(proposal);
    } catch (err) {
      next(err);
    }
  }

  async list(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const proposals = await this.service.list();
      res.status(200).json(proposals);
    } catch (err) {
      next(err);
    }
  }

  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const proposal = await this.service.get(req.params['id'] as string);
      res.status(200).json(proposal);
    } catch (err) {
      next(err);
    }
  }

  async merge(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const proposal = await this.service.merge(req.params['id'] as string);
      res.status(200).json(proposal);
    } catch (err) {
      next(err);
    }
  }
}
