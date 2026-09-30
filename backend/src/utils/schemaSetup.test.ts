import { describe, it, expect, vi } from 'vitest';
import { ensureIndexes } from './schemaSetup.js';
import type { IMemgraphClient } from '../clients/IMemgraphClient.js';

const HYDRATED_LABELS = ['Course', 'Professor', 'StudentGroup', 'Room', 'TimeSlot', 'Class'];

describe('ensureIndexes()', () => {
  it('creates a branchId index and a composite (id, branchId) index per hydrated label, in that order', async () => {
    const client: IMemgraphClient = {
      run: vi.fn().mockResolvedValue([]),
      close: vi.fn(),
    };

    await ensureIndexes(client);

    const calls = vi.mocked(client.run).mock.calls.map(([cypher]) => cypher);
    expect(calls).toHaveLength(HYDRATED_LABELS.length * 2);
    HYDRATED_LABELS.forEach((label, i) => {
      expect(calls[i * 2]).toBe(`CREATE INDEX ON :${label}(branchId);`);
      expect(calls[i * 2 + 1]).toBe(`CREATE INDEX ON :${label}(id, branchId);`);
    });
  });

  it('propagates an error if a CREATE INDEX call fails', async () => {
    const client: IMemgraphClient = {
      run: vi.fn().mockRejectedValue(new Error('memgraph unreachable')),
      close: vi.fn(),
    };

    await expect(ensureIndexes(client)).rejects.toThrow('memgraph unreachable');
  });
});
