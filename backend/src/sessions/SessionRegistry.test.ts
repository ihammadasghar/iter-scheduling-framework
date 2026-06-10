import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionRegistry } from './SessionRegistry.js';

describe('SessionRegistry', () => {
  let registry: SessionRegistry;

  beforeEach(() => {
    registry = new SessionRegistry();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('register() creates an entry so touch() returns true', () => {
    registry.register('sim-1');
    expect(registry.touch('sim-1')).toBe(true);
  });

  it('touch() updates the timestamp and returns true for a known session', () => {
    registry.register('sim-1');
    vi.advanceTimersByTime(1000);
    const result = registry.touch('sim-1');
    expect(result).toBe(true);
    // After touch, the session should no longer be expired with a 1-second TTL
    expect(registry.getExpired(500)).not.toContain('sim-1');
  });

  it('touch() returns false for an unknown (or removed) session', () => {
    expect(registry.touch('sim-unknown')).toBe(false);
  });

  it('getExpired() returns ids whose last heartbeat is older than ttlMs', () => {
    registry.register('sim-old');
    registry.register('sim-fresh');
    vi.advanceTimersByTime(10_000);
    registry.touch('sim-fresh'); // refresh it
    const expired = registry.getExpired(5_000);
    expect(expired).toContain('sim-old');
    expect(expired).not.toContain('sim-fresh');
  });

  it('remove() deletes the entry so subsequent touch() returns false', () => {
    registry.register('sim-1');
    registry.remove('sim-1');
    expect(registry.touch('sim-1')).toBe(false);
  });
});
