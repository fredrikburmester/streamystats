/**
 * Timestamp prefix shared by the job server's log formatters.
 *
 * ISO 8601 UTC keeps log lines sortable and unambiguous, and matches the
 * convention that all data is stored in UTC. Keeping it here means the format
 * only has to change in one place.
 */
export function formatLogTimestamp(): string {
  return new Date().toISOString();
}
