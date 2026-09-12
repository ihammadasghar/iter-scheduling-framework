import { describe, it, expect } from 'vitest';
import { importIsteDataset } from './importIsteDataset.js';

// Unlike generate-large-schedule.ts, this converts real, messy institution
// data — it's expected to have gaps (most classes have no assigned room)
// and even the occasional real-world double-booking. These tests assert
// structural validity (every foreign key resolves) and the documented
// data-quality shape, not conflict-free-ness.
describe('importIsteDataset', () => {
  const { schedule, rules } = importIsteDataset();

  it('produces a non-trivial, institution-scale dataset', () => {
    expect(schedule.rooms.length).toBeGreaterThan(50);
    expect(schedule.professors.length).toBeGreaterThan(500);
    expect(schedule.studentGroups.length).toBeGreaterThan(100);
    expect(schedule.courses.length).toBeGreaterThan(100);
    expect(schedule.timeSlots.length).toBeGreaterThan(20);
    expect(schedule.classes.length).toBeGreaterThan(1000);
  });

  it('every class references ids that exist in the master arrays', () => {
    const roomIds = new Set(schedule.rooms.map((r) => r.id));
    const professorIds = new Set(schedule.professors.map((p) => p.id));
    const groupIds = new Set(schedule.studentGroups.map((g) => g.id));
    const courseIds = new Set(schedule.courses.map((c) => c.id));
    const timeSlotIds = new Set(schedule.timeSlots.map((t) => t.id));

    for (const cls of schedule.classes) {
      // roomId may be "" — ISCTE never assigned one (see docs/iscte-dataset.md).
      expect(cls.roomId === '' || roomIds.has(cls.roomId)).toBe(true);
      expect(professorIds.has(cls.professorId)).toBe(true);
      expect(groupIds.has(cls.studentGroupId)).toBe(true);
      expect(courseIds.has(cls.courseId)).toBe(true);
      expect(cls.timeSlotIds.length).toBeGreaterThan(0);
      cls.timeSlotIds.forEach((id) => expect(timeSlotIds.has(id)).toBe(true));
    }
  });

  it('ids, names, and codes are all non-empty', () => {
    for (const cls of schedule.classes) {
      expect(cls.id).toBeTruthy();
      expect(cls.title).toBeTruthy();
    }
    for (const room of schedule.rooms) expect(room.name).toBeTruthy();
    for (const course of schedule.courses) expect(course.name).toBeTruthy();
    for (const group of schedule.studentGroups) {
      expect(group.name).toBeTruthy();
      expect(group.size).toBeGreaterThan(0);
    }
  });

  it('course codes are short, unique, and derived from the real name — not a bare "C0001" id remnant', () => {
    // The calendar/chip UI displays course.code, not course.name (see
    // ClassChip.tsx) — ISCTE's export has no code column, so this must be
    // synthesized to be a meaningful label rather than an opaque id.
    const codes = schedule.courses.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length); // all unique
    for (const course of schedule.courses) {
      expect(course.code).toMatch(/^[A-Z]{2,4}\d{3}$/);
      expect(course.code).not.toMatch(/^C\d{4}$/); // the old, meaningless derivation
    }
  });

  it('flags the dataset as real-world sourced, with synthesized professors', () => {
    expect(schedule.metadata['source']).toBe('iscte-2022-23');
    expect(schedule.metadata['professorsAreSynthetic']).toBe(true);
  });

  it('metadata.timeline has a well-formed, non-degenerate semester range — required by the frontend\'s week navigation', () => {
    const timeline = schedule.metadata['timeline'] as { semesterStartDate: string; semesterEndDate: string; exclusionDates: unknown[] };
    expect(timeline).toBeDefined();
    expect(timeline.semesterStartDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(timeline.semesterEndDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(timeline.semesterStartDate < timeline.semesterEndDate).toBe(true);
    expect(Array.isArray(timeline.exclusionDates)).toBe(true);
  });

  it('most classes have no real assigned room — documents the known gap, doesn\'t hide it', () => {
    const withRoom = schedule.classes.filter((c) => c.roomId !== '').length;
    const coverage = withRoom / schedule.classes.length;
    expect(coverage).toBeGreaterThan(0);
    expect(coverage).toBeLessThan(0.5);
  });

  it('rules.json metric rules use target/condition combinations supported by MetricRuleTranslator', () => {
    const supported = new Set([
      'Class:count',
      'Professor:avg_classes_per_day',
      'Professor:max_classes_per_day',
      'Room:utilization',
    ]);
    rules.metrics.forEach((rule) => {
      expect(supported.has(`${rule.target}:${rule.condition}`)).toBe(true);
    });
  });

  it('is deterministic — importing twice from the same source files produces identical output', () => {
    const second = importIsteDataset();
    expect(second.schedule).toEqual(schedule);
    expect(second.rules).toEqual(rules);
  });
});
