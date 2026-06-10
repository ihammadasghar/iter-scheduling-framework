import { SimulationService } from './services/SimulationService.js';
import { ProposalService } from './services/ProposalService.js';
import { RulesService } from './services/RulesService.js';
import { SimulationController } from './controllers/SimulationController.js';
import { ProposalController } from './controllers/ProposalController.js';
import { RulesController } from './controllers/RulesController.js';

export interface Container {
  readonly simulationController: SimulationController;
  readonly proposalController: ProposalController;
  readonly rulesController: RulesController;
}

export function buildContainer(): Container {
  // Services — external client dependencies (IGitHubService, IGraphService)
  // will be injected here once their concrete implementations are built.
  const simulationService = new SimulationService();
  const proposalService = new ProposalService();
  const rulesService = new RulesService();

  return {
    simulationController: new SimulationController(simulationService),
    proposalController: new ProposalController(proposalService),
    rulesController: new RulesController(rulesService),
  };
}
