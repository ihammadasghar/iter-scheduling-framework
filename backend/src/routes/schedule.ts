import { Router } from 'express';
import type { IRouter } from 'express';
import type { ScheduleController } from '../controllers/ScheduleController.js';

export function createScheduleRouter(controller: ScheduleController): IRouter {
  const router: IRouter = Router();

  // GET /schedule/classes — paginated read of the currently published (main) schedule
  router.get('/classes', (req, res, next) => controller.listClasses(req, res, next));

  return router;
}
