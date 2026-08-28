import { randomUUID } from 'crypto';
import { ApiError } from '../types/ApiError.js';
import { isPolicyConstraint } from '../utils/ConstraintTranslator.js';
import { validateMetricParams, validateConstraintParams } from '../utils/rulesValidation.js';
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
    validateMetricParams(params);
    const { name, target, condition, threshold, weight, direction } = params;

    const { rules, sha } = await this.readRules();
    const metric: MetricRule = {
      id: `metric-${randomUUID().slice(0, 8)}`,
      name,
      target,
      condition,
      threshold,
      weight,
      ...(direction !== undefined ? { direction } : {}),
    };

    await this.writeRules(
      { ...rules, metrics: [...rules.metrics, metric] },
      `chore(rules): add metric rule "${name}"`,
      sha,
    );

    return metric;
  }

  async updateMetric(metricId: string, params: CreateMetricRuleParams): Promise<MetricRule> {
    validateMetricParams(params);
    const { name, target, condition, threshold, weight, direction } = params;

    const { rules, sha } = await this.readRules();
    const index = rules.metrics.findIndex((m) => m.id === metricId);
    if (index === -1) throw ApiError.notFound(`Metric rule "${metricId}" not found`);

    const updated: MetricRule = {
      id: metricId,
      name,
      target,
      condition,
      threshold,
      weight,
      ...(direction !== undefined ? { direction } : {}),
    };
    const metrics = [...rules.metrics];
    metrics[index] = updated;

    await this.writeRules(
      { ...rules, metrics },
      `chore(rules): update metric rule "${name}"`,
      sha,
    );

    return updated;
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
    validateConstraintParams(params);
    const { name, target, violationCondition, limit } = params;
    const needsLimit = isPolicyConstraint(violationCondition);

    const { rules, sha } = await this.readRules();
    const constraint: Constraint = {
      id: `constraint-${randomUUID().slice(0, 8)}`,
      name,
      target,
      violationCondition,
      ...(needsLimit ? { limit } : {}),
    };

    await this.writeRules(
      { ...rules, constraints: [...rules.constraints, constraint] },
      `chore(rules): add constraint "${name}"`,
      sha,
    );

    return constraint;
  }

  async updateConstraint(constraintId: string, params: CreateConstraintParams): Promise<Constraint> {
    validateConstraintParams(params);
    const { name, target, violationCondition, limit } = params;
    const needsLimit = isPolicyConstraint(violationCondition);

    const { rules, sha } = await this.readRules();
    const index = rules.constraints.findIndex((c) => c.id === constraintId);
    if (index === -1) throw ApiError.notFound(`Constraint "${constraintId}" not found`);

    const updated: Constraint = {
      id: constraintId,
      name,
      target,
      violationCondition,
      ...(needsLimit ? { limit } : {}),
    };
    const constraints = [...rules.constraints];
    constraints[index] = updated;

    await this.writeRules(
      { ...rules, constraints },
      `chore(rules): update constraint "${name}"`,
      sha,
    );

    return updated;
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
    const rules = parseRulesJson(content);
    this.validateRulesJsonEntries(rules);
    return { rules, sha };
  }

  // parseRulesJson() above only guards against invalid JSON — it doesn't
  // check that each entry is actually a rule the system recognizes. Without
  // this, a malformed rules.json entry (bad target/condition pair, an
  // unknown violationCondition, a limit on a condition that doesn't take
  // one) would sit undetected until someone tried to evaluate against it —
  // translateRule()/translateConstraint() throwing deep inside a CI run or
  // proposal score, long after the point of failure. Reuses the exact same
  // validators create/update use, so anything that would be rejected on
  // write is now also rejected on read — every entry that's already valid
  // today stays valid, only genuinely malformed ones are caught, and
  // earlier, right where the bad data actually is.
  private validateRulesJsonEntries(rules: RulesJson): void {
    rules.metrics.forEach((metric, index) => {
      try {
        validateMetricParams(metric);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw ApiError.badRequest(`rules.json metrics[${index}] (id=${metric.id}): ${message}`);
      }
    });
    rules.constraints.forEach((constraint, index) => {
      try {
        validateConstraintParams(constraint);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw ApiError.badRequest(`rules.json constraints[${index}] (id=${constraint.id}): ${message}`);
      }
    });
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
