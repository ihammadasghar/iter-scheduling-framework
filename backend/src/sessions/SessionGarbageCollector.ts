import type { ISessionRegistry } from './ISessionRegistry.js';
import type { IGraphService } from '../interfaces/IGraphService.js';

export class SessionGarbageCollector {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly registry: ISessionRegistry,
    private readonly graph: IGraphService,
    private readonly ttlMs: number,
    private readonly intervalMs: number,
  ) {}

  start(): void {
    this.timer = setInterval(() => void this.sweep(), this.intervalMs);
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async sweep(): Promise<void> {
    const expired = this.registry.getExpired(this.ttlMs);
    for (const simulationId of expired) {
      await this.graph.flush(simulationId);
      this.registry.remove(simulationId);
    }
  }
}
