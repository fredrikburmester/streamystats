import type { Server } from "@streamystats/database";

/**
 * Get the internal URL for server-to-server requests.
 * Falls back to the external URL if no internal URL is configured.
 */
export function getInternalUrl(
  server: Pick<Server, "url" | "internalUrl">
): string {
  return server.internalUrl || server.url;
}
