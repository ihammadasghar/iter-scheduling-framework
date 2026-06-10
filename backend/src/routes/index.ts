import { Router } from 'express';
import type { IRouter } from 'express';
import type { SimulationController } from '../controllers/SimulationController.js';
import type { ProposalController } from '../controllers/ProposalController.js';
import type { RulesController } from '../controllers/RulesController.js';
import { createSimulationsRouter } from './simulations.js';
import { createProposalsRouter } from './proposals.js';
import { createRulesRouter } from './rules.js';

export interface RouterControllers {
  readonly simulationController: SimulationController;
  readonly proposalController: ProposalController;
  readonly rulesController: RulesController;
}

export function createApiRouter(controllers: RouterControllers): IRouter {
  const router: IRouter = Router();

  router.use('/simulations', createSimulationsRouter(controllers.simulationController));
  router.use('/proposals', createProposalsRouter(controllers.proposalController));
  router.use('/rules', createRulesRouter(controllers.rulesController));

  return router;
}

