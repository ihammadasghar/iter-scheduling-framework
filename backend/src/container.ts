import neo4j from 'neo4j-driver';
import { Octokit } from '@octokit/rest';
import { MemgraphClient } from './clients/MemgraphClient.js';
import { GitHubService } from './services/GitHubService.js';
import { LocalGitHubService } from './services/LocalGitHubService.js';
import { GraphService } from './services/GraphService.js';
import { SimulationService } from './services/SimulationService.js';
import { ProposalService } from './services/ProposalService.js';
import { CiPipelineService } from './services/CiPipelineService.js';
import { RulesService } from './services/RulesService.js';
import { SessionRegistry } from './sessions/SessionRegistry.js';
import { SessionGarbageCollector } from './sessions/SessionGarbageCollector.js';
import { SimulationController } from './controllers/SimulationController.js';
import { ProposalController } from './controllers/ProposalController.js';
import { RulesController } from './controllers/RulesController.js';
import type { IGitHubService } from './interfaces/IGitHubService.js';

const DEFAULT_SESSION_TTL_MS = 300_000;  // 5 minutes
const DEFAULT_GC_INTERVAL_MS = 60_000;   // 1 minute

export interface Container {
  readonly simulationController: SimulationController;
  readonly proposalController: ProposalController;
  readonly rulesController: RulesController;
  shutdown(): Promise<void>;
}

export function buildContainer(): Container {
  // GitHub client — real Octokit-backed service, or an in-memory fake for
  // local development / tests. Set GITHUB_PROVIDER=mock (see .env.example)
  // to skip needing a GitHub PAT and schedule repo entirely.
  const githubService: IGitHubService =
    process.env['GITHUB_PROVIDER'] === 'mock'
      ? new LocalGitHubService()
      : new GitHubService(
          new Octokit({ auth: process.env['GITHUB_TOKEN'] }),
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

  // Session registry + GC sweeper
  const sessionRegistry = new SessionRegistry();
  const ttlMs = parseInt(process.env['SESSION_TTL_MS'] ?? String(DEFAULT_SESSION_TTL_MS), 10);
  const intervalMs = parseInt(process.env['GC_INTERVAL_MS'] ?? String(DEFAULT_GC_INTERVAL_MS), 10);
  const gc = new SessionGarbageCollector(sessionRegistry, graphService, ttlMs, intervalMs);
  gc.start();

  // Domain services
  const simulationService = new SimulationService(githubService, graphService, sessionRegistry);
  const ciPipelineService = new CiPipelineService(githubService, graphService);
  const proposalService = new ProposalService(githubService, graphService, ciPipelineService);
  const rulesService = new RulesService(githubService);

  return {
    simulationController: new SimulationController(simulationService),
    proposalController: new ProposalController(proposalService),
    rulesController: new RulesController(rulesService),
    async shutdown(): Promise<void> {
      gc.stop();
      await driver.close();
    },
  };
}
