import { ApiError } from '../types/ApiError.js';
import type { Constraint } from '../types/domain.js';

export interface TranslatedConstraint {
  readonly cypher: string;
}

// ── Cypher templates ─────────────────────────────────────────────────────────
//
// Both queries return the same 3-column row shape GraphService.queryConflicts
// already uses for its structural checks (classId1, classId2, resourceName —
// see GraphService's ConflictRow), so GraphService.queryConstraintViolations
// can reuse the existing row→Conflict mapping pattern instead of inventing a
// second one.

// gap_limit: reuses the same chronological :NEXT traversal as
// MetricRuleTranslator's PROFESSOR_AVG_GAP_LENGTH_CYPHER (nearest subsequent
// class taught by the same professor, `hops - 1` idle slots between them),
// but instead of averaging, filters for any professor/class pair whose gap
// exceeds the institution's $limit and reports that pair. $limit is a normal
// Cypher parameter here — unlike consecutive_limit below, the traversal's
// hop bound (*1..8) is already a fixed literal, so no interpolation is
// needed.
const GAP_LIMIT_CYPHER = `
  MATCH (c1:Class {branchId: $branchId})-[:SCHEDULED_AT]->(t1:TimeSlot {branchId: $branchId})
  MATCH (c1)-[:TAUGHT_BY]->(p:Professor {branchId: $branchId})
  MATCH path = (t1)-[:NEXT*1..8]->(t2:TimeSlot {branchId: $branchId})
  MATCH (cNext:Class {branchId: $branchId})-[:SCHEDULED_AT]->(t2)
  MATCH (cNext)-[:TAUGHT_BY]->(p)
  WHERE c1 <> cNext
  WITH c1, p, t1, min(length(path)) AS nearestHops
  WITH c1, p, t1, nearestHops, nearestHops - 1 AS gap
  WHERE gap > $limit
  MATCH path2 = (t1)-[:NEXT*1..8]->(t2b:TimeSlot {branchId: $branchId})
  WHERE length(path2) = nearestHops
  MATCH (c2:Class {branchId: $branchId})-[:SCHEDULED_AT]->(t2b)
  MATCH (c2)-[:TAUGHT_BY]->(p)
  RETURN DISTINCT c1.id AS classId1, c2.id AS classId2, p.name AS resourceName
`.trim();

// consecutive_limit: `limit + 1` consecutive classes by the same professor is
// sufficient proof of a violation — a run longer than that always contains a
// sub-run of this exact length, so there's no need to compute each
// professor's true max run length. Matches a fixed-length window of
// `limit` chronological :NEXT hops (`limit + 1` TimeSlots inclusive), then
// verifies every slot in that window has a class taught by the same
// professor by UNWINDing the path's nodes and re-matching a class there;
// slots with no such class simply produce no row, so `covered` (the count
// of slots that did match) falls short of the window size when the run has
// a gap. $limit can't be a normal Cypher parameter here — Memgraph (like
// Neo4j) requires an integer literal for a variable-length relationship hop
// bound, the same restriction that already forces the `*1..8` literal bound
// in MetricRuleTranslator's PROFESSOR_AVG_GAP_LENGTH_CYPHER — so it's
// interpolated directly into the template. `translateConstraint` validates
// it's a positive integer first, so nothing admin-supplied reaches the
// query string unchecked.
const buildConsecutiveLimitCypher = (limit: number): string => `
  MATCH (c0:Class {branchId: $branchId})-[:SCHEDULED_AT]->(t0:TimeSlot {branchId: $branchId})
  MATCH (c0)-[:TAUGHT_BY]->(p:Professor {branchId: $branchId})
  MATCH path = (t0)-[:NEXT*${limit}]->(tN:TimeSlot {branchId: $branchId})
  MATCH (cN:Class {branchId: $branchId})-[:SCHEDULED_AT]->(tN)
  MATCH (cN)-[:TAUGHT_BY]->(p)
  WITH p, c0, cN, path
  UNWIND nodes(path) AS slot
  MATCH (sc:Class {branchId: $branchId})-[:SCHEDULED_AT]->(slot)
  MATCH (sc)-[:TAUGHT_BY]->(p)
  WITH p, c0, cN, path, count(DISTINCT slot) AS covered
  WHERE covered = size(nodes(path))
  RETURN DISTINCT c0.id AS classId1, cN.id AS classId2, p.name AS resourceName
`.trim();

const SUPPORTED_CONDITIONS = ['consecutive_limit', 'gap_limit'] as const;

// Single source of truth for which violationCondition values are
// institution-defined, CI-gating policy constraints (as opposed to the 4
// always-on structural ones) — used by RulesService (limit validation) and
// by CiPipelineService/ProposalService (deciding which constraints to pass
// to GraphService.queryConstraintViolations).
export function isPolicyConstraint(violationCondition: string): boolean {
  return (SUPPORTED_CONDITIONS as readonly string[]).includes(violationCondition);
}

// The full catalog of recognized violationCondition values: the 2 policy
// conditions above (translatable to Cypher, CI-gating) plus the 4 always-on
// structural ones (double-booking/overlap/capacity — evaluated by
// GraphService.queryConflicts's hardcoded checks, never translated here).
// Distinct from isPolicyConstraint()/SUPPORTED_CONDITIONS on purpose: this
// answers "is this a real violationCondition at all", not "does
// translateConstraint know how to generate Cypher for it". Used by
// RulesService's validation (rulesValidation.ts) to catch a nonsense
// violationCondition at create/update/read time rather than letting it sit
// unnoticed in rules.json (structural conditions are never passed to
// translateConstraint, so it would never catch them itself).
export const KNOWN_VIOLATION_CONDITIONS = [
  'professor_overlap',
  'room_double_book',
  'group_overlap',
  'room_capacity_exceeded',
  'consecutive_limit',
  'gap_limit',
] as const;

export function isKnownViolationCondition(violationCondition: string): boolean {
  return (KNOWN_VIOLATION_CONDITIONS as readonly string[]).includes(violationCondition);
}

// ── Public API ────────────────────────────────────────────────────────────────

export function translateConstraint(constraint: Constraint): TranslatedConstraint {
  const { violationCondition, limit } = constraint;

  if (violationCondition === 'gap_limit') {
    assertValidLimit(limit, violationCondition);
    return { cypher: GAP_LIMIT_CYPHER };
  }

  if (violationCondition === 'consecutive_limit') {
    assertValidLimit(limit, violationCondition);
    return { cypher: buildConsecutiveLimitCypher(limit as number) };
  }

  throw ApiError.badRequest(
    `Unsupported policy constraint: violationCondition='${violationCondition}'. ` +
    `Supported conditions: ${SUPPORTED_CONDITIONS.join(', ')}`,
  );
}

function assertValidLimit(limit: number | undefined, violationCondition: string): void {
  if (!Number.isInteger(limit) || (limit as number) <= 0) {
    throw ApiError.badRequest(
      `Constraint with violationCondition='${violationCondition}' requires a positive integer limit`,
    );
  }
}
