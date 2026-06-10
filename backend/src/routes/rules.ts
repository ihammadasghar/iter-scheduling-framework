import { Router } from 'express';
import type { IRouter } from 'express';
import type { RulesController } from '../controllers/RulesController.js';

export function createRulesRouter(controller: RulesController): IRouter {
  const router: IRouter = Router();

  // GET /rules/metrics — list Admin-defined metric rules
  router.get('/metrics', (req, res, next) => controller.listMetrics(req, res, next));

  // POST /rules/metrics — create a new metric rule
  router.post('/metrics', (req, res, next) => controller.createMetric(req, res, next));

  // DELETE /rules/metrics/:metricId — remove a metric rule
  router.delete('/metrics/:metricId', (req, res, next) => controller.deleteMetric(req, res, next));

  // GET /rules/constraints — list Admin-defined hard constraints
  router.get('/constraints', (req, res, next) => controller.listConstraints(req, res, next));

  // POST /rules/constraints — create a new hard constraint
  router.post('/constraints', (req, res, next) => controller.createConstraint(req, res, next));

  // DELETE /rules/constraints/:constraintId — remove a hard constraint
  router.delete('/constraints/:constraintId', (req, res, next) =>
    controller.deleteConstraint(req, res, next),
  );

  return router;
}

