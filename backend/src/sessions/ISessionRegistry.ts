export interface ISessionRegistry {
  /** Register a new simulation session, initialising its heartbeat timestamp. */
  register(simulationId: string): void;

  /**
   * Refresh the heartbeat for an existing session.
   * Returns `true` on success, `false` if the session is not registered (e.g. GC'd).
   */
  touch(simulationId: string): boolean;

  /** Return all simulationIds whose last heartbeat is older than `ttlMs`. */
  getExpired(ttlMs: number): readonly string[];

  /** Remove a session from the registry (called after GC flush). */
  remove(simulationId: string): void;
}
