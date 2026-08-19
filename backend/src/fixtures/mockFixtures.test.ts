import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { ScheduleJson } from '../types/scheduleJson.js';
import type { RulesJson } from '../types/rulesJson.js';

function loadFixture<T>(filename: string): T {
  const raw = readFileSync(join(__dirname, filename), 'utf-8');
  return JSON.parse(raw) as T;
}

describe('mock fixtures', () => {
  const schedule = loadFixture<ScheduleJson>('mock-schedule.json');
  const rules = loadFixture<RulesJson>('mock-rules.json');

  it('mock-schedule.json has at least one entry in every master array', () => {
    expect(schedule.rooms.length).toBeGreaterThan(0);
    expect(schedule.professors.length).toBeGreaterThan(0);
    expect(schedule.studentGroups.length).toBeGreaterThan(0);
    expect(schedule.courses.length).toBeGreaterThan(0);
    expect(schedule.timeSlots.length).toBeGreaterThan(0);
    expect(schedule.classes.length).toBeGreaterThan(0);
  });

  it('every class references ids that exist in the master arrays', () => {
    const roomIds = new Set(schedule.rooms.map((r) => r.id));
    const professorIds = new Set(schedule.professors.map((p) => p.id));
    const groupIds = new Set(schedule.studentGroups.map((g) => g.id));
    const courseIds = new Set(schedule.courses.map((c) => c.id));
    const timeSlotIds = new Set(schedule.timeSlots.map((t) => t.id));

    for (const cls of schedule.classes) {
      expect(roomIds.has(cls.roomId)).toBe(true);
      expect(professorIds.has(cls.professorId)).toBe(true);
      expect(groupIds.has(cls.studentGroupId)).toBe(true);
      expect(courseIds.has(cls.courseId)).toBe(true);
      cls.timeSlotIds.forEach((id) => expect(timeSlotIds.has(id)).toBe(true));
    }
  });

  it('contains exactly one deliberate room-double-booking conflict: CLS_00001 vs CLS_00004 in RM_101', () => {
    const byRoomAndSlot = new Map<string, string[]>();
    for (const cls of schedule.classes) {
      for (const slotId of cls.timeSlotIds) {
        const key = `${cls.roomId}::${slotId}`;
        const existing = byRoomAndSlot.get(key) ?? [];
        existing.push(cls.id);
        byRoomAndSlot.set(key, existing);
      }
    }
    const collisions = [...byRoomAndSlot.entries()].filter(([, ids]) => ids.length > 1);
    expect(collisions).toEqual([['RM_101::TS_MON_P1', ['CLS_00001', 'CLS_00004']]]);
  });

  it('mock-schedule.json has no accidental professor or student-group double-bookings', () => {
    const byProfAndSlot = new Map<string, string[]>();
    const byGroupAndSlot = new Map<string, string[]>();
    for (const cls of schedule.classes) {
      for (const slotId of cls.timeSlotIds) {
        const profKey = `${cls.professorId}::${slotId}`;
        const groupKey = `${cls.studentGroupId}::${slotId}`;
        byProfAndSlot.set(profKey, [...(byProfAndSlot.get(profKey) ?? []), cls.id]);
        byGroupAndSlot.set(groupKey, [...(byGroupAndSlot.get(groupKey) ?? []), cls.id]);
      }
    }
    expect([...byProfAndSlot.values()].every((ids) => ids.length === 1)).toBe(true);
    expect([...byGroupAndSlot.values()].every((ids) => ids.length === 1)).toBe(true);
  });

  it('mock-rules.json metric rules use target/condition combinations supported by MetricRuleTranslator', () => {
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
});
