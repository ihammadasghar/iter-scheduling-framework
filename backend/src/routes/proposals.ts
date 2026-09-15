import { Router } from 'express';
import type { IRouter } from 'express';
import type { ProposalController } from '../controllers/ProposalController.js';

export function createProposalsRouter(controller: ProposalController): IRouter {
  const router: IRouter = Router();

  // POST /proposals — submit a simulation as a proposal (triggers CI pipeline)
  router.post('/', (req, res, next) => controller.submit(req, res, next));

  // POST /proposals/seed — facilitator/demo-only: create a proposal that
  // skips the "must not make the published schedule worse" gate, so a
  // genuinely BLOCKED proposal can exist to review (see
  // ProposalService.submitUnchecked for why the normal submit path can
  // never produce one). Only registered when GITHUB_PROVIDER=mock — never
  // reachable against a real repo.
  if (process.env['GITHUB_PROVIDER'] === 'mock') {
    router.post('/seed', (req, res, next) => controller.seed(req, res, next));
  }

  // GET /proposals — list proposals (Admins view READY PRs)
  router.get('/', (req, res, next) => controller.list(req, res, next));

  // GET /proposals/:id — view PR diffs and metric impacts
  router.get('/:id', (req, res, next) => controller.get(req, res, next));

  // POST /proposals/:id/merge — approve and merge PR into main
  router.post('/:id/merge', (req, res, next) => controller.merge(req, res, next));

  // POST /proposals/:id/reject — soft-reject: close the PR, keep the simulation branch
  router.post('/:id/reject', (req, res, next) => controller.reject(req, res, next));

  return router;
}

