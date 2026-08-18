// Raw type matching the rules.json schema stored on the main branch.
// Used exclusively when reading/writing rules config; not a domain type.

import { ApiError } from './ApiError.js';
import type { MetricRule, Constraint } from './domain.js';

export interface RulesJson {
  readonly metrics: readonly MetricRule[];
  readonly constraints: readonly Constraint[];
}

// Mirrors ScheduleHydrator.parseScheduleJson's convention: a malformed
// rules.json (or one committed with keys missing) should surface as a clean,
// typed ApiError, not a raw SyntaxError leaking to a 500.
export function parseRulesJson(raw: string): RulesJson {
  let parsed: Partial<RulesJson>;
  try {
    parsed = JSON.parse(raw) as Partial<RulesJson>;
  } catch {
    throw ApiError.badRequest('rules.json contains invalid JSON');
  }
  return { metrics: parsed.metrics ?? [], constraints: parsed.constraints ?? [] };
}
