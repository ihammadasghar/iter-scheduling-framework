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

// Stand-in for a "minimum gap" preference: what share of a professor's classes
// are scheduled directly back-to-back (adjacent via the chronological :NEXT
// chain between TimeSlots), with no gap in between. Lower is better.
const PROFESSOR_BACK_TO_BACK_RATIO_CYPHER = `
  MATCH (c1:Class {branchId: $branchId})-[:SCHEDULED_AT]->(t1:TimeSlot {branchId: $branchId})-[:NEXT]->(t2:TimeSlot {branchId: $branchId})<-[:SCHEDULED_AT]-(c2:Class {branchId: $branchId})
  MATCH (c1)-[:TAUGHT_BY]->(p:Professor {branchId: $branchId})<-[:TAUGHT_BY]-(c2)
  WITH count(DISTINCT c1) AS backToBack
  MATCH (c:Class {branchId: $branchId})-[:TAUGHT_BY]->(:Professor {branchId: $branchId})
  WITH backToBack, count(DISTINCT c) AS totalClasses
  RETURN CASE WHEN totalClasses = 0 THEN 0.0
              ELSE round(100.0 * toFloat(backToBack) / toFloat(totalClasses), 2)
         END AS value
`.trim();

// Stand-in for a "room stability" preference: for each professor, what share
// of their classes are held in their single most-used room, averaged across
// all professors. Higher means a professor teaches consistently in one room.
const PROFESSOR_ROOM_CONSISTENCY_CYPHER = `
  MATCH (p:Professor {branchId: $branchId})<-[:TAUGHT_BY]-(c:Class {branchId: $branchId})-[:HELD_IN]->(r:Room {branchId: $branchId})
  WITH p, r, count(c) AS classesInRoom
  WITH p, max(classesInRoom) AS topRoomCount, sum(classesInRoom) AS totalClasses
  WITH CASE WHEN totalClasses = 0 THEN 0.0 ELSE 100.0 * toFloat(topRoomCount) / toFloat(totalClasses) END AS pct
  RETURN round(avg(pct), 2) AS value
`.trim();

// Compressed-schedule preference: what share of student groups have at least
// one day (out of the days used anywhere in the timetable) with no classes.
const STUDENT_GROUP_FREE_DAY_RATIO_CYPHER = `
  MATCH (t:TimeSlot {branchId: $branchId})
  WITH count(DISTINCT t.day) AS dayCount
  MATCH (g:StudentGroup {branchId: $branchId})
  OPTIONAL MATCH (g)<-[:ATTENDED_BY]-(c:Class {branchId: $branchId})-[:SCHEDULED_AT]->(t:TimeSlot {branchId: $branchId})
  WITH g, dayCount, count(DISTINCT t.day) AS usedDays
  WITH dayCount, count(g) AS totalGroups, sum(CASE WHEN usedDays < dayCount THEN 1 ELSE 0 END) AS withFreeDay
  RETURN CASE WHEN totalGroups = 0 THEN 0.0
              ELSE round(100.0 * toFloat(withFreeDay) / toFloat(totalGroups), 2)
         END AS value
`.trim();

// Gap-based metric: how many idle time slots (on average) separate a
// professor's classes, distinct from `back_to_back_ratio` above (which only
// measures the *share* of zero-gap adjacent pairs). For each class, find the
// nearest subsequent class taught by the same professor by walking the
// chronological :NEXT chain; `hops - 1` is the number of empty slots between
// them (0 = back-to-back). Averaged per professor first, then across
// professors, so a professor with many classes doesn't dominate the figure.
// The `*1..8` hop bound keeps the traversal cheap — :NEXT edges never cross
// days (see ScheduleHydrator.buildChronologicalPairs), so 8 hops safely
// covers a full day's worth of slots without an unbounded scan.
const PROFESSOR_AVG_GAP_LENGTH_CYPHER = `
  MATCH (c1:Class {branchId: $branchId})-[:SCHEDULED_AT]->(t1:TimeSlot {branchId: $branchId})
  MATCH (c1)-[:TAUGHT_BY]->(p:Professor {branchId: $branchId})
  MATCH path = (t1)-[:NEXT*1..8]->(t2:TimeSlot {branchId: $branchId})
  MATCH (c2:Class {branchId: $branchId})-[:SCHEDULED_AT]->(t2)
  MATCH (c2)-[:TAUGHT_BY]->(p)
  WHERE c1 <> c2
  WITH c1, p, min(length(path)) AS hops
  WITH p, avg(hops - 1) AS avgGapPerProf
  RETURN CASE WHEN avgGapPerProf IS NULL THEN 0.0 ELSE round(avg(avgGapPerProf), 2) END AS value
`.trim();

// ── Lookup map ────────────────────────────────────────────────────────────────

const TRANSLATION_MAP: ReadonlyMap<string, TranslatedMetric> = new Map([
  ['Class:count',                      { cypher: CLASS_COUNT_CYPHER,                      unit: 'classes'    }],
  ['Professor:avg_classes_per_day',    { cypher: PROFESSOR_AVG_CLASSES_PER_DAY_CYPHER,    unit: 'classes/day' }],
  ['Professor:max_classes_per_day',    { cypher: PROFESSOR_MAX_CLASSES_PER_DAY_CYPHER,    unit: 'classes/day' }],
  ['Room:utilization',                 { cypher: ROOM_UTILIZATION_CYPHER,                 unit: '%'          }],
  ['Professor:back_to_back_ratio',     { cypher: PROFESSOR_BACK_TO_BACK_RATIO_CYPHER,     unit: '%'          }],
  ['Professor:room_consistency',       { cypher: PROFESSOR_ROOM_CONSISTENCY_CYPHER,       unit: '%'          }],
  ['StudentGroup:free_day_ratio',      { cypher: STUDENT_GROUP_FREE_DAY_RATIO_CYPHER,     unit: '%'          }],
  ['Professor:avg_gap_length',         { cypher: PROFESSOR_AVG_GAP_LENGTH_CYPHER,         unit: 'slots'      }],
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
