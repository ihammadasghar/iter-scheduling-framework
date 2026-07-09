import { describe, it, expect } from 'vitest';
import { extractUserLabel } from './formatSimulationId';

describe('extractUserLabel', () => {
  it('extracts user portion from sim-alice-abc123', () => {
    expect(extractUserLabel('sim-alice-abc123')).toBe('alice');
  });

  it('returns Unknown for non-matching format', () => {
    expect(extractUserLabel('BRANCH_XYZ')).toBe('Unknown');
  });

  it('returns Unknown for empty string', () => {
    expect(extractUserLabel('')).toBe('Unknown');
  });

  it('handles multi-segment usernames', () => {
    // sim-john-doe-abc → parts[1] = 'john'
    expect(extractUserLabel('sim-john-doe-abc123')).toBe('john');
  });
});
