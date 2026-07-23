import { randomUUID } from 'crypto';
import { ApiError } from '../types/ApiError.js';
import type { IGitHubService } from '../interfaces/IGitHubService.js';
import type { IRulesService } from '../interfaces/IRulesService.js';
import type {
  MetricRule,
  CreateMetricRuleParams,
  Constraint,
  CreateConstraintParams,
} from '../types/domain.js';
import type { RulesJson } from '../types/rulesJson.js';

const SOURCE_BRANCH = 'main';
const RULES_JSON_PATH = 'rules.json';

export class RulesService implements IRulesService {
  constructor(private readonly github: IGitHubService) {}

  async listMetrics(): Promise<readonly MetricRule[]> {
    const rules = await this.readRules();
    return rules.metrics;
  }

  async createMetric(params: CreateMetricRuleParams): Promise<MetricRule> {
    const rules = await this.readRules();
    const metric: MetricRule = { id: generateId('metric', params.name, rules.metrics), ...params };
    await this.writeRules(
      { ...rules, metrics: [...rules.metrics, metric] },
      `chore(rules): add metric rule '${params.name}'`,
    );
    return metric;
  }

  async deleteMetric(metricId: string): Promise<void> {
    const rules = await this.readRules();
    if (!rules.metrics.some((m) => m.id === metricId)) {
      throw ApiError.notFound(`Metric rule '${metricId}' not found`);
    }
    const metrics = rules.metrics.filter((m) => m.id !== metricId);
    await this.writeRules({ ...rules, metrics }, `chore(rules): delete metric rule '${metricId}'`);
  }

  async listConstraints(): Promise<readonly Constraint[]> {
    const rules = await this.readRules();
    return rules.constraints;
  }

  async createConstraint(params: CreateConstraintParams): Promise<Constraint> {
    const rules = await this.readRules();
    const constraint: Constraint = { id: generateId('constraint', params.name, rules.constraints), ...params };
    await this.writeRules(
      { ...rules, constraints: [...rules.constraints, constraint] },
      `chore(rules): add constraint '${params.name}'`,
    );
    return constraint;
  }

  async deleteConstraint(constraintId: string): Promise<void> {
    const rules = await this.readRules();
    if (!rules.constraints.some((c) => c.id === constraintId)) {
      throw ApiError.notFound(`Constraint '${constraintId}' not found`);
    }
    const constraints = rules.constraints.filter((c) => c.id !== constraintId);
    await this.writeRules({ ...rules, constraints }, `chore(rules): delete constraint '${constraintId}'`);
  }

  private async readRules(): Promise<RulesJson> {
    const raw = await this.github.readFile(SOURCE_BRANCH, RULES_JSON_PATH);
    return JSON.parse(raw) as RulesJson;
  }

  private async writeRules(rules: RulesJson, message: string): Promise<void> {
    await this.github.writeFile(SOURCE_BRANCH, RULES_JSON_PATH, JSON.stringify(rules, null, 2), message);
  }
}

function generateId(prefix: string, name: string, existing: readonly { readonly id: string }[]): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const base = `${prefix}-${slug}`;
  const existingIds = new Set(existing.map((e) => e.id));
  if (!existingIds.has(base)) return base;
  return `${base}-${randomUUID().slice(0, 8)}`;
}
