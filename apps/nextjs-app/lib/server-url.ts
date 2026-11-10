/**
 * Helper functions for resolving Jellyfin server URLs.
 *
 * - Internal URL: Used for server-to-server requests (job-server, API routes, Next.js Image optimization)
 * - External URL: Used for client browser access (Jellyfin Web UI links)
 */

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

/**
 * Get the external URL for client browser access.
 */
export function getExternalUrl(server: { url: string }): string {
  return server.url;
}
