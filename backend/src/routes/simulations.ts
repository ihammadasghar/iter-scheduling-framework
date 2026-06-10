import { Router } from 'express';
import type { IRouter } from 'express';
import type { SimulationController } from '../controllers/SimulationController.js';

export function createSimulationsRouter(controller: SimulationController): IRouter {
  const router: IRouter = Router();

  // POST /simulations — create a simulation branch
  router.post('/', (req, res, next) => controller.create(req, res, next));

  // POST /simulations/:id/heartbeat — keep graph session alive
  router.post('/:id/heartbeat', (req, res, next) => controller.heartbeat(req, res, next));

  // POST /simulations/:id/commit — flush graph → save JSON to Git branch
  router.post('/:id/commit', (req, res, next) => controller.commit(req, res, next));

  // GET /simulations/:id/classes — paginated class list
  router.get('/:id/classes', (req, res, next) => controller.listClasses(req, res, next));

  // PATCH /simulations/:id/classes/:classId — micro-edit a class assignment
  router.patch('/:id/classes/:classId', (req, res, next) => controller.updateClass(req, res, next));

  // GET /simulations/:id/classes/:classId/suggestions — pathfind valid conflict-free slots
  router.get('/:id/classes/:classId/suggestions', (req, res, next) =>
    controller.getSuggestions(req, res, next),
  );

  // GET /simulations/:id/conflicts — run hard constraint checks
  router.get('/:id/conflicts', (req, res, next) => controller.getConflicts(req, res, next));

  // GET /simulations/:id/metrics — evaluate active metric rules
  router.get('/:id/metrics', (req, res, next) => controller.getMetrics(req, res, next));

  return router;
}

