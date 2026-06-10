import { ApiError } from '../types/ApiError.js';
import type { MetricRule } from '../types/domain.js';

export interface TranslatedMetric {
  readonly cypher: string;
  readonly unit: string;
}

// ── Cypher templates (all return a single row with a numeric `value` column) ─

const CLASS_COUNT_CYPHER = `
  MATCH (c:Class {branchId: $branchId})
  RETURN count(c) AS value
`.trim();

const PROFESSOR_AVG_CLASSES_PER_DAY_CYPHER = `
  MATCH (c:Class {branchId: $branchId})-[:TAUGHT_BY]->(p:Professor {branchId: $branchId})
  MATCH (c)-[:SCHEDULED_AT]->(t:TimeSlot {branchId: $branchId})
  WITH p, t.day AS day, count(DISTINCT c) AS classCount
  RETURN round(avg(toFloat(classCount)), 2) AS value
`.trim();

const PROFESSOR_MAX_CLASSES_PER_DAY_CYPHER = `
  MATCH (c:Class {branchId: $branchId})-[:TAUGHT_BY]->(p:Professor {branchId: $branchId})
  MATCH (c)-[:SCHEDULED_AT]->(t:TimeSlot {branchId: $branchId})
  WITH p, t.day AS day, count(DISTINCT c) AS classCount
  RETURN max(classCount) AS value
`.trim();

// Utilization = occupied room-slot pairs / total possible room-slot pairs × 100
const ROOM_UTILIZATION_CYPHER = `
  MATCH (r:Room {branchId: $branchId})
  WITH count(r) AS roomCount
  MATCH (t:TimeSlot {branchId: $branchId})
  WITH roomCount * count(t) AS capacity
  OPTIONAL MATCH (c:Class {branchId: $branchId})-[:HELD_IN]->(:Room {branchId: $branchId})
  MATCH (c)-[:SCHEDULED_AT]->(:TimeSlot {branchId: $branchId})
  WITH capacity, count(c) AS occupied
  RETURN CASE WHEN capacity = 0 THEN 0.0
              ELSE round(100.0 * toFloat(occupied) / toFloat(capacity), 2)
         END AS value
`.trim();

// ── Lookup map ────────────────────────────────────────────────────────────────

const TRANSLATION_MAP: ReadonlyMap<string, TranslatedMetric> = new Map([
  ['Class:count',                      { cypher: CLASS_COUNT_CYPHER,                      unit: 'classes'    }],
  ['Professor:avg_classes_per_day',    { cypher: PROFESSOR_AVG_CLASSES_PER_DAY_CYPHER,    unit: 'classes/day' }],
  ['Professor:max_classes_per_day',    { cypher: PROFESSOR_MAX_CLASSES_PER_DAY_CYPHER,    unit: 'classes/day' }],
  ['Room:utilization',                 { cypher: ROOM_UTILIZATION_CYPHER,                 unit: '%'          }],
]);

// ── Public API ────────────────────────────────────────────────────────────────

export function translateRule(rule: MetricRule): TranslatedMetric {
  const key = `${rule.target}:${rule.condition}`;
  const translated = TRANSLATION_MAP.get(key);
  if (!translated) {
    throw ApiError.badRequest(
      `Unsupported metric rule: target='${rule.target}', condition='${rule.condition}'. ` +
      `Supported combinations: ${[...TRANSLATION_MAP.keys()].join(', ')}`,
    );
  }
  return translated;
}
