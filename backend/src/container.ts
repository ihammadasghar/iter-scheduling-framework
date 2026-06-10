import { Octokit } from '@octokit/rest';
import { GitHubService } from './services/GitHubService.js';
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
  const octokit = new Octokit({ auth: process.env['GITHUB_TOKEN'] });
  const githubService = new GitHubService(
    octokit,
    process.env['GITHUB_OWNER'] ?? '',
    process.env['GITHUB_REPO'] ?? '',
  );

  // IGraphService will be injected here once the Memgraph client is implemented.
  const simulationService = new SimulationService(githubService);
  const proposalService = new ProposalService(githubService);
  const rulesService = new RulesService(githubService);

  return {
    simulationController: new SimulationController(simulationService),
    proposalController: new ProposalController(proposalService),
    rulesController: new RulesController(rulesService),
  };
}

