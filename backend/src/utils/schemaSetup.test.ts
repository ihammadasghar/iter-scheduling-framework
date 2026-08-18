import { describe, it, expect, vi } from 'vitest';
import { ensureIndexes } from './schemaSetup.js';
import type { IMemgraphClient } from '../clients/IMemgraphClient.js';

const HYDRATED_LABELS = ['Course', 'Professor', 'StudentGroup', 'Room', 'TimeSlot', 'Class'];

describe('ensureIndexes()', () => {
  it('creates one branchId index per hydrated label', async () => {
    const client: IMemgraphClient = {
      run: vi.fn().mockResolvedValue([]),
      close: vi.fn(),
    };

    await ensureIndexes(client);

    expect(client.run).toHaveBeenCalledTimes(HYDRATED_LABELS.length);
    for (const label of HYDRATED_LABELS) {
      expect(client.run).toHaveBeenCalledWith(`CREATE INDEX ON :${label}(branchId);`);
    }
  });

  it('propagates an error if a CREATE INDEX call fails', async () => {
    const client: IMemgraphClient = {
      run: vi.fn().mockRejectedValue(new Error('memgraph unreachable')),
      close: vi.fn(),
    };

    await expect(ensureIndexes(client)).rejects.toThrow('memgraph unreachable');
  });
});
