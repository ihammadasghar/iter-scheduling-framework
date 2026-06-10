export interface IMemgraphClient {
  /**
   * Executes a Cypher query and returns the results as plain JS objects.
   * Neo4j Integer values are automatically converted to JS numbers.
   */
  run<T>(cypher: string, params?: Record<string, unknown>): Promise<readonly T[]>;

  /** Closes the underlying driver connection. */
  close(): Promise<void>;
}
