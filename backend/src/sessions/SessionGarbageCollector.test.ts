import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionGarbageCollector } from './SessionGarbageCollector.js';
import type { ISessionRegistry } from './ISessionRegistry.js';
import type { IGraphService } from '../interfaces/IGraphService.js';

const TTL_MS = 5_000;
const INTERVAL_MS = 1_000;

const makeRegistry = (expired: string[] = []): ISessionRegistry => ({
  register: vi.fn(),
  touch: vi.fn().mockReturnValue(true),
  getExpired: vi.fn().mockReturnValue(expired),
  remove: vi.fn(),
});

const makeGraph = (): IGraphService => ({
  hydrate: vi.fn().mockResolvedValue(undefined),
  flush: vi.fn().mockResolvedValue(undefined),
  exportScheduleJson: vi.fn().mockResolvedValue('{}'),
  listClasses: vi.fn().mockResolvedValue([]),
  countClasses: vi.fn().mockResolvedValue(0),
  updateClass: vi.fn().mockResolvedValue({}),
  getSuggestions: vi.fn().mockResolvedValue([]),
  queryConflicts: vi.fn().mockResolvedValue([]),
  evaluateMetrics: vi.fn().mockResolvedValue([]),
});

describe('SessionGarbageCollector', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not flush any session before the interval elapses', () => {
    const registry = makeRegistry();
    const graph = makeGraph();
    const gc = new SessionGarbageCollector(registry, graph, TTL_MS, INTERVAL_MS);
    gc.start();

    vi.advanceTimersByTime(INTERVAL_MS - 1);
    expect(graph.flush).not.toHaveBeenCalled();

    gc.stop();
  });

  it('flushes expired sessions on each sweep tick', async () => {
    const registry = makeRegistry(['sim-expired-1', 'sim-expired-2']);
    const graph = makeGraph();
    const gc = new SessionGarbageCollector(registry, graph, TTL_MS, INTERVAL_MS);
    gc.start();

    await vi.advanceTimersByTimeAsync(INTERVAL_MS);

    expect(graph.flush).toHaveBeenCalledWith('sim-expired-1');
    expect(graph.flush).toHaveBeenCalledWith('sim-expired-2');

    gc.stop();
  });

  it('removes flushed sessions from the registry after flush', async () => {
    const registry = makeRegistry(['sim-stale']);
    const graph = makeGraph();
    const gc = new SessionGarbageCollector(registry, graph, TTL_MS, INTERVAL_MS);
    gc.start();

    await vi.advanceTimersByTimeAsync(INTERVAL_MS);

    expect(registry.remove).toHaveBeenCalledWith('sim-stale');

    gc.stop();
  });

  it('stop() prevents further sweeps after being called', async () => {
    const registry = makeRegistry(['sim-expired']);
    const graph = makeGraph();
    const gc = new SessionGarbageCollector(registry, graph, TTL_MS, INTERVAL_MS);
    gc.start();
    gc.stop();

    vi.advanceTimersByTime(INTERVAL_MS * 3);
    await vi.runAllTimersAsync();

    expect(graph.flush).not.toHaveBeenCalled();
  });
});
