import { describe, it, expect } from 'vitest';
import { generateDataset } from './generateDataset.js';

describe('generateDataset()', () => {
  it('generates exactly `scale` classes', () => {
    const json = generateDataset({ scale: 500 });
    expect(json.classes).toHaveLength(500);
  });

  it('generates non-empty rooms, professors, studentGroups, courses at scale', () => {
    const json = generateDataset({ scale: 500 });
    expect(json.rooms.length).toBeGreaterThan(0);
    expect(json.professors.length).toBeGreaterThan(0);
    expect(json.studentGroups.length).toBeGreaterThan(0);
    expect(json.courses.length).toBeGreaterThan(0);
    expect(json.timeSlots.length).toBeGreaterThan(0);
  });

  it('applies sane minimums for small scales rather than degenerating to near-zero', () => {
    const json = generateDataset({ scale: 1 });
    expect(json.rooms.length).toBeGreaterThanOrEqual(10);
    expect(json.professors.length).toBeGreaterThanOrEqual(5);
    expect(json.studentGroups.length).toBeGreaterThanOrEqual(5);
    expect(json.courses.length).toBeGreaterThanOrEqual(5);
  });

  it('is deterministic for a fixed seed', () => {
    const a = generateDataset({ scale: 300, seed: 7 });
    const b = generateDataset({ scale: 300, seed: 7 });
    expect(a).toEqual(b);
  });

  it('produces different output for different seeds', () => {
    const a = generateDataset({ scale: 300, seed: 1 });
    const b = generateDataset({ scale: 300, seed: 2 });
    expect(a.classes).not.toEqual(b.classes);
  });

  it('defaults to a fixed seed when none is given (still deterministic)', () => {
    const a = generateDataset({ scale: 200 });
    const b = generateDataset({ scale: 200 });
    expect(a).toEqual(b);
  });

  it('throws for a non-positive or non-finite scale', () => {
    expect(() => generateDataset({ scale: 0 })).toThrow();
    expect(() => generateDataset({ scale: -5 })).toThrow();
    expect(() => generateDataset({ scale: NaN })).toThrow();
  });

  it('every class references ids that exist in the corresponding generated arrays', () => {
    const json = generateDataset({ scale: 1000, seed: 3 });
    const roomIds = new Set(json.rooms.map((r) => r.id));
    const professorIds = new Set(json.professors.map((p) => p.id));
    const groupIds = new Set(json.studentGroups.map((g) => g.id));
    const courseIds = new Set(json.courses.map((c) => c.id));
    const timeSlotIds = new Set(json.timeSlots.map((t) => t.id));

    for (const cls of json.classes) {
      expect(roomIds.has(cls.roomId)).toBe(true);
      expect(professorIds.has(cls.professorId)).toBe(true);
      expect(groupIds.has(cls.studentGroupId)).toBe(true);
      expect(courseIds.has(cls.courseId)).toBe(true);
      expect(cls.timeSlotIds.length).toBeGreaterThan(0);
      cls.timeSlotIds.forEach((id) => expect(timeSlotIds.has(id)).toBe(true));
    }
  });

  it('all entity ids within each array are unique', () => {
    const json = generateDataset({ scale: 800, seed: 9 });
    const assertUnique = (ids: readonly string[]): void => {
      expect(new Set(ids).size).toBe(ids.length);
    };
    assertUnique(json.rooms.map((r) => r.id));
    assertUnique(json.professors.map((p) => p.id));
    assertUnique(json.studentGroups.map((g) => g.id));
    assertUnique(json.courses.map((c) => c.id));
    assertUnique(json.timeSlots.map((t) => t.id));
    assertUnique(json.classes.map((c) => c.id));
  });

  it('room capacities and group sizes are positive numbers', () => {
    const json = generateDataset({ scale: 300 });
    json.rooms.forEach((r) => expect(r.capacity).toBeGreaterThan(0));
    json.studentGroups.forEach((g) => expect(g.size).toBeGreaterThan(0));
  });
});
