// Raw type matching the rules.json schema stored on the main branch.
// Used exclusively when reading/writing rules config; not a domain type.

import type { MetricRule, Constraint } from './domain.js';

export interface RulesJson {
  readonly metrics: readonly MetricRule[];
  readonly constraints: readonly Constraint[];
}
