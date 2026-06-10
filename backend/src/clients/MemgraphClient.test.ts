import { describe, it, expect, vi, beforeEach } from 'vitest';
import neo4j from 'neo4j-driver';
import type { Driver, Session } from 'neo4j-driver';
import { MemgraphClient } from './MemgraphClient.js';

type MockSession = {
  run: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
};

type MockDriver = {
  session: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
};

function buildMocks(): { driver: MockDriver; session: MockSession } {
  const session: MockSession = {
    run: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  };
  const driver: MockDriver = {
    session: vi.fn().mockReturnValue(session),
    close: vi.fn().mockResolvedValue(undefined),
  };
  return { driver, session };
}

describe('MemgraphClient', () => {
  let driver: MockDriver;
  let session: MockSession;
  let client: MemgraphClient;

  beforeEach(() => {
    ({ driver, session } = buildMocks());
    client = new MemgraphClient(driver as unknown as Driver);
  });

  // ── run ────────────────────────────────────────────────────────────────────

  it('run() calls session.run with the provided cypher and params', async () => {
    session.run.mockResolvedValue({ records: [] });

    await client.run('MATCH (n) RETURN n', { id: 'abc' });

    expect(driver.session).toHaveBeenCalledOnce();
    expect(session.run).toHaveBeenCalledWith('MATCH (n) RETURN n', { id: 'abc' });
  });

  it('run() converts neo4j Integer values to JS numbers', async () => {
    const record = {
      toObject: () => ({
        count: neo4j.int(42),
        nested: { value: neo4j.int(7) },
        items: [neo4j.int(1), neo4j.int(2)],
      }),
    };
    session.run.mockResolvedValue({ records: [record] });

    const results = await client.run<{ count: number; nested: { value: number }; items: number[] }>(
      'RETURN 42 AS count',
    );

    expect(results[0]).toEqual({ count: 42, nested: { value: 7 }, items: [1, 2] });
  });

  it('run() closes the session after a successful query', async () => {
    session.run.mockResolvedValue({ records: [] });

    await client.run('MATCH (n) RETURN n');

    expect(session.close).toHaveBeenCalledOnce();
  });

  it('run() closes the session even when the query throws', async () => {
    session.run.mockRejectedValue(new Error('Cypher syntax error'));

    await expect(client.run('INVALID CYPHER')).rejects.toThrow('Cypher syntax error');

    expect(session.close).toHaveBeenCalledOnce();
  });

  // ── close ──────────────────────────────────────────────────────────────────

  it('close() delegates to driver.close()', async () => {
    await client.close();

    expect(driver.close).toHaveBeenCalledOnce();
  });
});
