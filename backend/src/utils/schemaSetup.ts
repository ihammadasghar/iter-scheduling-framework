import type { IMemgraphClient } from '../clients/IMemgraphClient.js';

// Labels ScheduleHydrator.buildHydrationBatches hydrates. Every MERGE for
// these (both the 6 node batches and every edge batch's endpoint MATCHes)
// looks nodes up by {id, branchId} properties, never by internal node id —
// with no index, each one is a full label scan across every node of that
// label the shared Memgraph instance has ever created (across every
// ephemeral ci-/score-/preview-/benchmark- branch), not just the current one.
const HYDRATED_LABELS = ['Course', 'Professor', 'StudentGroup', 'Room', 'TimeSlot', 'Class'] as const;

// branchId is the single highest-leverage index here: it's the first thing
// every hydration MERGE and every GraphService query filters on, and it's
// what narrows a scan down to just the current branch. Memgraph's
// `CREATE INDEX` is idempotent (a no-op if the index already exists), so
// this is safe to call unconditionally on every app boot, benchmark run, and
// integration-test setup.
export async function ensureIndexes(client: IMemgraphClient): Promise<void> {
  for (const label of HYDRATED_LABELS) {
    await client.run(`CREATE INDEX ON :${label}(branchId);`);
  }
}
