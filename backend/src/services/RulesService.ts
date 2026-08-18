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
import { parseRulesJson, type RulesJson } from '../types/rulesJson.js';

const SOURCE_BRANCH = 'main';
const RULES_JSON_PATH = 'rules.json';

export class RulesService implements IRulesService {
  constructor(private readonly github: IGitHubService) {}

  async listMetrics(): Promise<readonly MetricRule[]> {
    const { rules } = await this.readRules();
    return rules.metrics;
  }

  async createMetric(params: CreateMetricRuleParams): Promise<MetricRule> {
    const { name, target, condition, threshold, weight } = params;
    if (!name || name.trim() === '') throw ApiError.badRequest('name is required');
    if (!target || target.trim() === '') throw ApiError.badRequest('target is required');
    if (!condition || condition.trim() === '') throw ApiError.badRequest('condition is required');
    if (!Number.isFinite(threshold)) throw ApiError.badRequest('threshold must be a finite number');
    if (!Number.isFinite(weight) || weight <= 0) {
      throw ApiError.badRequest('weight must be a positive finite number');
    }

    const { rules, sha } = await this.readRules();
    const metric: MetricRule = {
      id: `metric-${randomUUID().slice(0, 8)}`,
      name,
      target,
      condition,
      threshold,
      weight,
    };

    await this.writeRules(
      { ...rules, metrics: [...rules.metrics, metric] },
      `chore(rules): add metric rule "${name}"`,
      sha,
    );

    return metric;
  }

  async deleteMetric(metricId: string): Promise<void> {
    const { rules, sha } = await this.readRules();
    const filtered = rules.metrics.filter((m) => m.id !== metricId);
    if (filtered.length === rules.metrics.length) {
      throw ApiError.notFound(`Metric rule "${metricId}" not found`);
    }

    await this.writeRules(
      { ...rules, metrics: filtered },
      `chore(rules): delete metric rule "${metricId}"`,
      sha,
    );
  }

  async listConstraints(): Promise<readonly Constraint[]> {
    const { rules } = await this.readRules();
    return rules.constraints;
  }

  async createConstraint(params: CreateConstraintParams): Promise<Constraint> {
    const { name, target, violationCondition } = params;
    if (!name || name.trim() === '') throw ApiError.badRequest('name is required');
    if (!target || target.trim() === '') throw ApiError.badRequest('target is required');
    if (!violationCondition || violationCondition.trim() === '') {
      throw ApiError.badRequest('violationCondition is required');
    }

    const { rules, sha } = await this.readRules();
    const constraint: Constraint = {
      id: `constraint-${randomUUID().slice(0, 8)}`,
      name,
      target,
      violationCondition,
    };

    await this.writeRules(
      { ...rules, constraints: [...rules.constraints, constraint] },
      `chore(rules): add constraint "${name}"`,
      sha,
    );

    return constraint;
  }

  async deleteConstraint(constraintId: string): Promise<void> {
    const { rules, sha } = await this.readRules();
    const filtered = rules.constraints.filter((c) => c.id !== constraintId);
    if (filtered.length === rules.constraints.length) {
      throw ApiError.notFound(`Constraint "${constraintId}" not found`);
    }

    await this.writeRules(
      { ...rules, constraints: filtered },
      `chore(rules): delete constraint "${constraintId}"`,
      sha,
    );
  }

  private async readRules(): Promise<{ rules: RulesJson; sha: string }> {
    const { content, sha } = await this.github.readFileWithSha(SOURCE_BRANCH, RULES_JSON_PATH);
    return { rules: parseRulesJson(content), sha };
  }

  // expectedSha ties this write to the exact version of rules.json that was
  // read by the matching readRules() call above — if another request wrote
  // to rules.json in between, GitHub rejects the write with a 409 and
  // GitHubService rethrows it as ApiError.conflict, instead of silently
  // clobbering the intervening change (a real lost-update race otherwise).
  private async writeRules(rules: RulesJson, message: string, expectedSha: string): Promise<void> {
    await this.github.writeFile(
      SOURCE_BRANCH,
      RULES_JSON_PATH,
      JSON.stringify(rules, null, 2),
      message,
      expectedSha,
    );
  }
}
