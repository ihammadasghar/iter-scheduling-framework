import type { ISessionRegistry } from './ISessionRegistry.js';

export class SessionRegistry implements ISessionRegistry {
  private readonly sessions: Map<string, number> = new Map();

  register(simulationId: string): void {
    this.sessions.set(simulationId, Date.now());
  }

  touch(simulationId: string): boolean {
    if (!this.sessions.has(simulationId)) return false;
    this.sessions.set(simulationId, Date.now());
    return true;
  }

  getExpired(ttlMs: number): readonly string[] {
    const cutoff = Date.now() - ttlMs;
    return Array.from(this.sessions.entries())
      .filter(([, lastBeat]) => lastBeat < cutoff)
      .map(([id]) => id);
  }

  remove(simulationId: string): void {
    this.sessions.delete(simulationId);
  }
}
