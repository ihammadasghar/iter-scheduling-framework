import { Router } from 'express';
import type { IRouter } from 'express';
import type { ProposalController } from '../controllers/ProposalController.js';

export function createProposalsRouter(controller: ProposalController): IRouter {
  const router: IRouter = Router();

  // POST /proposals — submit a simulation as a proposal (triggers CI pipeline)
  router.post('/', (req, res, next) => controller.submit(req, res, next));

  // GET /proposals — list proposals (Admins view READY PRs)
  router.get('/', (req, res, next) => controller.list(req, res, next));

  // GET /proposals/:id — view PR diffs and metric impacts
  router.get('/:id', (req, res, next) => controller.get(req, res, next));

  // POST /proposals/:id/merge — approve and merge PR into main
  router.post('/:id/merge', (req, res, next) => controller.merge(req, res, next));

  return router;
}

