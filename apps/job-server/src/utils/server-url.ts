/**
 * Get the internal URL for server-to-server requests.
 * Falls back to the external URL if no internal URL is configured.
 */
export function getInternalUrl(server: {
  url: string;
  internalUrl?: string | null;
}): string {
  return server.internalUrl || server.url;
}
