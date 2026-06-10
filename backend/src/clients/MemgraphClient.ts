import neo4j from 'neo4j-driver';
import type { Driver } from 'neo4j-driver';
import type { IMemgraphClient } from './IMemgraphClient.js';

export class MemgraphClient implements IMemgraphClient {
  constructor(private readonly driver: Driver) {}

  async run<T>(cypher: string, params: Record<string, unknown> = {}): Promise<readonly T[]> {
    const session = this.driver.session();
    try {
      const result = await session.run(cypher, params);
      return result.records.map((record) => toPlain(record.toObject()) as T);
    } finally {
      await session.close();
    }
  }

  async close(): Promise<void> {
    await this.driver.close();
  }
}

/**
 * Recursively converts neo4j driver types to plain JS values:
 * - neo4j Integer  → JS number
 * - Arrays         → mapped recursively
 * - Plain objects  → entries mapped recursively
 * - Primitives     → returned as-is
 */
function toPlain(value: unknown): unknown {
  if (neo4j.isInt(value)) {
    return value.toNumber();
  }

  if (Array.isArray(value)) {
    return value.map(toPlain);
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, toPlain(v)]),
    );
  }

  return value;
}
