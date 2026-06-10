import neo4j from 'neo4j-driver';
import { Octokit } from '@octokit/rest';
import { MemgraphClient } from './clients/MemgraphClient.js';
import { GitHubService } from './services/GitHubService.js';
import { GraphService } from './services/GraphService.js';
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
  // GitHub client
  const octokit = new Octokit({ auth: process.env['GITHUB_TOKEN'] });
  const githubService = new GitHubService(
    octokit,
    process.env['GITHUB_OWNER'] ?? '',
    process.env['GITHUB_REPO'] ?? '',
  );

  // Memgraph client
  const driver = neo4j.driver(
    process.env['MEMGRAPH_URI'] ?? 'bolt://localhost:7687',
    neo4j.auth.basic(
      process.env['MEMGRAPH_USERNAME'] ?? '',
      process.env['MEMGRAPH_PASSWORD'] ?? '',
    ),
  );
  const graphClient = new MemgraphClient(driver);
  const graphService = new GraphService(graphClient);

  // Domain services
  const simulationService = new SimulationService(githubService, graphService);
  const proposalService = new ProposalService(githubService, graphService);
  const rulesService = new RulesService(githubService);

  return {
    simulationController: new SimulationController(simulationService),
    proposalController: new ProposalController(proposalService),
    rulesController: new RulesController(rulesService),
  };
}


