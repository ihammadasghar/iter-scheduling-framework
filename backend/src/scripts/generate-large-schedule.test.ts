import { describe, it, expect } from 'vitest';
import { generateLargeSchedule } from './generate-large-schedule.js';

describe('generateLargeSchedule', () => {
  const { schedule, rules } = generateLargeSchedule();

  it('generates the target scale', () => {
    expect(schedule.rooms.length).toBe(80);
    expect(schedule.professors.length).toBe(80);
    expect(schedule.studentGroups.length).toBe(80);
    expect(schedule.courses.length).toBe(160);
    expect(schedule.timeSlots.length).toBe(25);
    expect(schedule.classes.length).toBe(1500);
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

  it('has zero room, professor, or student-group double-bookings', () => {
    const byRoomSlot = new Map<string, string[]>();
    const byProfSlot = new Map<string, string[]>();
    const byGroupSlot = new Map<string, string[]>();

    for (const cls of schedule.classes) {
      for (const slotId of cls.timeSlotIds) {
        const roomKey = `${cls.roomId}::${slotId}`;
        const profKey = `${cls.professorId}::${slotId}`;
        const groupKey = `${cls.studentGroupId}::${slotId}`;
        byRoomSlot.set(roomKey, [...(byRoomSlot.get(roomKey) ?? []), cls.id]);
        byProfSlot.set(profKey, [...(byProfSlot.get(profKey) ?? []), cls.id]);
        byGroupSlot.set(groupKey, [...(byGroupSlot.get(groupKey) ?? []), cls.id]);
      }
    }

    expect([...byRoomSlot.values()].every((ids) => ids.length === 1)).toBe(true);
    expect([...byProfSlot.values()].every((ids) => ids.length === 1)).toBe(true);
    expect([...byGroupSlot.values()].every((ids) => ids.length === 1)).toBe(true);
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

  it('is deterministic — generating twice produces identical output', () => {
    const second = generateLargeSchedule();
    expect(second.schedule).toEqual(schedule);
    expect(second.rules).toEqual(rules);
  });
});
